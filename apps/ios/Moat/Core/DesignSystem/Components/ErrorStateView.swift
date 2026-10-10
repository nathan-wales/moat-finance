import SwiftUI

/// Displays an error state with optional retry action
struct ErrorStateView: View {
    let title: String
    let message: String
    let retryAction: (() -> Void)?

    init(
        title: String = "Something went wrong",
        message: String,
        retryAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.retryAction = retryAction
    }

    init(error: Error, retryAction: (() -> Void)? = nil) {
        self.title = "Something went wrong"
        self.message = error.localizedDescription
        self.retryAction = retryAction
    }

    var body: some View {
        VStack(spacing: MoatTheme.Spacing.xLarge) {
            Image(systemName: "exclamationmark")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(MoatTheme.ColorToken.textTertiary)

            VStack(spacing: MoatTheme.Spacing.small) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .multilineTextAlignment(.center)
            }

            if let retryAction {
                Button("Try Again", action: retryAction)
                    .buttonStyle(.moatSecondary)
                    .frame(maxWidth: 200)
            }
        }
        .padding(MoatTheme.Spacing.xxLarge)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .moatPageBackground()
    }
}

// MARK: - Preview

#Preview {
    VStack {
        ErrorStateView(
            message: "Unable to load your data. Please check your connection."
        ) {}
    }
}
