import SwiftUI

/// The primary card container — quiet surface, hairline border, barely-there depth.
struct MoatCard<Content: View>: View {
    let cornerRadius: CGFloat
    let shadow: Bool
    let borderColor: Color
    let borderWidth: CGFloat
    let content: Content

    init(
        cornerRadius: CGFloat = MoatTheme.Radius.large,
        shadow: Bool = true,
        borderColor: Color = MoatTheme.ColorToken.border,
        borderWidth: CGFloat = 1,
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.shadow = shadow
        self.borderColor = borderColor
        self.borderWidth = borderWidth
        self.content = content()
    }

    var body: some View {
        content
            .padding(MoatTheme.Spacing.large)
            .moatCard(
                cornerRadius: cornerRadius,
                shadow: shadow,
                borderColor: borderColor,
                borderWidth: borderWidth
            )
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        MoatCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Net Worth")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                Text("$125,000")
                    .font(.title)
                    .fontWeight(.bold)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }

        MoatCard {
            HStack {
                Text("Investments")
                Spacer()
                Text("5 accounts")
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }
        }
    }
    .padding()
    .frame(maxHeight: .infinity)
    .moatPageBackground()
}
