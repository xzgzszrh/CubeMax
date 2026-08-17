import SwiftUI

struct TriggersView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selectedTrigger: ProgrammingTriggerItem?
    @State private var isCreating = false
    @State private var searchText = ""

    private var filteredTriggers: [ProgrammingTriggerItem] {
        let keyword = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !keyword.isEmpty else { return model.triggers }
        return model.triggers.filter { $0.name.localizedCaseInsensitiveContains(keyword) || $0.project.name.localizedCaseInsensitiveContains(keyword) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if model.triggers.isEmpty && model.isLoading { LoadingView() }
                else if filteredTriggers.isEmpty { EmptyStateView(icon: "bolt.slash", title: "没有触发器", message: "创建一个表单触发器，快速运行你的编程工程。") }
                else {
                    List(filteredTriggers) { trigger in
                        Button { selectedTrigger = trigger } label: { TriggerRow(trigger: trigger) }
                            .buttonStyle(.plain)
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("触发器")
            .searchable(text: $searchText, prompt: "搜索触发器")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { Task { await model.loadTriggers() } } label: { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel("刷新触发器")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { isCreating = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel("新建触发器")
                }
            }
            .refreshable { await model.loadTriggers() }
            .sheet(item: $selectedTrigger) { trigger in TriggerFormView(trigger: trigger) }
            .sheet(isPresented: $isCreating) { CreateTriggerView() }
        }
    }
}

private struct TriggerRow: View {
    let trigger: ProgrammingTriggerItem

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: trigger.isEnabled ? "bolt.fill" : "bolt.slash")
                .font(.title3)
                .foregroundStyle(trigger.isEnabled ? .indigo : .secondary)
                .frame(width: 30, height: 30)
                .background((trigger.isEnabled ? Color.indigo : Color.secondary).opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(trigger.name).font(.subheadline.weight(.semibold))
                    if trigger.isPinned { Image(systemName: "pin.fill").font(.caption2).foregroundStyle(.orange) }
                }
                Text("\(trigger.project.name) · \(trigger.fieldCount) 个输入")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 5)
    }
}
