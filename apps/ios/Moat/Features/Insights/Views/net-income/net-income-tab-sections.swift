import Charts
import SwiftUI

struct NetIncomeSummarySection: View {
    let data: NetIncomeInsightsData?

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Net Income")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.formatCompact(data?.netIncome ?? 0))
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(netIncomeColor)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                HStack(alignment: .top) {
                    NetIncomeSummaryMetric(
                        title: "Total Income",
                        value: CurrencyFormatter.formatCompact(data?.totalIncome ?? 0)
                    )
                    NetIncomeSummaryMetric(
                        title: "Total Spending",
                        value: CurrencyFormatter.formatCompact(data?.totalSpending ?? 0)
                    )
                    NetIncomeSummaryMetric(
                        title: "Savings Rate",
                        value: InsightsChartFormatting.formatPercent(data?.savingsRate)
                    )
                }
            }
        }
    }

    private var netIncomeColor: Color {
        guard let netIncome = data?.netIncome else {
            return MoatTheme.ColorToken.textPrimary
        }
        return netIncome >= 0 ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.destructive
    }
}

private struct NetIncomeSummaryMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct IncomeVsSpendingSection: View {
    let data: NetIncomeInsightsData?

    @State private var selectedPoint: InsightChartPoint?
    @SwiftUI.Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var points: [InsightChartPoint] {
        (data?.incomeVsSpending ?? []).suffix(12).compactMap { point in
            InsightChartPoint(
                id: point.id,
                dateString: point.date,
                value: point.income,
                secondaryValue: point.spending
            )
        }
    }

    private var domain: ClosedRange<Double> {
        let values = points.reduce(into: [Double]()) { values, point in
            values.append(point.value)
            values.append(point.secondaryValue ?? 0)
        }
        return FinancialChartSelection.paddedDomain(values: values, includeZero: true)
    }

    private var summary: String? {
        guard let selectedPoint else { return nil }
        let income = FinancialChartFormatting.currency(selectedPoint.value)
        let spending = FinancialChartFormatting.currency(selectedPoint.secondaryValue ?? 0)
        return "\(income) in · \(spending) out"
    }

    private var detail: String? {
        selectedPoint?.label
    }

    var body: some View {
        MoatCard {
            FinancialChartContainer(
                title: selectedPoint == nil ? "Income vs Spending" : "Selected month",
                summary: summary,
                detail: detail
            ) {
                if points.isEmpty {
                    insightsEmptyText("No net income data available for this period.")
                } else {
                    Chart {
                        ForEach(points) { point in
                            BarMark(
                                x: .value("Month", point.date, unit: .month),
                                y: .value("Income", point.value)
                            )
                            .foregroundStyle(MoatTheme.ColorToken.chartPositive)
                            .position(by: .value("Series", "Income"))
                            .cornerRadius(FinancialChartStyle.barCornerRadius)
                            .opacity(opacity(for: point))

                            BarMark(
                                x: .value("Month", point.date, unit: .month),
                                y: .value("Spending", point.secondaryValue ?? 0)
                            )
                            .foregroundStyle(MoatTheme.ColorToken.chartMuted)
                            .position(by: .value("Series", "Spending"))
                            .cornerRadius(FinancialChartStyle.barCornerRadius)
                            .opacity(opacity(for: point))
                        }

                        if let selectedPoint {
                            RuleMark(x: .value("Selected month", selectedPoint.date))
                                .foregroundStyle(FinancialChartStyle.selection.opacity(0.38))
                                .lineStyle(FinancialChartStyle.ruleLine)
                        }
                    }
                    .chartXAxis {
                        FinancialChartAxis.monthXAxis(stride: 2)
                    }
                    .chartYAxis {
                        FinancialChartAxis.currencyYAxis()
                    }
                    .chartYScale(domain: domain)
                    .chartPlotStyle { plotArea in
                        plotArea.padding(.horizontal, FinancialChartStyle.plotPadding)
                    }
                    .chartOverlay { proxy in
                        GeometryReader { geometry in
                            FinancialChartInteractionOverlay(
                                proxy: proxy,
                                geometry: geometry,
                                points: points,
                                date: \.date,
                                selectedPoint: $selectedPoint
                            )
                        }
                    }
                    .frame(height: FinancialChartStyle.compactHeight)
                    .animation(FinancialChartStyle.dataAnimation(reduceMotion: reduceMotion), value: points.count)
                    .animation(FinancialChartStyle.selectionAnimation(reduceMotion: reduceMotion), value: selectedPoint?.id)
                    .accessibilityLabel("Income versus spending chart")
                    .accessibilityHint(FinancialChartInteraction.accessibilityHint)
                }
            }
        }
    }

