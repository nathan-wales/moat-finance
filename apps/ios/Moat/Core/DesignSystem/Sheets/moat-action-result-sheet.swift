import SwiftUI

struct MoatActionResultSheet: View {
    let title: String
    let message: String
    let dismissButtonTitle: String
    let isFailure: Bool
    let onDismiss: () -> Void

    init(
        title: String,
        message: String,
        dismissButtonTitle: String = "Done",
        isFailure: Bool? = nil,
        onDismiss: @escaping () -> Void
    ) {
        self.title = title
        self.message = message
        self.dismissButtonTitle = dismissButtonTitle
        self.isFailure = isFailure ?? Self.inferFailure(title: title, message: message)
        self.onDismiss = onDismiss
    }

    var body: some View {
        MoatFittedGlassSheet(title: "", extraDetentHeight: 8) {
            VStack(spacing: MoatTheme.Spacing.large) {
                Image(systemName: isFailure ? "exclamationmark.triangle.fill" : "checkmark")
                    .font(.system(size: 56, weight: .semibold))
                    .foregroundStyle(isFailure ? MoatTheme.ColorToken.destructive : MoatTheme.ColorToken.positive)
                    .accessibilityHidden(true)

                VStack(spacing: MoatTheme.Spacing.small) {
                    Text(title)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, MoatTheme.Spacing.small)
            .accessibilityElement(children: .combine)
        } footer: {
            Button(action: onDismiss) {
                Text(dismissButtonTitle).frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
        }
    }

    private static func inferFailure(title: String, message: String) -> Bool {
        let combined = "\(title) \(message)".lowercased()
        return combined.contains("fail")
            || combined.contains("error")
            || combined.contains("could not")
            || combined.contains("couldn't")
            || combined.contains("unable")
            || combined.contains("invalid")
            || combined.contains("required")
            || combined.contains("denied")
            || combined.contains("unavailable")
            || combined.contains("went wrong")
    }
}
