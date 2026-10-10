import SwiftUI

enum InlineRuleTokenMetrics {
    /// Padding is what turns a compact word into a comfortable tap target.
    static let verticalPadding: CGFloat = 8
    static let tapTargetHeight: CGFloat = 40
    static let minimumTokenWidth: CGFloat = 56
    /// Gap between prose tokens in a rule sentence.
    static let tokenSpacing: CGFloat = 7
    /// Gap between a leading field icon and its label.
    static let iconSpacing: CGFloat = 5
    /// One point above `.subheadline` so inline rule prose stays readable.
    static let font: Font = .callout
    static let textStyle: UIFont.TextStyle = .callout

    /// Shared first-text baseline for every inline rule token, measured from the
    /// top of the padded tap target so empty text fields don't sink in the row.
    static var alignedFirstTextBaseline: CGFloat {
        verticalPadding + UIFont.preferredFont(forTextStyle: textStyle).ascender
    }
}

/// The visible part of a picker token: optional leading icon, selectable words,
/// and a compact up/down chevron — all sharing one dotted underline.
struct InlineRuleTokenLabel: View {
    let title: String
    var systemImage: String?
    var isPlaceholder = false
    var isActive = false
    var showsChevron = true

    private var textColor: Color {
        isPlaceholder ? MoatTheme.ColorToken.textTertiary : MoatTheme.ColorToken.textPrimary
    }

    private var underlineColor: Color {
        isActive ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.textTertiary
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: InlineRuleTokenMetrics.iconSpacing) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.caption)
                    .foregroundStyle(textColor.opacity(0.7))
                    .accessibilityHidden(true)
            }

            Text(title)
                .font(InlineRuleTokenMetrics.font)
                .foregroundStyle(textColor)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            if showsChevron {
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption2)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .accessibilityHidden(true)
            }
        }
        .moatDottedUnderline(color: underlineColor, isActive: isActive)
        .padding(.vertical, InlineRuleTokenMetrics.verticalPadding)
        .frame(minHeight: InlineRuleTokenMetrics.tapTargetHeight, alignment: .topLeading)
        .alignmentGuide(.firstTextBaseline) { _ in
            InlineRuleTokenMetrics.alignedFirstTextBaseline
        }
        .contentShape(Rectangle())
    }
}