    private func opacity(for point: InsightChartPoint) -> Double {
        guard let selectedPoint else { return 0.9 }
        return selectedPoint.id == point.id ? 1 : 0.34
    }
}

struct NetIncomeTrendSection: View {
    let data: NetIncomeInsightsData?

    @State private var selectedPoint: InsightChartPoint?

    private var points: [InsightChartPoint] {
        (data?.netIncomeTrend ?? []).suffix(12).compactMap { point in
            InsightChartPoint(id: point.id, dateString: point.date, value: point.netIncome)
        }
    }

    private var summary: String? {
        guard let selectedPoint else { return nil }
        return FinancialChartFormatting.signedCurrency(selectedPoint.value)
    }

    private var detail: String? {
        selectedPoint?.label
    }

    var body: some View {
        MoatCard {
            FinancialChartContainer(
                title: selectedPoint == nil ? "Net Income Trend" : "Selected net income",
                summary: summary,
                detail: detail
            ) {
                if points.isEmpty {
                    insightsEmptyText("No net income data available for this period.")
                } else {
                    PositiveNegativeBarChart(
                        points: points,
                        valueLabel: "Net Income",
                        xAxisStride: 2,
                        date: \.date,
                        value: \.value,
                        accessibilityLabel: "Net income trend chart",
                        selectedPoint: $selectedPoint
                    )
                }
            }
        }
    }
}

struct SavingsRateSection: View {
    let data: NetIncomeInsightsData?

    @State private var selectedPoint: InsightChartPoint?
    @SwiftUI.Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var points: [InsightChartPoint] {
        (data?.savingsRateTrend ?? []).suffix(12).compactMap { point in
            guard let savingsRate = point.savingsRate else { return nil }
            return InsightChartPoint(id: point.id, dateString: point.date, value: savingsRate * 100)
        }
    }

    private var domain: ClosedRange<Double> {
        FinancialChartSelection.paddedDomain(values: points.map(\.value), includeZero: true)
    }

    private var summary: String? {
        guard let selectedPoint else { return nil }
        return FinancialChartFormatting.percent(selectedPoint.value)
    }

    private var detail: String? {
        selectedPoint?.label
    }

    var body: some View {
        MoatCard {
            FinancialChartContainer(
                title: selectedPoint == nil ? "Savings Rate" : "Selected savings rate",
                summary: summary,
                detail: detail
            ) {
                if points.isEmpty {
                    insightsEmptyText("No savings rate data available for this period.")
                } else {
                    Chart(points) { point in
                        BarMark(
                            x: .value("Month", point.date, unit: .month),
                            y: .value("Savings Rate", point.value)
                        )
                        .foregroundStyle(MoatTheme.ColorToken.chartSecondary)
                        .cornerRadius(FinancialChartStyle.barCornerRadius)
                        .opacity(opacity(for: point))
                        .accessibilityLabel(point.label)
                        .accessibilityValue(FinancialChartFormatting.percent(point.value))
                    }
                    .chartXAxis {
                        FinancialChartAxis.monthXAxis(stride: 2)
                    }
                    .chartYAxis {
                        FinancialChartAxis.percentYAxis()
                    }
                    .chartYScale(domain: domain)
                    .chartPlotStyle { plotArea in
                        plotArea.padding(.horizontal, FinancialChartStyle.plotPadding)
                    }
                    .chartOverlay { proxy in
                        GeometryReader { geometry in
                            FinancialChartInteractionOverlay(
                                proxy: proxy,
                                geometry: geometry,
                                points: points,
                                date: \.date,
                                selectedPoint: $selectedPoint
                            )
                        }
                    }
                    .frame(height: FinancialChartStyle.compactHeight)
                    .animation(FinancialChartStyle.dataAnimation(reduceMotion: reduceMotion), value: points.count)
                    .animation(FinancialChartStyle.selectionAnimation(reduceMotion: reduceMotion), value: selectedPoint?.id)
                    .accessibilityLabel("Savings rate chart")
                    .accessibilityHint(FinancialChartInteraction.accessibilityHint)
                }
            }
        }
    }

