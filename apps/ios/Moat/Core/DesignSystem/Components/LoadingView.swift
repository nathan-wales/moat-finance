import SwiftUI

/// A centered loading indicator with optional message
struct LoadingView: View {
    let message: String?

    init(_ message: String? = nil) {
        self.message = message
    }

    var body: some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            ProgressView()
                .controlSize(.large)
                .tint(MoatTheme.ColorToken.textSecondary)

            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .moatPageBackground()
    }
}

// MARK: - Preview

#Preview {
    VStack {
        LoadingView()
        Divider()
        LoadingView("Loading your data...")
    }
}
