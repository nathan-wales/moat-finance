import SwiftUI

/// A connector word inside a rule sentence — never underlined, never tappable.
struct InlineRuleStaticText: View {
    let text: String
    var systemImage: String?

    init(_ text: String, systemImage: String? = nil) {
        self.text = text
        self.systemImage = systemImage
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: InlineRuleTokenMetrics.iconSpacing) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.caption2)
                    .accessibilityHidden(true)
            }
            Text(text)
                .font(InlineRuleTokenMetrics.font)
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        .padding(.vertical, InlineRuleTokenMetrics.verticalPadding)
        .frame(minHeight: InlineRuleTokenMetrics.tapTargetHeight, alignment: .topLeading)
        .alignmentGuide(.firstTextBaseline) { _ in
            InlineRuleTokenMetrics.alignedFirstTextBaseline
        }
    }
}
