import SwiftUI

struct FeedbackSheet: View {
    @StateObject private var viewModel: FeedbackViewModel
    @SwiftUI.Environment(\.dismiss) private var dismiss

    init(route: String, initialMessage: String = "") {
        _viewModel = StateObject(
            wrappedValue: FeedbackViewModel(route: route, initialMessage: initialMessage)
        )
    }

    var body: some View {
        MoatGlassSheet(
            title: sheetTitle,
            showsCloseButton: showsCloseButton,
            verticallyCentersContent: isSuccess
        ) {
            Group {
                switch viewModel.submitState {
                case .success:
                    successContent
                default:
                    formContent
                }
            }
        } footer: {
            Group {
                switch viewModel.submitState {
                case .success:
                    Button {
                        dismiss()
                    } label: {
                        Text("Close").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)
                default:
                    Button {
                        HapticFeedback.saveOrSubmit()
                        Task { await viewModel.submit() }
                    } label: {
                        HStack(spacing: MoatTheme.Spacing.small) {
                            if case .submitting = viewModel.submitState {
                                ProgressView()
                            }
                            Text("Send Feedback").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.moatPrimary)
                    .disabled(!viewModel.canSubmit)
                }
            }
        }
    }

    private var isSuccess: Bool {
        if case .success = viewModel.submitState {
            return true
        }
        return false
    }

    private var sheetTitle: String {
        isSuccess ? "" : "What happened?"
    }

    private var showsCloseButton: Bool {
        !isSuccess
    }

    private var successContent: some View {
        VStack(alignment: .center, spacing: MoatTheme.Spacing.large) {
            Image(systemName: "checkmark")
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(MoatTheme.ColorToken.positive)
                .accessibilityHidden(true)

            VStack(spacing: MoatTheme.Spacing.small) {
                Text("Thanks for your feedback!")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)

                Text("We appreciate you taking the time to help us improve Moat Finance.")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var formContent: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            VStack(alignment: .trailing, spacing: MoatTheme.Spacing.small) {
                MoatTextEditor(
                    text: $viewModel.message,
                    minHeight: 140,
                    disabled: isFormDisabled
                )
                .onChange(of: viewModel.message) { newValue in
                    if newValue.count > FeedbackConstants.maxMessageLength {
                        viewModel.message = String(newValue.prefix(FeedbackConstants.maxMessageLength))
                    }
                }

                Text(viewModel.characterCountLabel)
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .monospacedDigit()
            }

            Text(FeedbackConstants.privacyText)
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)

            if case .error(let message) = viewModel.submitState {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.destructive)
            }
        }
    }

    private var isFormDisabled: Bool {
        if case .submitting = viewModel.submitState {
            return true
        }
        return false
    }
}
