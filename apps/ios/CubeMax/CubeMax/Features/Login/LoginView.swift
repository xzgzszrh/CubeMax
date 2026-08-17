import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var model: AppModel
    @State private var username = ""
    @State private var password = ""
    @State private var baseURL = AppModel.defaultAPIBaseURL
    @State private var isSubmitting = false
    @State private var localError: String?
    @FocusState private var focusedField: Field?

    private enum Field { case username, password, baseURL }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "cube.transparent")
                            .font(.system(size: 48, weight: .medium))
                            .foregroundStyle(.indigo)
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

                Section {
                    TextField("API 地址", text: $baseURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .baseURL)
                    Text("开发环境默认使用 127.0.0.1:4090；真机调试时请改成电脑在局域网中的地址。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("服务器")
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
            baseURL = UserDefaults.standard.string(forKey: "cubemax.api-base-url") ?? AppModel.defaultAPIBaseURL
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
