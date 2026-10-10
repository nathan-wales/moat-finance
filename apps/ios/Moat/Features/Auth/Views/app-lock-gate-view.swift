import SwiftUI

struct AppLockGateView<Content: View>: View {
    @ObservedObject private var appLockManager = AppLockManager.shared
    @ObservedObject private var authManager = AuthManager.shared
    @AppStorage(DemoModeDefaults.sessionKey) private var demoSessionKey = ""

    @ViewBuilder private let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        ZStack {
            if shouldShowFinancialContent {
                content()
            }

            if appLockManager.isPrivacyOverlayVisible {
                PrivacyOverlayView()
            }

            if shouldShowLockScreen {
                AppLockedView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: appLockManager.isLocked)
        .onChange(of: authManager.state) { newState in
            if newState == .signedIn {
                appLockManager.prepareForAuthenticatedSession()
            }
        }
        .onAppear {
            if authManager.state == .signedIn {
                appLockManager.prepareForAuthenticatedSession()
            }
        }
    }

    private var isDemoMode: Bool {
        !demoSessionKey.isEmpty
    }

    private var shouldShowLockScreen: Bool {
        !isDemoMode && appLockManager.isEnabled && appLockManager.isLocked
    }

    private var shouldShowFinancialContent: Bool {
        !shouldShowLockScreen
    }
}

struct PrivacyOverlayView: View {
    var body: some View {
        MoatSplashView()
            .accessibilityLabel("Moat is locked")
    }
}

#Preview {
    AppLockGateView {
        Text("Financial content")
    }
}