    private func opacity(for point: InsightChartPoint) -> Double {
        guard let selectedPoint else { return 0.9 }
        return selectedPoint.id == point.id ? 1 : 0.34
    }
}

struct WhereIncomeWentSection: View {
    let data: NetIncomeInsightsData?
    let period: InsightsPeriod

    @AppStorage(CategoryViewStorageKey.insightsNetIncome) private var viewRaw = CategoryViewMode.category.rawValue

    private var isParentView: Bool {
        viewRaw == CategoryViewMode.parent.rawValue
    }

    private var categoryRows: [NetIncomeSpendingBreakdownRow] {
        data?.spendingBreakdown ?? []
    }

    private var parentRows: [ParentSpendRow] {
        rollupSpendByParent(
            rows: categoryRows.map { row in
                (category: row.category, amount: row.amount, parent: row.parentCategory, monthlyAvg: 0)
            }
        )
    }

    private var displayRows: [(id: String, label: String, amount: Double, categories: [String])] {
        if isParentView {
            return parentRows.map { row in
                (id: row.id, label: row.label, amount: row.amount, categories: row.categories)
            }
        }
        return categoryRows.prefix(12).map { row in
            (id: row.category, label: row.category, amount: row.amount, categories: [row.category])
        }
    }

    private var totalIncome: Double {
        data?.totalIncome ?? 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
                Text("Where Your Income Went")
                    .font(.headline)
                Spacer()
                CategoryViewPicker(selection: $viewRaw)
            }

            if categoryRows.isEmpty {
                insightsEmptyText("No spending breakdown available for this period.")
            } else {
                MoatCard {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Text("Income")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(CurrencyFormatter.formatCompact(totalIncome))
                                .font(.subheadline.weight(.semibold))
                        }
                        .padding(.vertical, MoatTheme.Spacing.medium)

                        Divider()

                        ForEach(Array(displayRows.enumerated()), id: \.element.id) { index, row in
                            Group {
                                if row.categories.isEmpty {
                                    WhereIncomeWentRow(label: row.label, amount: row.amount, totalIncome: totalIncome)
                                } else {
                                    NavigationLink {
                                        TransactionsView(
                                            initialFilters: transactionFilters(categories: row.categories, period: period),
                                            title: row.label
                                        )
                                    } label: {
                                        WhereIncomeWentRow(label: row.label, amount: row.amount, totalIncome: totalIncome)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }

                            if index < displayRows.count - 1 {
                                Divider()
                            }
                        }

                        Divider()

                        HStack {
                            Text("Net Income")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(InsightsChartFormatting.formatSignedCurrency(data?.netIncome ?? 0))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle((data?.netIncome ?? 0) >= 0 ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.destructive)
                        }
                        .padding(.vertical, MoatTheme.Spacing.medium)
                    }
                }
            }
        }
    }
}

private struct WhereIncomeWentRow: View {
    let label: String
    let amount: Double
    let totalIncome: Double

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
            HStack {
                Text(label)
                    .font(.subheadline)
                    .lineLimit(1)
                Spacer()
                Text("-\(CurrencyFormatter.formatCompact(amount))")
                    .font(.subheadline.weight(.semibold))
            }

            GeometryReader { proxy in
                let widthPercent = totalIncome > 0 ? min(amount / totalIncome, 1) : 0
                ZStack(alignment: .leading) {
                    Capsule().fill(MoatTheme.ColorToken.chartMuted)
                    Capsule()
                        .fill(MoatTheme.ColorToken.accent)
                        .frame(width: proxy.size.width * widthPercent)
                }
            }
            .frame(height: 6)
        }
        .padding(.vertical, MoatTheme.Spacing.medium)
        .contentShape(Rectangle())
    }
}
