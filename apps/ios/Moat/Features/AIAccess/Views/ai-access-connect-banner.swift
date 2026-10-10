import SwiftUI

struct AIAccessConnectBanner: View {
    let onConnect: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: MoatTheme.Spacing.small) {
            Text("Connect to your AI assistant")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: MoatTheme.Spacing.small)

            Button(action: onConnect) {
                Text("Connect")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.accentStrong)
                    .padding(.horizontal, MoatTheme.Spacing.medium)
                    .padding(.vertical, MoatTheme.Spacing.xSmall)
                    .background(.white)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Connect")

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss")
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
        .padding(.vertical, MoatTheme.Spacing.small)
        .background(MoatTheme.ColorToken.accentStrong)
    }
}
