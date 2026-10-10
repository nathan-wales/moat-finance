import SwiftUI
import AuthenticationServices

/// Login screen for email/password authentication
struct LoginView: View {

    @StateObject private var viewModel = AuthViewModel()
    @FocusState private var focusedField: Field?
    @SwiftUI.Environment(\.colorScheme) private var colorScheme

    private enum Field {
        case name
        case email
        case password
        case confirmPassword
        case twoFactorToken
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: MoatTheme.Spacing.xxLarge) {
                    VStack(spacing: MoatTheme.Spacing.large) {
                        MoatMark(size: 72)

                        VStack(spacing: MoatTheme.Spacing.small) {
                            Text("Moat Finance")
                                .font(.system(.largeTitle, design: .rounded).weight(.semibold))
                                .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                            Text(viewModel.mode == .signIn ? "Sign in to access your finances" : "Create your account")
                                .font(.subheadline)
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        }
                    }
                    .padding(.top, MoatTheme.Spacing.xxxLarge)

                    VStack(spacing: MoatTheme.Spacing.large) {
                        if viewModel.step == .credentials {
                            credentialsFields

                            if viewModel.mode == .register {
                                termsAgreementRow
                            }
                        } else {
                            twoFactorFields
                        }

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(MoatTheme.ColorToken.destructive)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button {
                            HapticFeedback.saveOrSubmit()
                            Task { await viewModel.submitPrimaryAction() }
                        } label: {
                            if viewModel.isLoading {
                                ProgressView()
                                    .tint(MoatTheme.ColorToken.inkInverse)
                            } else {
                                Text(viewModel.primaryButtonTitle)
                            }
                        }
                        .buttonStyle(.moatPrimary)
                        .disabled(!viewModel.isValid || viewModel.isLoading)

                        if viewModel.step == .twoFactor {
                            Button("Use a different sign-in method") {
                                viewModel.cancelTwoFactor()
                            }
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                            .disabled(viewModel.isLoading)
                        }

                        if viewModel.step == .credentials {
                            HStack(spacing: MoatTheme.Spacing.medium) {
                                Rectangle()
                                    .fill(MoatTheme.ColorToken.border)
                                    .frame(height: 1)

                                Text("or")
                                    .font(.footnote)
                                    .foregroundStyle(MoatTheme.ColorToken.textTertiary)

                                Rectangle()
                                    .fill(MoatTheme.ColorToken.border)
                                    .frame(height: 1)
                            }
                            .padding(.vertical, MoatTheme.Spacing.xSmall)

                            Button {
                                Task { await viewModel.signInWithGoogle() }
                            } label: {
                                HStack(spacing: MoatTheme.Spacing.small) {
                                    Image("GoogleLogo")
                                        .resizable()
                                        .scaledToFit()
                                        .frame(width: 20, height: 20)
                                    Text("Continue with Google")
                                }
                                .font(.system(size: 19, weight: .semibold))
                                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                                .frame(maxWidth: .infinity)
                                .frame(height: MoatTheme.Size.buttonHeight)
                                .background(MoatTheme.ColorToken.surface)
                                .clipShape(Capsule())
                                .overlay {
                                    Capsule().strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
                                }
                            }
                            .buttonStyle(.plain)
                            .opacity(viewModel.isLoading ? 0.4 : 1)
                            .disabled(viewModel.isLoading)

                            SignInWithAppleButton(.continue) { request in
                                request.requestedScopes = [.fullName, .email]
                            } onCompletion: { result in
                                Task { await viewModel.signInWithApple(result) }
                            }
                            .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                            .frame(height: MoatTheme.Size.buttonHeight)
                            .clipShape(Capsule())
                            .id(colorScheme)
                            .disabled(viewModel.isLoading)

                            Button {
                                Task { await viewModel.startDemoMode() }
                            } label: {
                                HStack(spacing: MoatTheme.Spacing.small) {
                                    Image(systemName: "sparkles")
                                        .font(.subheadline)
                                    Text("Try demo mode")
                                }
                            }
                            .buttonStyle(.moatSecondary)
                            .disabled(viewModel.isLoading)

                            Button(viewModel.mode == .signIn ? "Create an account" : "I already have an account") {
                                viewModel.switchMode()
                            }
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                            .padding(.top, MoatTheme.Spacing.small)
                            .disabled(viewModel.isLoading)
                        }
                    }
                    .padding(.horizontal, MoatTheme.Spacing.xLarge)

                    Spacer(minLength: MoatTheme.Spacing.xxxLarge)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .moatKeyboardDismissToolbar()
            .moatPageBackground()
            .onChange(of: viewModel.email) { _ in
                viewModel.clearError()
            }
            .onChange(of: viewModel.password) { _ in
                viewModel.clearError()
            }
            .onChange(of: viewModel.confirmPassword) { _ in
                viewModel.clearError()
            }
            .onChange(of: viewModel.twoFactorToken) { _ in
                viewModel.clearError()
            }
        }
    }

    private var credentialsFields: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            if viewModel.mode == .register {
                formField(title: "Name") {
                    TextField("", text: $viewModel.name, prompt: Text.moatPlaceholder("Your name"))
                        .textFieldStyle(.plain)
                        .moatInputFieldStyle(isFocused: focusedField == .name)
                        .textContentType(.name)
                        .focused($focusedField, equals: .name)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .email }
                }
            }

            formField(title: "Email") {
                TextField("", text: $viewModel.email, prompt: Text.moatPlaceholder("you@example.com"))
                    .textFieldStyle(.plain)
                    .moatInputFieldStyle(isFocused: focusedField == .email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }
            }

            formField(title: "Password") {
                SecureField("Enter your password", text: $viewModel.password)
                    .textFieldStyle(.plain)
                    .moatInputFieldStyle(isFocused: focusedField == .password)
                    .textContentType(viewModel.mode == .signIn ? .password : .newPassword)
                    .focused($focusedField, equals: .password)
                    .submitLabel(viewModel.mode == .signIn ? .go : .next)
                    .onSubmit {
                        if viewModel.mode == .signIn {
                            Task { await viewModel.signIn() }
                        } else {
                            focusedField = .confirmPassword
                        }
                    }
            }

            if viewModel.mode == .register {
                formField(title: "Confirm password") {
                    SecureField("Re-enter your password", text: $viewModel.confirmPassword)
                        .textFieldStyle(.plain)
                        .moatInputFieldStyle(isFocused: focusedField == .confirmPassword)
                        .textContentType(.newPassword)
                        .focused($focusedField, equals: .confirmPassword)
                        .submitLabel(.go)
                        .onSubmit { Task { await viewModel.register() } }
                }
            }
        }
    }

    private var twoFactorFields: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Two-factor verification")
                    .font(.headline)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                Text("Enter the current code from your authenticator app.")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }

            TextField("", text: $viewModel.twoFactorToken, prompt: Text.moatPlaceholder("123456"))
                .textFieldStyle(.plain)
                .moatInputFieldStyle(isFocused: focusedField == .twoFactorToken)
                .font(.title3.monospacedDigit())
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .focused($focusedField, equals: .twoFactorToken)
                .onSubmit { Task { await viewModel.verifyTwoFactor() } }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func formField<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.footnote.weight(.medium))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            content()
        }
    }

    private var termsAgreementRow: some View {
        HStack(alignment: .top, spacing: MoatTheme.Spacing.small) {
            Button {
                viewModel.agreedToTerms.toggle()
            } label: {
                Image(systemName: viewModel.agreedToTerms ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(
                        viewModel.agreedToTerms
                            ? MoatTheme.ColorToken.accent
                            : MoatTheme.ColorToken.textSecondary
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Agree to Terms of Service and Privacy Policy")

            Text(
                "I agree to the [Terms of Service](https://moatfinance.ai/terms) and acknowledge the [Privacy Policy](https://moatfinance.ai/privacy)."
            )
            .font(.footnote)
            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            .tint(MoatTheme.ColorToken.accent)
            .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Preview

#Preview {
    LoginView()
}
