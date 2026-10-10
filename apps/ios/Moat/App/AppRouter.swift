import SwiftUI

/// Root view that routes based on authentication state
struct AppRouter: View {
    
    @ObservedObject private var authManager = AuthManager.shared
    @AppStorage(DemoModeDefaults.sessionKey) private var demoSessionKey = ""
    
    var body: some View {
        Group {
            switch authManager.state {
            case .loading:
                AuthLoadingView()
                
            case .signedOut:
                if demoSessionKey.isEmpty {
                    LoginView()
                } else {
                    AppShellView()
                }
                
            case .signedIn:
                AppLockGateView {
                    OnboardingGateView()
                }

            case .requiresTwoFactor:
                LoginView()
                
            case .error:
                // Show login on auth error, allowing retry
                if demoSessionKey.isEmpty {
                    LoginView()
                } else {
                    AppShellView()
                }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.state)
        .onChange(of: authManager.state) { newState in
            AppLogger.info("Auth state changed", metadata: ["state": newState.loggingName])
        }
    }
}

private extension AuthState {
    var loggingName: String {
        switch self {
        case .loading: "loading"
        case .signedOut: "signed_out"
        case .signedIn: "signed_in"
        case .requiresTwoFactor: "requires_two_factor"
        case .error: "error"
        }
    }
}

// MARK: - Preview

#Preview {
    AppRouter()
}
