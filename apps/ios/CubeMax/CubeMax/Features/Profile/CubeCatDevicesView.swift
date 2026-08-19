import SwiftUI

struct CubeCatDevicesView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if model.cubeCatDevices.isEmpty {
                ContentUnavailableView {
                    Label("还没有方糖猫", image: "PixelPlanet")
                } description: {
                    Text("老师或组织管理员分配设备后，会自动显示在这里。请确认已切换到对应团队。")
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 14) {
                        ForEach(model.cubeCatDevices, id: \.stableID) { device in
                            NavigationLink {
                                CubeCatDeviceDetailView(device: device)
                            } label: {
                                CubeCatDeviceCard(device: device)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
                .background(Color(uiColor: .systemGroupedBackground))
            }
        }
        .navigationTitle("我的方糖猫")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await model.loadCubeCatDevices() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("刷新方糖猫设备")
            }
        }
        .refreshable { await model.loadCubeCatDevices() }
        .task {
            if model.cubeCatDevices.isEmpty { await model.loadCubeCatDevices() }
        }
    }
}

struct CubeCatProductImage: View {
    let device: XiaozhiCubeCatDevice
    var height: CGFloat = 116

    var body: some View {
        Image(device.assetImageName)
            .resizable()
            .scaledToFit()
            .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
            .saturation(device.online ? 1 : 0.35)
            .opacity(device.online ? 1 : 0.72)
            .accessibilityLabel(device.deviceType.displayName)
    }
}

struct CubeCatDeviceCard: View {
    let device: XiaozhiCubeCatDevice

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                Color(uiColor: .secondarySystemGroupedBackground)
                CubeCatProductImage(device: device, height: 150)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                Label(device.online ? "在线" : "离线", systemImage: "circle.fill")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(device.online ? .green : .secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(.regularMaterial, in: Capsule())
                    .padding(12)
            }
            .frame(height: 170)

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(device.displayName)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(device.deviceType.displayName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Label(device.linkedAgentName ?? "尚未选择智能体", systemImage: "sparkles")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(16)
        }
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.primary.opacity(0.06))
        }
    }
}

struct CubeCatDeviceDetailView: View {
    @EnvironmentObject private var model: AppModel

    let device: XiaozhiCubeCatDevice
    @State private var alias: String
    @State private var volume: Double
    @State private var brightness: Double
    @State private var doNotDisturb: Bool
    @State private var autoUpdate: Bool
    @State private var agentSelection: String
    @State private var isSaving = false
    @State private var isSwitchingAgent = false
    @State private var operationError: String?

    private let noAgentSelection = "__none__"

    init(device: XiaozhiCubeCatDevice) {
        self.device = device
        _alias = State(initialValue: device.alias)
        _volume = State(initialValue: Double(device.settings.volume))
        _brightness = State(initialValue: Double(device.settings.brightness))
        _doNotDisturb = State(initialValue: device.settings.doNotDisturb)
        _autoUpdate = State(initialValue: device.autoUpdate)
        _agentSelection = State(initialValue: device.linkedAgentId ?? "__none__")
    }

    private var liveDevice: XiaozhiCubeCatDevice {
        model.cubeCatDevices.first(where: { $0.stableID == device.stableID }) ?? device
    }

