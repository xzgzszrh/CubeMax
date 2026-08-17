import SwiftUI

struct CreateTriggerView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var projectId = ""
    @State private var isPinned = false
    @State private var isSaving = false
    @State private var localError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("基本信息") {
                    TextField("触发器名称", text: $name)
                    TextField("描述（可选）", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                    Toggle("添加到首页快捷触发", isOn: $isPinned)
                }
                Section("绑定工程") {
                    if model.projects.isEmpty {
                        HStack { ProgressView(); Text("正在读取已发布工程…").foregroundStyle(.secondary) }
                    } else {
                        Picker("编程工程", selection: $projectId) {
                            Text("请选择").tag("")
                            ForEach(model.projects) { project in
                                Text(project.name).tag(project.id)
                            }
                        }
                    }
                    Text("只有已发布的工程可以作为触发器目标。表单字段会自动读取主流程输入。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let localError {
                    Section { Label(localError, systemImage: "exclamationmark.circle").foregroundStyle(.red) }
                }
            }
            .navigationTitle("新建触发器")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("创建") { save() }
                        .disabled(isSaving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || projectId.isEmpty)
                }
            }
            .task { await model.loadProjects() }
        }
    }

    private func save() {
        isSaving = true
        localError = nil
        Task {
            do {
                try await model.createTrigger(name: name.trimmingCharacters(in: .whitespacesAndNewlines), description: description.isEmpty ? nil : description, projectId: projectId, pinned: isPinned)
                dismiss()
            } catch { localError = error.localizedDescription }
            isSaving = false
        }
    }
}
