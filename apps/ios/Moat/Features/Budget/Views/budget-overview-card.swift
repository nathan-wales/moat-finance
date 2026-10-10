import SwiftUI

struct BudgetOverviewCard: View {
    let pageData: BudgetPageData

    private var hasBudgets: Bool {
        pageData.totalBudget > 0
    }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                header

                if hasBudgets {
                    filledContent
                } else {
                    emptyContent
                }
            }
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                Text("This Month Overview")
                    .font(.headline)
                Text("Day \(pageData.dayOfMonth) of \(pageData.daysInMonth)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: MoatTheme.Spacing.medium)

            Text(pageData.status.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(pageData.status.color)
                .padding(.horizontal, MoatTheme.Spacing.medium)
                .padding(.vertical, MoatTheme.Spacing.small)
                .background(pageData.status.color.opacity(0.12))
                .clipShape(Capsule())
        }
    }

    private var filledContent: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                HStack {
                    Text("\(CurrencyFormatter.formatCompact(pageData.actualSpent)) spent")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(CurrencyFormatter.formatCompact(pageData.totalBudget)) budget")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(MoatTheme.ColorToken.chartMuted)
                        Capsule()
                            .fill(pageData.status.color)
                            .frame(width: proxy.size.width * min(1, pageData.progressPercent / 100))
                    }
                }
                .frame(height: 10)
            }

            HStack(alignment: .top, spacing: MoatTheme.Spacing.large) {
                BudgetOverviewStat(label: "Spent", value: CurrencyFormatter.formatCompact(pageData.actualSpent))
                BudgetOverviewStat(label: "Total Budget", value: CurrencyFormatter.formatCompact(pageData.totalBudget))
                BudgetOverviewStat(label: "Remaining", value: CurrencyFormatter.formatCompact(pageData.remaining))
            }

            Text(pageData.statusMessage)
                .font(.subheadline)
                .foregroundStyle(pageData.status.color)
        }
    }

    private var emptyContent: some View {
        Text("No budgets set yet. Click on a category below to set your first budget.")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, MoatTheme.Spacing.xLarge)
    }
}

private struct BudgetOverviewStat: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
