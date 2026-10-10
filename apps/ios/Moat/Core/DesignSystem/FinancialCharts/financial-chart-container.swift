import SwiftUI

struct FinancialChartContainer<Content: View>: View {
    let title: String?
    let summary: String?
    let detail: String?
    let content: Content

    init(
        title: String? = nil,
        summary: String? = nil,
        detail: String? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.summary = summary
        self.detail = detail
        self.content = content()
    }

    private var hasHeader: Bool {
        title != nil || summary != nil || detail != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            if hasHeader {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    header
                }
            }

            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var header: some View {
        if let title {
            Text(title)
                .font(.headline)
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .lineLimit(2)
        }

        if let summary {
            Text(summary)
                .font(.title3.weight(.semibold).monospacedDigit())
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }

        if let detail {
            Text(detail)
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .lineLimit(2)
        }
    }
}
