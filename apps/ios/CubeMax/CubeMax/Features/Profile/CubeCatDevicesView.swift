import SwiftUI

struct CubeCatDevicesView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if model.cubeCatDevices.isEmpty {
                EmptyStateView(icon: "cpu", title: "没有 CubeCat 设备", message: "让设备连接到 CubeCat 网关后，它会出现在这里。")
            } else {
                List(model.cubeCatDevices) { device in
                    NavigationLink { CubeCatDeviceDetailView(device: device) } label: { CubeCatDeviceRow(device: device) }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("CubeCat 设备")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await model.loadCubeCatDevices() } } label: { Image(systemName: "arrow.clockwise") }
                    .accessibilityLabel("刷新 CubeCat 设备")
            }
        }
        .refreshable { await model.loadCubeCatDevices() }
        .task { await model.loadCubeCatDevices() }
    }
}

private struct CubeCatDeviceRow: View {
    let device: CubeCatDevice

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: "cpu.fill")
                .foregroundStyle(device.online ? .indigo : .secondary)
                .frame(width: 35, height: 35)
                .background((device.online ? Color.indigo : Color.secondary).opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(device.displayName).font(.subheadline.weight(.semibold))
                Text(device.firmwareVersion ?? "等待设备上报版本")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Label(device.online ? "在线" : "离线", systemImage: "circle.fill")
                .font(.caption2)
                .foregroundStyle(device.online ? .green : .secondary)
        }
        .padding(.vertical, 4)
    }
}

struct CubeCatDeviceDetailView: View {
    @EnvironmentObject private var model: AppModel
    let device: CubeCatDevice
    @State private var runs: [LuaDeviceRun] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section("设备信息") {
                LabeledContent("设备 ID", value: device.deviceId)
                LabeledContent("固件", value: device.firmwareVersion ?? "未知")
                LabeledContent("运行时", value: device.runtime?.apiVersion ?? "未知")
                if !device.capabilities.isEmpty { LabeledContent("能力", value: device.capabilities.joined(separator: ", ")) }
                if let lastSeen = device.lastSeenAt { LabeledContent("最后在线", value: lastSeen.shortDateTime) }
            }
            Section("工作流执行记录") {
                if isLoading { HStack { ProgressView(); Text("正在读取记录…") } }
                else if runs.isEmpty { Text("没有当前账号创建的执行记录").foregroundStyle(.secondary) }
                else {
                    ForEach(runs) { run in
                        NavigationLink { CubeCatRunDetailView(device: device, run: run) } label: { LuaRunRow(run: run) }
                    }
                }
            }
        }
        .navigationTitle(device.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { Button { Task { await loadRuns() } } label: { Image(systemName: "arrow.clockwise") } }
        }
        .task { await loadRuns() }
        .alert("无法读取设备记录", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("知道了") { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
    }

    private func loadRuns() async {
        isLoading = true
        do { runs = try await model.loadLuaRuns(for: device) }
        catch { errorMessage = error.localizedDescription }
        isLoading = false
    }
}

struct CubeCatRunDetailView: View {
    @EnvironmentObject private var model: AppModel
    let device: CubeCatDevice
    @State private var run: LuaDeviceRun
    @State private var logs: [LuaDeviceRunLog] = []
    @State private var isStopping = false
    @State private var errorMessage: String?

    init(device: CubeCatDevice, run: LuaDeviceRun) {
        self.device = device
        _run = State(initialValue: run)
    }

    private var canStop: Bool {
        [.queued, .preparing, .transferring, .running, .stopping, .waitingForDevice].contains(run.status)
    }

    var body: some View {
        List {
            Section("执行状态") {
                LabeledContent("名称", value: run.name)
                LabeledContent("状态", value: run.status.displayName)
                LabeledContent("超时", value: "\(run.timeoutMs / 1000) 秒")
                if let error = run.error { LabeledContent("错误", value: error.message) }
            }
            Section("日志") {
                if logs.isEmpty { Text("尚无日志").foregroundStyle(.secondary) }
                else {
                    ForEach(logs) { log in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(log.sequence) · \(log.level.uppercased())").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                            Text(log.text).font(.footnote.monospaced())
                        }
                    }
                }
            }
            if canStop {
                Section {
                    Button(isStopping ? "正在停止…" : "停止执行", role: .destructive) { stopRun() }
                        .disabled(isStopping)
                }
            }
        }
        .navigationTitle("执行详情")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { Task { await loadLogs() } } label: { Image(systemName: "arrow.clockwise") } } }
        .task { await loadLogs() }
        .alert("操作失败", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("知道了") { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
    }

    private func loadLogs() async {
        do { logs = try await model.loadLuaRunLogs(deviceId: device.deviceId, runId: run.id) }
        catch { errorMessage = error.localizedDescription }
    }

    private func stopRun() {
        isStopping = true
        Task {
            do {
                try await model.stopLuaRun(deviceId: device.deviceId, runId: run.id)
                run = (try await model.loadLuaRuns(for: device).first { $0.id == run.id }) ?? run
                await loadLogs()
            } catch { errorMessage = error.localizedDescription }
            isStopping = false
        }
    }
}

private struct LuaRunRow: View {
    let run: LuaDeviceRun

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(run.name).font(.subheadline.weight(.medium))
                Text(run.createdAt.shortDateTime).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(run.status.displayName).font(.caption.weight(.medium)).foregroundStyle(run.status.color)
        }
    }
}

private extension LuaDeviceRunStatus {
    var displayName: String {
        switch self {
        case .queued: return "排队中"
        case .preparing: return "准备中"
        case .transferring: return "传输中"
        case .running: return "运行中"
        case .stopping: return "停止中"
        case .waitingForDevice: return "等待设备"
        case .succeeded: return "已完成"
        case .failed: return "失败"
        case .stopped: return "已停止"
        case .timedOut: return "已超时"
        }
    }

    var color: Color {
        switch self {
        case .succeeded: return .green
        case .failed, .timedOut: return .red
        case .stopped: return .secondary
        default: return .indigo
        }
    }
}

private extension String {
    var shortDateTime: String {
        guard let date = ISO8601DateFormatter().date(from: self) else { return self }
        return date.formatted(.dateTime.month(.twoDigits).day(.twoDigits).hour().minute())
    }
}
