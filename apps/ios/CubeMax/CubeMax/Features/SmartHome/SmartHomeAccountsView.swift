import SwiftUI

struct SmartHomeAccountsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var showImport = false
    @State private var selectedAccount: XiaomiHomeAccount?

    var body: some View {
        List {
            Section {
                NavigationLink {
                    SmartHomeDevicesView(accountId: nil)
                } label: {
                    Label("查看全部设备", systemImage: "rectangle.3.group.fill")
                }
            }

            Section("已连接账号") {
                if model.accounts.isEmpty {
                    Text("还没有连接小米账号").foregroundStyle(.secondary)
                } else {
                    ForEach(model.accounts) { account in
                        NavigationLink {
                            SmartHomeDevicesView(accountId: account.id)
                        } label: {
                            AccountRow(account: account)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button {
                                Task { try? await model.syncAccount(account) }
                            } label: { Label("同步", systemImage: "arrow.clockwise") }
                            .tint(.indigo)
                            Button(role: .destructive) {
                                selectedAccount = account
                            } label: { Label("删除", systemImage: "trash") }
                        }
                    }
                }
            }

            Section {
                Text("请在本地 Home Assistant 脚本中完成小米登录，再将生成的凭据 JSON 粘贴到这里。访问令牌只会安全地发送到当前 BuildingAI 账号。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("我的智能家居")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showImport = true } label: { Image(systemName: "key.fill") }
                    .accessibilityLabel("导入小米凭据")
            }
        }
        .refreshable { await model.loadSmartHome() }
        .task { await model.loadSmartHome() }
        .sheet(isPresented: $showImport) { XiaomiCredentialImportView() }
        .confirmationDialog("删除小米账号？", isPresented: Binding(get: { selectedAccount != nil }, set: { if !$0 { selectedAccount = nil } }), titleVisibility: .visible) {
            Button("删除账号及设备缓存", role: .destructive) {
                if let account = selectedAccount { Task { try? await model.deleteAccount(account) } }
                selectedAccount = nil
            }
            Button("取消", role: .cancel) { selectedAccount = nil }
        } message: {
            Text("这不会删除小米云中的设备，只会解除 BuildingAI 中的连接。")
        }
    }
}

private struct AccountRow: View {
    let account: XiaomiHomeAccount

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: account.status == "active" ? "checkmark.shield.fill" : "exclamationmark.shield.fill")
                .foregroundStyle(account.status == "active" ? .green : .orange)
                .font(.title3)
            VStack(alignment: .leading, spacing: 4) {
                Text(account.label).font(.subheadline.weight(.semibold))
                Text("\(account.cloudServerLabel) · \(account.onlineDeviceCount)/\(account.deviceCount) 台在线")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct XiaomiCredentialImportView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var credentials = ""
    @State private var isImporting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $credentials)
                        .frame(minHeight: 230)
                        .font(.system(.footnote, design: .monospaced))
                } header: {
                    Text("Home Assistant 凭据 JSON")
                } footer: {
                    Text("粘贴本地授权脚本输出的完整 JSON，包含 accessToken、refreshToken 和 expiresAt。")
                }
                if let errorMessage {
                    Section { Label(errorMessage, systemImage: "exclamationmark.circle").foregroundStyle(.red) }
                }
            }
            .navigationTitle("导入小米账号")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isImporting ? "导入中…" : "导入") { importCredentials() }
                        .disabled(isImporting || credentials.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func importCredentials() {
        isImporting = true
        errorMessage = nil
        Task {
            do {
                try await model.importXiaomiCredentials(credentials)
                dismiss()
            } catch { errorMessage = error.localizedDescription }
            isImporting = false
        }
    }
}
