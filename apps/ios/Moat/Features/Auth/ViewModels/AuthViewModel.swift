import SwiftUI
import AuthenticationServices

/// View model for the login screen
@MainActor
final class AuthViewModel: ObservableObject {
    enum Mode: Equatable {
        case signIn
        case register
    }

    enum Step: Equatable {
        case credentials
        case twoFactor
    }
    
    // MARK: - Published State
    
    @Published var mode: Mode = .signIn
    @Published var step: Step = .credentials
    @Published var name: String = ""
    @Published var email: String = ""
    @Published var password: String = ""
    @Published var confirmPassword: String = ""
    @Published var agreedToTerms: Bool = false
    @Published var twoFactorToken: String = ""
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    // MARK: - Dependencies
    
    private let authManager: AuthManager
    private let demoModeService: DemoModeService
    
    // MARK: - Computed Properties
    
    var isValid: Bool {
        switch step {
        case .credentials:
            switch mode {
            case .signIn:
                return !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
            case .register:
                return !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    && !email.trimmingCharacters(in: .whitespaces).isEmpty
                    && password.count >= 8
                    && confirmPassword.count >= 8
                    && agreedToTerms
            }
        case .twoFactor:
            return twoFactorToken.trimmingCharacters(in: .whitespacesAndNewlines).count >= 6
        }
    }

    var primaryButtonTitle: String {
        switch step {
        case .credentials:
            mode == .signIn ? "Sign In" : "Create Account"
        case .twoFactor:
            "Verify Code"
        }
    }
    
    // MARK: - Initialization
    
    init(authManager: AuthManager? = nil, demoModeService: DemoModeService = DemoModeService()) {
        self.authManager = authManager ?? AuthManager.shared
        self.demoModeService = demoModeService
    }
    
    // MARK: - Actions
    
    func signIn() async {
        guard isValid else {
            errorMessage = "Please enter your email and password."
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await authManager.signIn(
                email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                password: password
            )
        } catch {
            handleAuthError(error)
        }
        
        isLoading = false
    }

    func register() async {
        guard isValid else {
            errorMessage = "Enter your name, email, and a password with at least 8 characters."
            return
        }

        guard password == confirmPassword else {
            errorMessage = "Passwords do not match."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            try await authManager.register(
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                password: password
            )
        } catch {
            handleAuthError(error)
        }

        isLoading = false
    }

    func submitPrimaryAction() async {
        switch step {
        case .credentials:
            switch mode {
            case .signIn:
                await signIn()
            case .register:
                await register()
            }
        case .twoFactor:
            await verifyTwoFactor()
        }
    }

    func verifyTwoFactor() async {
        guard isValid else {
            errorMessage = "Enter the 6-digit code from your authenticator app."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            try await authManager.verifyTwoFactor(token: twoFactorToken.trimmingCharacters(in: .whitespacesAndNewlines))
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func cancelTwoFactor() {
        twoFactorToken = ""
        step = .credentials
        authManager.cancelTwoFactorChallenge()
    }
    
    func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await authManager.signInWithGoogle()
        } catch {
            // Don't show error for user cancellation
            if let googleError = error as? GoogleSignInError,
               case .authenticationFailed(let underlying) = googleError,
               (underlying as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                // User cancelled, no error message needed
            } else {
                handleAuthError(error)
            }
        }
        
        isLoading = false
    }

    func signInWithApple(_ result: Result<ASAuthorization, Error>) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let authorization = try result.get()
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                throw AppleSignInError.invalidCredential
            }

            guard
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else {
                throw AppleSignInError.missingIdentityToken
            }

            try await authManager.signInWithApple(
                idToken: idToken,
                name: (credential.fullName?.formattedName).nilIfBlank
            )
        } catch {
            if let authorizationError = error as? ASAuthorizationError,
               authorizationError.code == .canceled {
                return
            }

            handleAuthError(error)
        }
    }

    func startDemoMode() async {
        isLoading = true
        errorMessage = nil

        do {
            _ = try await demoModeService.enterDemoMode()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func switchMode() {
        mode = mode == .signIn ? .register : .signIn
        agreedToTerms = false
        errorMessage = nil
    }
    
    func clearError() {
        errorMessage = nil
    }

    private func handleAuthError(_ error: Error) {
        if AuthError.isTwoFactorRequired(error) {
            step = .twoFactor
            twoFactorToken = ""
            errorMessage = nil
            return
        }

        errorMessage = error.localizedDescription
    }
}

enum AppleSignInError: LocalizedError {
    case invalidCredential
    case missingIdentityToken

    var errorDescription: String? {
        switch self {
        case .invalidCredential:
            return "Apple did not return a usable sign-in credential."
        case .missingIdentityToken:
            return "Apple did not return an identity token."
        }
    }
}

private extension PersonNameComponents {
    var formattedName: String {
        PersonNameComponentsFormatter().string(from: self)
    }
}

private extension Optional where Wrapped == String {
    var nilIfBlank: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }

        return value
    }
}
