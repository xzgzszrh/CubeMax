import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selectedTrigger: ProgrammingTriggerItem?

    private var pinnedTriggers: [ProgrammingTriggerItem] {
        model.triggers
            .filter { $0.isPinned && $0.isEnabled }
            .sorted { $0.homeOrder == $1.homeOrder ? $0.updatedAt > $1.updatedAt : $0.homeOrder < $1.homeOrder }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    quickActions
                    overview
                }
                .padding(.horizontal)
                .padding(.top, 12)
                .padding(.bottom, 28)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("首页")
            .refreshable { await model.loadDashboard() }
            .sheet(item: $selectedTrigger) { trigger in
                TriggerFormView(trigger: trigger)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(greeting)
                .font(.title2.weight(.bold))
            HStack(spacing: 6) {
                Image(systemName: "square.stack.3d.up.fill")
                Text(model.selectedWorkspaceName)
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("快捷触发")
                    .font(.headline)
                Spacer()
                if model.isLoading { ProgressView().controlSize(.small) }
            }
            if pinnedTriggers.isEmpty {
                HStack(spacing: 12) {
                    Image(systemName: "bolt.circle")
                        .font(.title2)
                        .foregroundStyle(.indigo)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("还没有首页快捷触发器")
                            .font(.subheadline.weight(.medium))
                        Text("在触发器页面将常用工程置顶")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(pinnedTriggers) { trigger in
                        Button { selectedTrigger = trigger } label: {
                            VStack(alignment: .leading, spacing: 12) {
                                Image(systemName: "bolt.fill")
                                    .foregroundStyle(.indigo)
                                Text(trigger.name)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                Text(trigger.project.name)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, minHeight: 102, alignment: .leading)
                            .padding(14)
                            .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var overview: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("概览")
                .font(.headline)
            HStack(spacing: 12) {
                OverviewCard(icon: "bolt.fill", color: .indigo, value: "\(model.triggers.count)", label: "触发器")
                OverviewCard(icon: "bubble.left.fill", color: .teal, value: "\(model.conversations.count)", label: "对话")
            }
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let prefix = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"
        return "\(prefix)，\(model.user?.displayName ?? "CubeMax 用户")"
    }
}

struct OverviewCard: View {
    let icon: String
    let color: Color
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Image(systemName: icon).foregroundStyle(color)
            Text(value).font(.title2.weight(.bold))
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
