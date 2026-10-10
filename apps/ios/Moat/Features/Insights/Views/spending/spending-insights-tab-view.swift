import SwiftUI

struct SpendingInsightsTabView: View {
    @ObservedObject var viewModel: SpendingInsightsViewModel
    let period: InsightsPeriod

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading spending...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh(period: period) }
                }
            }
        }
    }

    private var loadedContent: some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            SpendingSummarySection(
                totalSpend: viewModel.totalSpend,
                monthlyAverage: viewModel.monthlyAverage(for: period),
                topCategory: viewModel.topCategory,
                recurringExpensesTotal: viewModel.recurringExpensesTotal,
                showMonthlyAverage: !isInsightsWeekPeriod(period)
            )

            if showsInsightsMonthlyTrend(period) {
                SpendingTrendCard(months: viewModel.trends.months)
            }

            CategoryBreakdownSection(rows: viewModel.breakdown, period: period)

            RecurringExpensesSection(rows: viewModel.recurring)

            SpendingAnomaliesSection(rows: viewModel.anomalies)
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
    }
}

private struct SpendingTrendCard: View {
    let months: [SpendingTrendMonth]

    @State private var selectedPoint: InsightChartPoint?

    private var points: [InsightChartPoint] {
        months.suffix(12).compactMap { month in
            InsightChartPoint(id: month.id, dateString: month.month, value: month.total)
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
                title: selectedPoint == nil ? "Monthly trend" : "Selected spending",
                summary: summary,
                detail: detail
            ) {
                if points.isEmpty {
                    insightsEmptyText("No trend data yet")
                } else {
                    FinancialBarChart(
                        points: points,
                        valueLabel: "Spending",
                        xAxisStride: 2,
                        tint: MoatTheme.ColorToken.chartPrimary,
                        valueDomain: nil,
                        date: \.date,
                        value: \.value,
                        valueFormatter: FinancialChartFormatting.currency,
                        accessibilityLabel: "Monthly spending trend chart",
                        selectedPoint: $selectedPoint
                    )
                }
            }
        }
    }
}

private struct CategoryBreakdownSection: View {
    let rows: [SpendingCategoryBreakdown]
    let period: InsightsPeriod

    @AppStorage(CategoryViewStorageKey.insightsSpending) private var viewRaw = CategoryViewMode.category.rawValue

    private var isParentView: Bool {
        viewRaw == CategoryViewMode.parent.rawValue
    }

    private var parentRows: [ParentSpendRow] {
        rollupSpendByParent(
            rows: rows.map { row in
                (category: row.category, amount: row.total, parent: row.parentCategory, monthlyAvg: row.monthlyAvg)
            }
        )
    }

    private var visibleRows: [SpendingBreakdownDisplayRow] {
        if isParentView {
            return parentRows.map { row in
                SpendingBreakdownDisplayRow(
                    id: row.id,
                    label: row.label,
                    total: row.amount,
                    monthlyAvg: row.monthlyAvg,
                    percentage: row.percentage,
                    percentOfTop: row.percentOfTop,
                    categories: row.categories
                )
            }
        }
        return rows.prefix(12).map { row in
            SpendingBreakdownDisplayRow(
                id: row.category,
                label: row.category,
                total: row.total,
                monthlyAvg: row.monthlyAvg,
                percentage: row.percentage,
                percentOfTop: row.percentOfTop,
                categories: [row.category]
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
                Text("Categories")
                    .font(.headline)
                Spacer()
                CategoryViewPicker(selection: $viewRaw)
            }

            if rows.isEmpty {
                insightsEmptyText("No category spending yet")
            } else {
                MoatCard {
                    VStack(spacing: 0) {
                        ForEach(Array(visibleRows.enumerated()), id: \.element.id) { index, row in
                            Group {
                                if row.categories.isEmpty {
                                    SpendingBreakdownRow(
                                        row: row,
                                        showMonthlyAverage: showsInsightsMonthlyAverage(period)
                                    )
                                } else {
                                    NavigationLink {
                                        TransactionsView(
                                            initialFilters: transactionFilters(categories: row.categories, period: period),
                                            title: row.label
                                        )
                                    } label: {
                                        SpendingBreakdownRow(
                                            row: row,
                                            showMonthlyAverage: showsInsightsMonthlyAverage(period)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }

                            if index < visibleRows.count - 1 {
                                Divider()
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct SpendingBreakdownDisplayRow: Identifiable {
    let id: String
    let label: String
    let total: Double
    let monthlyAvg: Double
    let percentage: Double
    let percentOfTop: Double
    let categories: [String]
}

private struct SpendingBreakdownRow: View {
    let row: SpendingBreakdownDisplayRow
    let showMonthlyAverage: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.label)
                        .font(.subheadline.weight(.semibold))
                    Text("\(String(format: "%.0f", row.percentage))% of spend")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(CurrencyFormatter.formatCompact(row.total))
                        .font(.subheadline.weight(.semibold))
                    if showMonthlyAverage {
                        Text(CurrencyFormatter.formatCompact(row.monthlyAvg) + "/mo")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(MoatTheme.ColorToken.chartMuted)
                    Capsule()
                        .fill(MoatTheme.ColorToken.accent)
                        .frame(width: proxy.size.width * min(1, row.percentOfTop / 100))
                }
            }
            .frame(height: 7)
        }
        .padding(.vertical, MoatTheme.Spacing.medium)
        .contentShape(Rectangle())
    }
}

private struct RecurringExpensesSection: View {
    let rows: [RecurringExpense]

    private var visibleRows: [RecurringExpense] {
        Array(rows.prefix(8))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Recurring")
                .font(.headline)

            if visibleRows.isEmpty {
                insightsEmptyText("No recurring expenses detected")
            } else {
                MoatCard {
                    VStack(spacing: 0) {
                        ForEach(Array(visibleRows.enumerated()), id: \.element.id) { index, row in
                            NavigationLink {
                                TransactionsView(
                                    initialFilters: TransactionFilterState(search: row.description, type: .expense),
                                    title: row.description.capitalized
                                )
                            } label: {
                                RecurringExpenseRow(row: row)
                            }
                            .buttonStyle(.plain)

                            if index < visibleRows.count - 1 {
                                Divider()
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct RecurringExpenseRow: View {
    let row: RecurringExpense

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.description.capitalized)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text("Seen \(row.occurrences) months")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            HStack(spacing: 4) {
                Text(CurrencyFormatter.formatCompact(row.monthlyAmount))
                    .font(.subheadline.weight(.semibold))
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, MoatTheme.Spacing.small)
    }
}

private struct SpendingAnomaliesSection: View {
    let rows: [SpendingAnomaly]

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Anomalies")
                .font(.headline)

            if rows.isEmpty {
                insightsEmptyText("No unusual spending detected")
            } else {
                ForEach(rows.prefix(8)) { row in
                    NavigationLink {
                        TransactionsView(
                            initialFilters: TransactionFilterState(category: row.category, type: .expense),
                            title: "\(row.category) Anomaly"
                        )
                    } label: {
                        SpendingAnomalyRow(row: row)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct SpendingAnomalyRow: View {
    let row: SpendingAnomaly

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(MoatTheme.ColorToken.warning)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.category)
                    .font(.subheadline.weight(.semibold))
                Text("\(String(format: "%.0f", row.increasePercent))% above average")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(CurrencyFormatter.formatCompact(row.currentAmount))
                    .font(.subheadline.weight(.semibold))
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.warning.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}
