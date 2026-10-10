import SwiftUI

/// Lays inline rule tokens out as wrapping prose, with an optional trailing
/// control (usually remove) parked outside the wrapping flow so it can never
/// force the sentence back into fixed columns.
struct InlineRuleSentence<Content: View, Trailing: View>: View {
    private let accessibilityLabel: String
    private let content: Content
    private let trailing: Trailing

    init(
        accessibilityLabel: String,
        @ViewBuilder content: () -> Content,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.accessibilityLabel = accessibilityLabel
        self.content = content()
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .top, spacing: MoatTheme.Spacing.small) {
            MoatFlowLayout(horizontalSpacing: InlineRuleTokenMetrics.tokenSpacing) {
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(accessibilityLabel)

            trailing
                .padding(.top, InlineRuleTokenMetrics.verticalPadding)
        }
    }
}

extension InlineRuleSentence where Trailing == EmptyView {
    init(accessibilityLabel: String, @ViewBuilder content: () -> Content) {
        self.init(
            accessibilityLabel: accessibilityLabel,
            content: content,
            trailing: { EmptyView() }
        )
    }
}
