import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var model: AppModel
    @State private var username = ""
    @State private var password = ""
    @State private var baseURL = AppModel.defaultAPIBaseURL
    @State private var serverDraft = AppModel.defaultAPIBaseURL
    @State private var logoTapCount = 0
    @State private var showServerEditor = false
    @State private var isSubmitting = false
    @State private var localError: String?
    @FocusState private var focusedField: Field?

    private enum Field { case username, password, baseURL }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 12) {
                        Image("PixelPlanet")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 132, height: 96)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                logoTapCount += 1
                                if logoTapCount >= 5 {
                                    serverDraft = baseURL
                                    logoTapCount = 0
                                    showServerEditor = true
                                }
                            }
                        Text("CubeMax")
                            .font(.largeTitle.weight(.bold))
                        Text("连接你的 CubeCat 工作区")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 22)
                }
                .listRowBackground(Color.clear)

                Section("账号") {
                    TextField("用户名、邮箱或手机号", text: $username)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .username)
                    SecureField("密码", text: $password)
                        .textContentType(.password)
                        .focused($focusedField, equals: .password)
                        .onSubmit { submit() }
                }

                if let localError {
                    Section {
                        Label(localError, systemImage: "exclamationmark.circle")
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(action: submit) {
                        HStack {
                            Spacer()
                            if isSubmitting { ProgressView().tint(.white) }
                            else { Text("登录") .fontWeight(.semibold) }
                            Spacer()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSubmitting || username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty)
                }
            }
            .navigationTitle("登录")
            .scrollContentBackground(.hidden)
            .background(Color(uiColor: .systemGroupedBackground))
        }
        .task {
            let savedBaseURL = UserDefaults.standard.string(forKey: "cubemax.api-base-url")
            baseURL = savedBaseURL.flatMap { APIEndpoint.normalizedString(from: $0) } ?? AppModel.defaultAPIBaseURL
        }
        .sheet(isPresented: $showServerEditor) {
            NavigationStack {
                Form {
                    Section("目标服务器") {
                        TextField("API 地址", text: $serverDraft)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .baseURL)
                        Text("默认连接 https://max.sh.creativone.cn。自定义地址仅用于开发和测试。")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Section {
                        Button("恢复官方服务器") {
                            serverDraft = AppModel.defaultAPIBaseURL
                        }
                    }
                }
                .navigationTitle("服务器设置")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("取消") { showServerEditor = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("保存") {
                            guard let normalized = APIEndpoint.normalizedString(from: serverDraft) else {
                                localError = "API 地址无效，请检查服务器地址"
                                return
                            }
                            baseURL = normalized
                            UserDefaults.standard.set(normalized, forKey: "cubemax.api-base-url")
                            showServerEditor = false
                        }
                    }
                }
            }
            .presentationDetents([.medium])
        }
    }

    private func submit() {
        focusedField = nil
        isSubmitting = true
        localError = nil
        Task {
            do {
                try await model.login(username: username.trimmingCharacters(in: .whitespacesAndNewlines), password: password, baseURL: baseURL.trimmingCharacters(in: .whitespacesAndNewlines))
            } catch {
                localError = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}
