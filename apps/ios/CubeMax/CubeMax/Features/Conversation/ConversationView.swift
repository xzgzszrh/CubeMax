import SwiftUI

struct ConversationView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selectedConversation: ConversationRecord?
    @State private var isCreating = false
    @State private var searchText = ""

    private var filtered: [ConversationRecord] {
        let keyword = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !keyword.isEmpty else { return model.conversations }
        return model.conversations.filter { ($0.title ?? "未命名对话").localizedCaseInsensitiveContains(keyword) || ($0.summary ?? "").localizedCaseInsensitiveContains(keyword) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if model.conversations.isEmpty && model.isLoading { LoadingView() }
                else if filtered.isEmpty { EmptyStateView(icon: "bubble.left.and.bubble.right", title: "还没有对话", message: "创建一个新对话，开始和 CubeMax 协作。") }
                else {
                    List(filtered) { conversation in
                        NavigationLink { ConversationDetailView(conversation: conversation) } label: {
                            ConversationRow(conversation: conversation)
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("对话")
            .searchable(text: $searchText, prompt: "搜索对话")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { Task { await model.loadConversations() } } label: { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel("刷新对话")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { createConversation() } label: { Image(systemName: "square.and.pencil") }
                        .accessibilityLabel("新建对话")
                }
            }
            .refreshable { await model.loadConversations() }
            .sheet(item: $selectedConversation) { conversation in
                NavigationStack { ConversationDetailView(conversation: conversation) }
            }
        }
    }

    private func createConversation() {
        guard !isCreating else { return }
        isCreating = true
        Task {
            if let conversation = try? await model.createConversation() { selectedConversation = conversation }
            isCreating = false
        }
    }
}

private struct ConversationRow: View {
    let conversation: ConversationRecord

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: conversation.isPinned ? "pin.fill" : "bubble.left.fill")
                .foregroundStyle(conversation.isPinned ? .orange : .teal)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 4) {
                Text(conversation.title ?? "未命名对话")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(conversation.summary ?? "暂无摘要")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(conversation.updatedAt.shortDate)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}

struct ConversationDetailView: View {
    @EnvironmentObject private var model: AppModel
    let conversation: ConversationRecord
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var modelId: String
    @State private var isLoading = true
    @State private var isSending = false
    @State private var errorMessage: String?

    init(conversation: ConversationRecord) {
        self.conversation = conversation
        _modelId = State(initialValue: conversation.modelId ?? UserDefaults.standard.string(forKey: "cubemax.default-model-id") ?? "")
    }

    var body: some View {
        VStack(spacing: 0) {
            if modelId.isEmpty {
                modelIdField
            }
            if isLoading {
                ProgressView("正在加载消息…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if messages.isEmpty {
                EmptyStateView(icon: "text.bubble", title: "开始一段新对话", message: "在下方输入内容发送给 AI。")
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 14) {
                            ForEach(messages) { message in
                                MessageBubble(message: message).id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) { _, _ in
                        if let id = messages.last?.id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } }
                    }
                }
            }
            composer
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(conversation.title ?? "对话")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadMessages() }
        .alert("发送失败", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("知道了") { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
    }

    private var modelIdField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("默认模型 ID")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
            TextField("输入模型 UUID", text: $modelId)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            Text("可在“我的”页面保存默认模型 ID；已有对话会自动使用服务端绑定的模型。")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal)
        .padding(.top, 10)
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 9) {
            TextField("输入消息…", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .textFieldStyle(.roundedBorder)
            Button(action: send) {
                if isSending { ProgressView().frame(width: 18, height: 18) }
                else { Image(systemName: "arrow.up.circle.fill").font(.title2) }
            }
            .disabled(isSending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || modelId.isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private func loadMessages() async {
        do { messages = try await model.loadMessages(for: conversation.id) }
        catch { errorMessage = error.localizedDescription }
        isLoading = false
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !modelId.isEmpty else { return }
        draft = ""
        isSending = true
        Task {
            do {
                UserDefaults.standard.set(modelId, forKey: "cubemax.default-model-id")
                _ = try await model.sendMessage(text, conversation: conversation, modelId: modelId)
                messages = try await model.loadMessages(for: conversation.id)
            } catch { errorMessage = error.localizedDescription; draft = text }
            isSending = false
        }
    }
}

private struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 5) {
                Text(message.role == "user" ? "你" : "CubeMax")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(message.text.isEmpty ? "（无文本内容）" : message.text)
                    .textSelection(.enabled)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 10)
            .background(message.role == "user" ? Color.indigo.opacity(0.14) : Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            if message.role != "user" { Spacer(minLength: 40) }
        }
    }
}

private extension String {
    var shortDate: String {
        guard let date = ISO8601DateFormatter().date(from: self) else { return "" }
        return date.formatted(.dateTime.month(.twoDigits).day(.twoDigits))
    }
}
