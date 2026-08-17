import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var model: AppModel
    @State private var workspaceSelection = "personal"
    @State private var showLogoutConfirmation = false
    @State private var modelId = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        Circle()
                            .fill(.indigo.opacity(0.14))
                            .frame(width: 58, height: 58)
                            .overlay {
                                Text(String(model.user?.displayName.prefix(1) ?? "C"))
                                    .font(.title2.weight(.bold))
                                    .foregroundStyle(.indigo)
                            }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(model.user?.displayName ?? "CubeMax 用户").font(.headline)
                            Text(model.user?.username ?? "").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                }

                Section("工作区") {
                    if let context = model.workspaceContext, !context.choices.isEmpty {
                        Picker("当前工作区", selection: $workspaceSelection) {
                            ForEach(context.choices) { choice in
                                Label(choice.name, systemImage: choice.organizationId == nil ? "person" : "person.3")
                                    .tag(choice.id)
                            }
                        }
                        .onChange(of: workspaceSelection) { _, value in
                            Task { await model.selectWorkspace(value) }
                        }
                    } else {
                        Text("暂无可用工作区").foregroundStyle(.secondary)
                    }
                }

                Section("设备与服务") {
                    NavigationLink {
                        CubeCatDevicesView()
                    } label: {
                        Label {
                            HStack {
                                Text("CubeCat 设备")
                                Spacer()
                                if !model.cubeCatDevices.isEmpty { Text("\(model.cubeCatDevices.count) 台").foregroundStyle(.secondary) }
                            }
                        } icon: {
                            Image(systemName: "cpu.fill").foregroundStyle(.indigo)
                        }
                    }
                    NavigationLink {
                        SmartHomeAccountsView()
                    } label: {
                        Label {
                            HStack {
                                Text("我的智能家居")
                                Spacer()
                                if !model.accounts.isEmpty { Text("\(model.accounts.count) 个账号").foregroundStyle(.secondary) }
                            }
                        } icon: {
                            Image(systemName: "lightbulb.2.fill").foregroundStyle(.orange)
                        }
                    }
                }

                Section {
                    TextField("默认模型 UUID（可选）", text: $modelId)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Text("用于新建对话。已有对话优先使用服务端绑定的模型。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("AI 设置")
                }

                Section {
                    Button("退出登录", role: .destructive) { showLogoutConfirmation = true }
                }
            }
            .navigationTitle("我的")
            .scrollContentBackground(.hidden)
            .background(Color(uiColor: .systemGroupedBackground))
            .task {
                workspaceSelection = model.selectedWorkspaceId ?? "personal"
                modelId = model.defaultModelId
                if model.accounts.isEmpty { await model.loadSmartHome() }
                if model.cubeCatDevices.isEmpty { await model.loadCubeCatDevices() }
            }
            .onChange(of: modelId) { _, value in model.defaultModelId = value }
            .confirmationDialog("确定退出当前账号？", isPresented: $showLogoutConfirmation, titleVisibility: .visible) {
                Button("退出登录", role: .destructive) { Task { await model.logout() } }
                Button("取消", role: .cancel) {}
            }
        }
    }
}
