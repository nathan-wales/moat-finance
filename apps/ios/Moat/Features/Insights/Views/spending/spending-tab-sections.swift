import SwiftUI

struct SpendingSummarySection: View {
    let totalSpend: Double
    let monthlyAverage: Double
    let topCategory: SpendingCategoryBreakdown?
    let recurringExpensesTotal: Double
    var showMonthlyAverage: Bool = true

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Total Spending")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.formatCompact(totalSpend))
                        .font(.largeTitle.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                HStack(alignment: .top) {
                    if showMonthlyAverage {
                        SpendingSummaryMetric(
                            title: "Monthly Average",
                            value: CurrencyFormatter.formatCompact(monthlyAverage)
                        )
                    }
                    SpendingSummaryMetric(
                        title: "Top Category",
                        value: topCategory?.category ?? "—",
                        subtitle: topCategory.map { CurrencyFormatter.formatCompact($0.total) }
                    )
                    SpendingSummaryMetric(
                        title: "Recurring Expenses",
                        value: CurrencyFormatter.formatCompact(recurringExpensesTotal)
                    )
                }
            }
        }
    }
}

private struct SpendingSummaryMetric: View {
    let title: String
    let value: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let subtitle {
                Text(subtitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
