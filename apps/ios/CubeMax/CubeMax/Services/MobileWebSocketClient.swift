import Foundation
import UIKit

@MainActor
final class MobileWebSocketClient: NSObject {
    var onEnvelope: ((MobileEnvelope) -> Void)?
    var onUnauthorized: (() -> Void)?
    var onDisconnect: (() -> Void)?

    private var task: URLSessionWebSocketTask?
    private var session: URLSession?
    private var reconnectAttempt = 0
    private var heartbeatTimer: Timer?
    private var receiveTask: Task<Void, Never>?
    private var connecting = false
    private var stopped = false
    private let api: APIClient
    private let installationId: String

    init(api: APIClient, installationId: String) {
        self.api = api
        self.installationId = installationId
        super.init()
    }

    func connect() async {
        if stopped { stopped = false }
        if task != nil || connecting { return }
        connecting = true
        defer { connecting = false }
        guard let url = await api.mobileWebSocketURL() else { return }
        var request = URLRequest(url: url)
        if let token = await api.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let organizationId = await api.organizationId {
            request.setValue(organizationId, forHTTPHeaderField: "x-organization-id")
        }
        request.setValue(installationId, forHTTPHeaderField: "X-Installation-Id")
        let session = URLSession(configuration: .default)
        self.session = session
        let socket = session.webSocketTask(with: request)
        task = socket
        socket.resume()
        startReceiveLoop()
        await sendHello()
        startHeartbeat()
        reconnectAttempt = 0
    }

    func close() {
        stopped = true
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        receiveTask?.cancel()
        receiveTask = nil
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        session?.invalidateAndCancel()
        session = nil
    }

    func send(_ envelope: MobileEnvelope) async {
        guard let task else { return }
        do {
            let data = try JSONEncoder().encode(envelope)
            guard let text = String(data: data, encoding: .utf8) else { return }
            try await task.send(.string(text))
        } catch {
            scheduleReconnect()
        }
    }

    func sendStatus(appState: String, sessionId: String?, previewing: Bool, facing: String) async {
        await send(.make(type: "device.status", data: [
            "app_state": .string(appState),
            "camera": .object([
                "session_id": sessionId.map(JSONValue.string) ?? .null,
                "previewing": .bool(previewing),
                "facing": .string(facing),
            ]),
        ]))
    }

    private func sendHello() async {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        await send(.make(type: "hello", data: [
            "installation_id": .string(installationId),
            "platform": .string("ios"),
            "app_version": .string(version),
            "os_version": .string(UIDevice.current.systemVersion),
            "device_model": .string(machineIdentifier()),
            "capabilities": .array(MobileProtocol.capabilities.map(JSONValue.string)),
            "limits": .object([
                "max_capture_bytes": .number(2_097_152),
                "max_edge_px": .number(1920),
            ]),
            "push_token": .null,
        ]))
    }

    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 20, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.sendStatus(appState: "active", sessionId: nil, previewing: false, facing: "back")
            }
        }
    }

    private func startReceiveLoop() {
        receiveTask?.cancel()
        receiveTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self, let task = self.task else { break }
                do {
                    let message = try await task.receive()
                    if case .string(let text) = message {
                        await MainActor.run { self.handleText(text) }
                    }
                } catch {
                    if !Task.isCancelled {
                        await MainActor.run { self.scheduleReconnect() }
                    }
                    break
                }
            }
        }
    }

    private func handleText(_ text: String) {
        guard let data = text.data(using: .utf8),
              let envelope = try? JSONDecoder().decode(MobileEnvelope.self, from: data) else { return }
        if envelope.type == "error", envelope.data["code"]?.stringValue == "UNAUTHORIZED" {
            onUnauthorized?()
            return
        }
        onEnvelope?(envelope)
    }

    private func scheduleReconnect() {
        guard !stopped else { return }
        onDisconnect?()
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        reconnectAttempt += 1
        let delay = min(pow(2.0, Double(max(reconnectAttempt - 1, 0))), 30)
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            await self?.connect()
        }
    }

    private func machineIdentifier() -> String {
        var info = utsname()
        uname(&info)
        return withUnsafePointer(to: &info.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 256) { String(cString: $0) }
        }
    }
}