    var body: some View {
        Form {
            Section {
                VStack(spacing: 12) {
                    CubeCatProductImage(device: liveDevice, height: 210)
                    VStack(spacing: 4) {
                        Text(liveDevice.displayName)
                            .font(.title2.weight(.semibold))
                        Text(liveDevice.deviceType.displayName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Label(liveDevice.online ? "设备在线" : "设备离线", systemImage: "circle.fill")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(liveDevice.online ? .green : .secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .listRowBackground(Color.clear)

            Section {
                Picker("当前智能体", selection: $agentSelection) {
                    Text("不使用 BuildingAI 智能体").tag(noAgentSelection)
                    ForEach(model.buildingAgents) { agent in
                        Text(agent.name).tag(agent.id)
                    }
                }
                .disabled(!liveDevice.canManage || isSwitchingAgent)
                .onChange(of: agentSelection) { oldValue, newValue in
                    guard oldValue != newValue else { return }
                    switchAgent(newValue == noAgentSelection ? nil : newValue)
                }

                if isSwitchingAgent {
                    HStack {
                        ProgressView()
                        Text("正在同步角色设定…")
                            .foregroundStyle(.secondary)
                    }
                }

                if liveDevice.agentDeviceCount > 1 {
                    Label(
                        "这个智能体组包含 \(liveDevice.agentDeviceCount) 台设备，切换后同组设备会共同使用新的角色设定。",
                        systemImage: "square.stack.3d.up"
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                LabeledContent("模型", value: liveDevice.model ?? "由小智默认配置")
                LabeledContent("音色", value: liveDevice.voice ?? "由小智默认配置")
            } header: {
                Text("智能体")
            }

            Section("设备设置") {
                TextField("设备名称", text: $alias)
                    .disabled(!liveDevice.canManage)

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label("音量", systemImage: "speaker.wave.2")
                        Spacer()
                        Text("\(Int(volume))%")
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Slider(value: $volume, in: 0...100, step: 5)
                }
                .disabled(!liveDevice.canManage)

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label("屏幕亮度", systemImage: "sun.max")
                        Spacer()
                        Text("\(Int(brightness))%")
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Slider(value: $brightness, in: 0...100, step: 5)
                }
                .disabled(!liveDevice.canManage)

                Toggle("勿扰模式", systemImage: "moon.zzz", isOn: $doNotDisturb)
                    .disabled(!liveDevice.canManage)
                Toggle("自动升级", systemImage: "arrow.triangle.2.circlepath", isOn: $autoUpdate)
                    .disabled(!liveDevice.canManage)

                Button {
                    saveSettings()
                } label: {
                    HStack {
                        Spacer()
                        if isSaving { ProgressView() }
                        Text(isSaving ? "正在保存…" : "保存设备设置")
                            .fontWeight(.semibold)
                        Spacer()
                    }
                }
                .disabled(!liveDevice.canManage || isSaving || alias.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            Section("设备信息") {
                LabeledContent("设备型号", value: liveDevice.deviceType.displayName)
                LabeledContent("设备板型", value: liveDevice.boardName.isEmpty ? "未上报" : liveDevice.boardName)
                LabeledContent("固件版本", value: liveDevice.appVersion.isEmpty ? "未上报" : liveDevice.appVersion)
                LabeledContent("序列号", value: liveDevice.serialNumber.isEmpty ? "未上报" : liveDevice.serialNumber)
                LabeledContent("MAC 地址", value: liveDevice.macAddress.isEmpty ? "未上报" : liveDevice.macAddress)
                LabeledContent("设备组", value: liveDevice.agentName)
                if let lastConnectedAt = liveDevice.lastConnectedAt {
                    LabeledContent("最后连接", value: lastConnectedAt.shortDateTime)
                }
            }

            Section {
                Label("设备型号由老师或组织管理员指定。设备资料只在当前工作空间中可见。", systemImage: "checkmark.shield")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle(liveDevice.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .alert("操作失败", isPresented: Binding(
            get: { operationError != nil },
            set: { if !$0 { operationError = nil } }
        )) {
            Button("知道了") { operationError = nil }
        } message: {
            Text(operationError ?? "")
        }
    }

    private func switchAgent(_ buildingAgentId: String?) {
        isSwitchingAgent = true
        Task {
            do {
                try await model.switchCubeCatAgent(liveDevice, buildingAgentId: buildingAgentId)
            } catch {
                agentSelection = liveDevice.linkedAgentId ?? noAgentSelection
                operationError = error.localizedDescription
            }
            isSwitchingAgent = false
        }
    }

    private func saveSettings() {
        isSaving = true
        Task {
            do {
                try await model.updateCubeCatDevice(
                    liveDevice,
                    alias: alias,
                    settings: CubeCatDeviceSettings(
                        volume: Int(volume),
                        brightness: Int(brightness),
                        doNotDisturb: doNotDisturb
                    ),
                    autoUpdate: autoUpdate
                )
            } catch {
                operationError = error.localizedDescription
            }
            isSaving = false
        }
    }
}

private extension String {
    var shortDateTime: String {
        guard let date = ISO8601DateFormatter().date(from: self) else { return self }
        return date.formatted(.dateTime.month(.twoDigits).day(.twoDigits).hour().minute())
    }
}
