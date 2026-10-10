import SwiftUI

struct AppLockedView: View {
    @ObservedObject private var appLockManager = AppLockManager.shared

    @State private var isAuthenticating = false
    @State private var isSigningOut = false
    @State private var showsManualActions = false

    var body: some View {
        ZStack {
            MoatSplashView()
                .accessibilityLabel("Moat is locked")

            if showsManualActions && !isAuthenticating {
                VStack(spacing: MoatTheme.Spacing.medium) {
                    Spacer()

                    Button(action: { Task { await attemptUnlock() } }) {
                        Text(appLockManager.biometryType.unlockButtonTitle)
                    }
                    .buttonStyle(.moatPrimary)
                    .disabled(isSigningOut)

                    Button(action: { Task { await signOut() } }) {
                        if isSigningOut {
                            ProgressView()
                                .tint(MoatTheme.ColorToken.textPrimary)
                        } else {
                            Text("Sign out")
                        }
                    }
                    .buttonStyle(.moatSecondary)
                    .disabled(isSigningOut)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(MoatTheme.Spacing.xLarge)
            }
        }
        .task(id: appLockManager.unlockAttemptID) {
            showsManualActions = false
            await attemptUnlock()
        }
    }

    private func attemptUnlock() async {
        guard !isAuthenticating else { return }

        isAuthenticating = true
        defer { isAuthenticating = false }

        do {
            try await appLockManager.unlock()
        } catch let error as BiometricAuthError {
            switch error {
            case .userCancelled, .userFallback, .systemCancelled:
                showsManualActions = true
            case .biometryLockout:
                showsManualActions = true
            default:
                showsManualActions = true
                if error.forcesSignOut {
                    await appLockManager.handleBiometricUnavailable()
                }
            }
        } catch {
            showsManualActions = true
        }
    }

    private func signOut() async {
        guard !isSigningOut else { return }

        isSigningOut = true
        defer { isSigningOut = false }

        await AuthManager.shared.signOut(reason: "lock_screen_user_requested")
    }
}

#Preview {
    AppLockedView()
}
