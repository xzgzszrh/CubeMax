import Foundation
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
    static let defaultAPIBaseURL = APIEndpoint.productionURLString

    @Published private(set) var token: String?
    @Published private(set) var user: UserInfo?
    @Published private(set) var workspaceContext: WorkspaceContext?
    @Published private(set) var triggers: [ProgrammingTriggerItem] = []
    @Published private(set) var projects: [ProgrammingProject] = []
    @Published private(set) var conversations: [ConversationRecord] = []
    @Published private(set) var accounts: [XiaomiHomeAccount] = []
    @Published private(set) var devices: [XiaomiDevice] = []
    @Published private(set) var cubeCatDevices: [XiaozhiCubeCatDevice] = []
    @Published private(set) var buildingAgents: [BuildingAgentSummary] = []
    @Published private(set) var isBootstrapping = true
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var defaultModelId: String {
        didSet { UserDefaults.standard.set(defaultModelId, forKey: "cubemax.default-model-id") }
    }

    let api: APIClient
    private let keychain = KeychainStore.shared

    var isAuthenticated: Bool { token != nil && user != nil }
    var selectedWorkspaceId: String? { UserDefaults.standard.string(forKey: "cubemax.workspace-id") }
    var selectedWorkspaceName: String {
        guard let selectedWorkspaceId else { return workspaceContext?.personalWorkspace?.name ?? "个人空间" }
        return workspaceContext?.organizations.first(where: { $0.id == selectedWorkspaceId })?.name ?? "个人空间"
    }

    init() {
        let savedToken = KeychainStore.shared.load()
        token = savedToken
        defaultModelId = UserDefaults.standard.string(forKey: "cubemax.default-model-id") ?? ""
        let savedBaseURL = UserDefaults.standard.string(forKey: "cubemax.api-base-url")
        let normalizedBaseURL = savedBaseURL.flatMap { APIEndpoint.normalizedString(from: $0) } ?? Self.defaultAPIBaseURL
        if savedBaseURL != normalizedBaseURL {
            UserDefaults.standard.set(normalizedBaseURL, forKey: "cubemax.api-base-url")
        }
        api = APIClient(baseURLString: normalizedBaseURL, token: savedToken)
        Task { [weak self] in
            guard let self else { return }
            await self.restoreSession()
        }
    }

    func login(username: String, password: String, baseURL: String) async throws {
        errorMessage = nil
        let normalizedBaseURL = try await api.updateBaseURL(baseURL)
        UserDefaults.standard.set(normalizedBaseURL, forKey: "cubemax.api-base-url")
        let response = try await api.login(username: username, password: password)
        try keychain.save(token: response.token)
        token = response.token
        await api.setToken(response.token)
        user = response.user
        await loadWorkspace()
        await loadDashboard()
    }

    func restoreSession() async {
        defer { isBootstrapping = false }
        guard token != nil else { return }
        do {
            await api.setToken(token)
            user = try await api.userInfo()
            await loadWorkspace()
            await loadDashboard()
        } catch {
            await clearSession()
            errorMessage = localized(error)
        }
    }

    func logout() async {
        await api.logout()
        await clearSession()
    }

    func clearError() { errorMessage = nil }

    func selectWorkspace(_ id: String) async {
        let organizationId = id == "personal" ? nil : id
        if let organizationId { UserDefaults.standard.set(organizationId, forKey: "cubemax.workspace-id") }
        else { UserDefaults.standard.removeObject(forKey: "cubemax.workspace-id") }
        await api.setOrganizationId(organizationId)
        cubeCatDevices = []
        buildingAgents = []
        accounts = []
        devices = []
        await loadDashboard()
        await loadCubeCatDevices()
        await loadSmartHome()
    }

    func loadWorkspace() async {
        do {
            workspaceContext = try await api.workspaceContext()
            await api.setOrganizationId(selectedWorkspaceId)
        } catch { errorMessage = localized(error) }
    }

    func loadDashboard() async {
        isLoading = true
        defer { isLoading = false }
        await loadTriggers()
        await loadConversations()
    }

    func loadTriggers() async {
        do { triggers = try await api.triggers().items }
        catch { errorMessage = localized(error) }
    }

    func loadProjects() async {
        do { projects = try await api.projects().items.filter(\.isPublished) }
        catch { errorMessage = localized(error) }
    }

    func loadCubeCatDevices() async {
        do {
            async let loadedDevices: [XiaozhiCubeCatDevice] = api.xiaozhiCubeCatDevices()
            async let loadedAgents: Paginated<BuildingAgentSummary> = api.myBuildingAgents()
            let (devices, agents) = try await (loadedDevices, loadedAgents)
            cubeCatDevices = devices
            buildingAgents = agents.items
        }
        catch { errorMessage = localized(error) }
    }

    func updateCubeCatDevice(
        _ device: XiaozhiCubeCatDevice,
        alias: String,
        settings: CubeCatDeviceSettings,
        autoUpdate: Bool
    ) async throws {
        if alias.trimmingCharacters(in: .whitespacesAndNewlines) != device.alias {
            try await api.updateXiaozhiDeviceAlias(
                agentId: device.agentId,
                deviceId: device.id,
                macAddress: device.macAddress,
                alias: alias.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        }
        if settings.volume != device.settings.volume ||
            settings.brightness != device.settings.brightness ||
            settings.doNotDisturb != device.settings.doNotDisturb {
            try await api.updateXiaozhiDeviceSettings(
                agentId: device.agentId,
                deviceId: device.id,
                settings: settings
            )
        }
        if autoUpdate != device.autoUpdate {
            try await api.updateXiaozhiDeviceAutoUpdate(
                agentId: device.agentId,
                deviceId: device.id,
                autoUpdate: autoUpdate,
                macAddress: device.macAddress
            )
        }
        await loadCubeCatDevices()
    }

    func switchCubeCatAgent(_ device: XiaozhiCubeCatDevice, buildingAgentId: String?) async throws {
        try await api.linkBuildingAgent(
            xiaozhiAgentId: device.agentId,
            buildingAgentId: buildingAgentId
        )
        await loadCubeCatDevices()
    }

    func loadLuaRuns(for device: CubeCatDevice) async throws -> [LuaDeviceRun] {
        try await api.luaRuns(deviceId: device.deviceId)
    }

    func loadLuaRunLogs(deviceId: String, runId: String) async throws -> [LuaDeviceRunLog] {
        try await api.luaRunLogs(deviceId: deviceId, runId: runId)
    }

    func stopLuaRun(deviceId: String, runId: String) async throws {
        _ = try await api.stopLuaRun(deviceId: deviceId, runId: runId)
    }

    func createTrigger(name: String, description: String?, projectId: String, pinned: Bool) async throws {
        _ = try await api.createTrigger(name: name, description: description, projectId: projectId, pinned: pinned)
        await loadTriggers()
    }

    func executeTrigger(_ trigger: ProgrammingTriggerItem, inputs: [String: JSONValue]) async throws -> String {
        let response = try await api.executeTrigger(id: trigger.id, inputs: inputs)
        return response.taskID
    }

    func loadConversations() async {
        do { conversations = try await api.conversations().items }
        catch { errorMessage = localized(error) }
    }

    func createConversation() async throws -> ConversationRecord {
        let conversation = try await api.createConversation(title: nil)
        conversations.insert(conversation, at: 0)
        return conversation
    }

    func loadMessages(for conversationId: String) async throws -> [ChatMessage] {
        try await api.messages(conversationId: conversationId).items
    }

    func sendMessage(_ text: String, conversation: ConversationRecord, modelId: String) async throws -> String {
        let payload = ChatSendRequest(
            modelId: modelId,
            conversationId: conversation.id,
            messages: [ChatInputMessage(id: UUID().uuidString, role: "user", parts: [ChatInputPart(type: "text", text: text)])],
            title: conversation.title
        )
        let result = try await api.sendChat(payload)
        await loadConversations()
        return result
    }

    func loadSmartHome() async {
        do {
            async let loadedAccounts = api.xiaomiAccounts()
            async let loadedDevices = api.xiaomiDevices()
            accounts = try await loadedAccounts
            devices = try await loadedDevices
        } catch { errorMessage = localized(error) }
    }

    func importXiaomiCredentials(_ credentials: String) async throws {
        _ = try await api.importXiaomiCredentials(credentials)
        await loadSmartHome()
    }

    func syncAccount(_ account: XiaomiHomeAccount) async throws {
        _ = try await api.syncXiaomiAccount(account.id)
        await loadSmartHome()
    }

    func deleteAccount(_ account: XiaomiHomeAccount) async throws {
        try await api.deleteXiaomiAccount(account.id)
        await loadSmartHome()
    }

    func refreshDevice(_ device: XiaomiDevice) async throws {
        let updated = try await api.refreshXiaomiDevice(device.id)
        replaceDevice(updated)
    }

    func setProperty(device: XiaomiDevice, capability: XiaomiCapability, value: JSONValue) async throws {
        guard let piid = capability.piid else { return }
        let updated = try await api.setXiaomiProperty(device.id, siid: capability.siid, piid: piid, value: value)
        replaceDevice(updated)
    }

    func executeAction(device: XiaomiDevice, capability: XiaomiCapability, inputs: [JSONValue] = []) async throws {
        guard let aiid = capability.aiid else { return }
        let updated = try await api.executeXiaomiAction(device.id, siid: capability.siid, aiid: aiid, inputs: inputs)
        replaceDevice(updated)
    }

    private func replaceDevice(_ device: XiaomiDevice) {
        if let index = devices.firstIndex(where: { $0.id == device.id }) { devices[index] = device }
        else { devices.append(device) }
    }

    private func clearSession() async {
        keychain.delete()
        token = nil
        user = nil
        workspaceContext = nil
        triggers = []
        conversations = []
        accounts = []
        devices = []
        cubeCatDevices = []
        buildingAgents = []
    }

    private func localized(_ error: Error) -> String {
        if let error = error as? LocalizedError, let description = error.errorDescription { return description }
        return error.localizedDescription
    }
}
