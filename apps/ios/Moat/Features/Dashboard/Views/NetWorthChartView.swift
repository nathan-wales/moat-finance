import Charts
import SwiftUI

struct NetWorthChartView: View {
    let dataPoints: [NetWorthPoint]

    @State private var selectedPoint: NetWorthPoint?

    private var displayPoint: NetWorthPoint? {
        selectedPoint ?? dataPoints.last
    }

    private var summary: String? {
        guard let displayPoint else { return nil }
        return FinancialChartFormatting.currency(displayPoint.total)
    }

    private var detail: String? {
        guard let displayPoint else { return nil }
        if selectedPoint != nil {
            return FinancialChartFormatting.monthYear(displayPoint.date)
        }
        return "Latest reported month"
    }

    var body: some View {
        FinancialChartContainer(
            summary: summary,
            detail: detail
        ) {
            FinancialLineChart(
                points: dataPoints,
                valueLabel: "Net Worth",
                xAxisStride: 3,
                tint: MoatTheme.ColorToken.chartPrimary,
                showsArea: true,
                date: \.date,
                value: \.total,
                accessibilityLabel: "Net worth chart",
                selectedPoint: $selectedPoint
            )
        }
    }
}

#Preview("Net worth chart - light") {
    MoatCard {
        NetWorthChartView(dataPoints: ChartPreviewFixtures.netWorthPoints)
    }
    .padding()
    .preferredColorScheme(.light)
}

#Preview("Net worth chart - dark") {
    MoatCard {
        NetWorthChartView(dataPoints: ChartPreviewFixtures.netWorthPoints)
    }
    .padding()
    .preferredColorScheme(.dark)
}

struct MonthlyNetGainsChartView: View {
    let months: [MonthlyAggregate]

    @State private var selectedMonth: MonthlyAggregate?

    private var summary: String {
        if let selectedMonth {
            return FinancialChartFormatting.signedCurrency(selectedMonth.netGain)
        }
        let netGain = months.reduce(0) { $0 + $1.netGain }
        return "12-month net gain: \(FinancialChartFormatting.signedCurrency(netGain))"
    }

    private var detail: String {
        guard let selectedMonth else {
            return "Income minus spending by month"
        }
        return FinancialChartFormatting.monthYear(selectedMonth.date)
    }

    var body: some View {
        FinancialChartContainer(
            summary: summary,
            detail: detail
        ) {
            PositiveNegativeBarChart(
                points: months,
                valueLabel: "Net",
                xAxisStride: 2,
                date: \.date,
                value: \.netGain,
                accessibilityLabel: "Monthly cash flow chart",
                selectedPoint: $selectedMonth
            )
        }
    }
}

#Preview("Cash flow chart - mixed") {
    MoatCard {
        MonthlyNetGainsChartView(months: ChartPreviewFixtures.mixedMonthlyAggregates)
    }
    .padding()
}

#Preview("Cash flow chart - dynamic type") {
    MoatCard {
        MonthlyNetGainsChartView(months: ChartPreviewFixtures.mixedMonthlyAggregates)
    }
    .padding()
    .environment(\.dynamicTypeSize, .accessibility3)
}

struct ForecastedBalanceChartView: View {
    let points: [ForecastedBalancePoint]
    let forecastYears: Int

    @State private var selectedPoint: ForecastedBalancePoint?
    @SwiftUI.Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(points: [ForecastedBalancePoint], forecastYears: Int = 1) {
        self.points = points
        self.forecastYears = forecastYears
    }

    private var xAxisMonthStride: Int {
        let totalMonths = forecastYears * 12
        if totalMonths <= 12 { return 3 }
        if totalMonths <= 36 { return 6 }
        if totalMonths <= 60 { return 12 }
        return max(12, totalMonths / 5)
    }

    private var domain: ClosedRange<Double> {
        FinancialChartSelection.paddedDomain(values: points.map(\.value), includeZero: false)
    }

    private var summary: String? {
        guard let selectedPoint else { return nil }
        return FinancialChartFormatting.currency(selectedPoint.value)
    }

    private var detail: String? {
        guard let selectedPoint else { return nil }
        let prefix = selectedPoint.isForecast ? "Forecast" : "Actual"
        return "\(prefix) · \(FinancialChartFormatting.monthYear(selectedPoint.date))"
    }

