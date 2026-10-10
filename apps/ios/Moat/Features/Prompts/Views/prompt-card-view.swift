import SwiftUI

struct PromptPinButton: View {
    let isPinned: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            Image(systemName: isPinned ? "pin.fill" : "pin")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(
                    isPinned
                        ? MoatTheme.ColorToken.accentStrong
                        : MoatTheme.ColorToken.textSecondary
                )
                .frame(width: 28, height: 28)
                .background(.ultraThinMaterial, in: Circle())
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isPinned ? "Unpin prompt" : "Pin prompt")
        .help(isPinned ? "Unpin prompt" : "Pin prompt")
    }
}

struct PromptCardView: View {
    let prompt: AiPrompt
    let previewText: String
    var launchCount: Int = 0

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                Text(prompt.title)
                    .font(.headline)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.trailing, MoatTheme.Spacing.xLarge)

                Text(previewText)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack(alignment: .center) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: MoatTheme.Spacing.xSmall) {
                            ForEach(prompt.tags) { tag in
                                Text(tag.displayTitle)
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                                    .padding(.horizontal, MoatTheme.Spacing.small)
                                    .padding(.vertical, 4)
                                    .background(MoatTheme.ColorToken.mutedSurface)
                                    .clipShape(Capsule())
                            }
                        }
                    }

                    Spacer(minLength: MoatTheme.Spacing.small)

                    Text(launchCount == 1 ? "1 launch" : "\(launchCount) launches")
                        .font(.caption)
                        .foregroundStyle(MoatTheme.ColorToken.textTertiary)
                }
            }
        }
    }
}
