import SwiftUI

struct IncomeSummarySection: View {
    let data: IncomeInsightsData?
    let monthlyAverage: Double
    var showMonthlyAverage: Bool = true

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Total Income")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.formatCompact(data?.totalIncome ?? 0))
                        .font(.largeTitle.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                HStack(alignment: .top) {
                    if showMonthlyAverage {
                        IncomeSummaryMetric(
                            title: "Monthly average",
                            value: CurrencyFormatter.formatCompact(monthlyAverage)
                        )
                    }
                    IncomeSummaryMetric(
                        title: "Recurring Income",
                        value: CurrencyFormatter.formatCompact(data?.recurringIncome ?? 0)
                    )
                    IncomeSummaryMetric(
                        title: "One-Time Income",
                        value: CurrencyFormatter.formatCompact(data?.oneTimeIncome ?? 0)
                    )
                }
            }
        }
    }
}

private struct IncomeSummaryMetric: View {
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

struct IncomeTrendSection: View {
    let data: IncomeInsightsData?

    @State private var selectedPoint: InsightChartPoint?

    private var points: [IncomeTrendPoint] {
        data?.incomeTrend ?? []
    }

    private var chartPoints: [InsightChartPoint] {
        points.suffix(12).compactMap { point in
            InsightChartPoint(id: point.id, dateString: point.date, value: point.amount)
        }
    }

    private var summary: String? {
        guard let selectedPoint else { return nil }
        return FinancialChartFormatting.currency(selectedPoint.value)
    }

    private var detail: String? {
        selectedPoint?.label
    }

    var body: some View {
        MoatCard {
            FinancialChartContainer(
                title: selectedPoint == nil ? "Income Trend" : "Selected income",
                summary: summary,
                detail: detail
            ) {
                if chartPoints.isEmpty {
                    insightsEmptyText("No income found for this period.")
                } else {
                    FinancialBarChart(
                        points: chartPoints,
                        valueLabel: "Income",
                        xAxisStride: 2,
                        tint: MoatTheme.ColorToken.chartPositive,
                        valueDomain: nil,
                        date: \.date,
                        value: \.value,
                        valueFormatter: FinancialChartFormatting.currency,
                        accessibilityLabel: "Income trend chart",
                        selectedPoint: $selectedPoint
                    )
                }
            }
        }
    }
}

struct IncomeSourcesSection: View {
    let data: IncomeInsightsData?
    let period: InsightsPeriod

    private var rows: [IncomeSourceRow] {
        Array((data?.incomeSources ?? []).sorted { $0.amount > $1.amount }.prefix(12))
    }

    private var maxAmount: Double {
        max(rows.first?.amount ?? 1, 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Income Sources")
                .font(.headline)

            if rows.isEmpty {
                insightsEmptyText("No income sources found for this period.")
            } else {
                MoatCard {
                    VStack(spacing: 0) {
                        ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                            NavigationLink {
                                TransactionsView(
                                    initialFilters: transactionFilters(
                                        search: row.source,
                                        type: .income,
                                        period: period
                                    ),
                                    title: row.source
                                )
                            } label: {
                                IncomeSourceRowView(row: row, maxAmount: maxAmount)
                            }
                            .buttonStyle(.plain)

                            if index < rows.count - 1 {
                                Divider()
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct IncomeSourceRowView: View {
    let row: IncomeSourceRow
    let maxAmount: Double

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HStack {
                Text(row.source)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Spacer()
                Text(CurrencyFormatter.formatCompact(row.amount))
                    .font(.subheadline.weight(.semibold))
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(MoatTheme.ColorToken.chartMuted)
                    Capsule()
                        .fill(MoatTheme.ColorToken.accent)
                        .frame(width: proxy.size.width * min(1, row.amount / maxAmount))
                }
            }
            .frame(height: 7)
        }
        .padding(.vertical, MoatTheme.Spacing.small)
        .contentShape(Rectangle())
    }
}

struct RecurringVsOneTimeSection: View {
    let data: IncomeInsightsData?

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Recurring vs One-Time")
                .font(.headline)

            MoatCard {
                HStack(spacing: MoatTheme.Spacing.large) {
                    RecurringOneTimeMetric(
                        title: "Recurring Income",
                        value: CurrencyFormatter.formatCompact(data?.recurringIncome ?? 0)
                    )
                    RecurringOneTimeMetric(
                        title: "One-Time Income",
                        value: CurrencyFormatter.formatCompact(data?.oneTimeIncome ?? 0)
                    )
                }
            }
        }
    }
}

private struct RecurringOneTimeMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.mutedSurface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

struct RecentIncomeSection: View {
    let data: IncomeInsightsData?
    let onSelectTransaction: (RecentIncomeTransaction) -> Void

    private let recentIncomeLimit = 15

    private var rows: [RecentIncomeTransaction] {
        Array((data?.recentIncomeTransactions ?? []).prefix(recentIncomeLimit))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Recent Income")
                .font(.headline)

            if rows.isEmpty {
                insightsEmptyText("No income found for this period.")
            } else {
                MoatCard {
                    VStack(spacing: 0) {
                        ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                            Button {
                                onSelectTransaction(row)
                            } label: {
                                RecentIncomeRow(row: row)
                            }
                            .buttonStyle(.plain)
                            if index < rows.count - 1 {
                                Divider()
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct RecentIncomeRow: View {
    let row: RecentIncomeTransaction

    var body: some View {
        HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
            Text(InsightsChartFormatting.formatShortDate(row.date))
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 88, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(row.name)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: MoatTheme.Spacing.small)

            Text("+\(CurrencyFormatter.formatCompact(row.amount))")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.positive)
        }
        .padding(.vertical, MoatTheme.Spacing.small)
    }

    private var subtitle: String {
        let account = row.accountName ?? "—"
        if let category = row.category, !category.isEmpty {
            return "\(account) · \(category)"
        }
        return account
    }
}
