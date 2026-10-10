import SwiftUI

struct PromptTagChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(isSelected ? Color.white : MoatTheme.ColorToken.textPrimary)
                .padding(.horizontal, MoatTheme.Spacing.medium)
                .padding(.vertical, MoatTheme.Spacing.xSmall)
                .background(isSelected ? MoatTheme.ColorToken.accentStrong : MoatTheme.ColorToken.mutedSurface)
                .clipShape(Capsule())
                .overlay {
                    Capsule()
                        .strokeBorder(
                            isSelected ? Color.clear : MoatTheme.ColorToken.border,
                            lineWidth: 1
                        )
                }
        }
        .buttonStyle(.plain)
    }
}