    var body: some View {
        FinancialChartContainer(
            summary: summary,
            detail: detail
        ) {
            Chart {
                ForEach(points) { point in
                    LineMark(
                        x: .value("Month", point.date),
                        y: .value("Balance", point.value)
                    )
                    .foregroundStyle(point.isForecast ? MoatTheme.ColorToken.chartSecondary : MoatTheme.ColorToken.chartPrimary)
                    .lineStyle(point.isForecast ? FinancialChartStyle.forecastLineWidth : FinancialChartStyle.lineWidth)
                    .interpolationMethod(.monotone)
                }

                if let selectedPoint {
                    RuleMark(x: .value("Selected month", selectedPoint.date))
                        .foregroundStyle(FinancialChartStyle.selection.opacity(0.45))
                        .lineStyle(FinancialChartStyle.ruleLine)

                    PointMark(
                        x: .value("Selected month", selectedPoint.date),
                        y: .value("Balance", selectedPoint.value)
                    )
                    .symbolSize(56)
                    .foregroundStyle(selectedPoint.isForecast ? MoatTheme.ColorToken.chartSecondary : MoatTheme.ColorToken.chartPrimary)
                }
            }
            .chartXAxis {
                FinancialChartAxis.monthXAxis(stride: xAxisMonthStride)
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
            .frame(height: FinancialChartStyle.standardHeight)
            .animation(FinancialChartStyle.dataAnimation(reduceMotion: reduceMotion), value: points.count)
            .animation(FinancialChartStyle.selectionAnimation(reduceMotion: reduceMotion), value: selectedPoint?.id)
            .accessibilityLabel("Forecasted net worth chart")
            .accessibilityHint(FinancialChartInteraction.accessibilityHint)
        }
    }
}

#Preview("Forecasted balance chart") {
    MoatCard {
        ForecastedBalanceChartView(points: ChartPreviewFixtures.forecastPoints, forecastYears: 1)
    }
    .padding()
}

private enum ChartPreviewFixtures {
    static let netWorthPoints = [
        NetWorthPoint(month: "2024-01", total: 100_000),
        NetWorthPoint(month: "2024-02", total: 105_000),
        NetWorthPoint(month: "2024-03", total: 102_000),
        NetWorthPoint(month: "2024-04", total: 110_000),
        NetWorthPoint(month: "2024-05", total: 115_000),
        NetWorthPoint(month: "2024-06", total: 120_000),
        NetWorthPoint(month: "2024-07", total: 118_000),
        NetWorthPoint(month: "2024-08", total: 125_000),
        NetWorthPoint(month: "2024-09", total: 130_000),
        NetWorthPoint(month: "2024-10", total: 128_000),
        NetWorthPoint(month: "2024-11", total: 135_000),
        NetWorthPoint(month: "2024-12", total: 140_000),
    ]

    static let mixedMonthlyAggregates = [
        MonthlyAggregate(month: "2024-01", income: 11_000, expenses: 7_800, netGain: 3_200),
        MonthlyAggregate(month: "2024-02", income: 9_300, expenses: 10_400, netGain: -1_100),
        MonthlyAggregate(month: "2024-03", income: 12_700, expenses: 8_900, netGain: 3_800),
        MonthlyAggregate(month: "2024-04", income: 8_500, expenses: 8_500, netGain: 0),
        MonthlyAggregate(month: "2024-05", income: 15_200, expenses: 9_300, netGain: 5_900),
        MonthlyAggregate(month: "2024-06", income: 10_100, expenses: 12_600, netGain: -2_500),
    ]

    static let forecastPoints = [
        ForecastedBalancePoint(month: "2024-01", value: 140_000, isForecast: false),
        ForecastedBalancePoint(month: "2024-02", value: 145_000, isForecast: false),
        ForecastedBalancePoint(month: "2024-03", value: 149_000, isForecast: false),
        ForecastedBalancePoint(month: "2024-04", value: 154_000, isForecast: true),
        ForecastedBalancePoint(month: "2024-05", value: 160_000, isForecast: true),
        ForecastedBalancePoint(month: "2024-06", value: 166_000, isForecast: true),
    ]
}
