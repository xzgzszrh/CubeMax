import SwiftUI

@main
struct CubeMaxApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .tint(.indigo)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack(alignment: .top) {
            Group {
                if model.isBootstrapping {
                    ProgressView("正在连接 CubeMax…")
                } else if !model.isAuthenticated {
                    LoginView()
                } else {
                    MainTabView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if let error = model.errorMessage {
                ErrorBanner(message: error) { model.clearError() }
                    .padding(.horizontal)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.errorMessage)
        .fullScreenCover(isPresented: $model.cameraPresented) {
            CameraPreviewView()
                .environmentObject(model)
        }
        .alert(model.consentTitle, isPresented: $model.consentPresented) {
            Button("拒绝", role: .cancel) { model.denyCameraConsent() }
            Button("授权") { model.approveCameraConsent() }
        } message: {
            Text(model.consentMessage)
        }
        .onChange(of: scenePhase) { _, phase in
            model.handleScenePhase(phase)
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("首页", systemImage: "house.fill") }
            ConversationView()
                .tabItem { Label("对话", systemImage: "bubble.left.and.bubble.right.fill") }
            TriggersView()
                .tabItem { Label("触发器", systemImage: "bolt.fill") }
            ProfileView()
                .tabItem { Label("我的", systemImage: "person.crop.circle.fill") }
        }
    }
}

struct ErrorBanner: View {
    let message: String
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
                .font(.footnote)
                .lineLimit(2)
            Spacer(minLength: 4)
            Button(action: dismiss) { Image(systemName: "xmark") }
                .buttonStyle(.plain)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(.red.opacity(0.92), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.16), radius: 10, y: 4)
    }
}

struct LoadingView: View {
    var body: some View {
        ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(uiColor: .systemGroupedBackground))
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: icon)
        } description: {
            Text(message)
        }
    }
}
