import Charts
import SwiftUI

struct AccountHistoryChartView: View {
    let accountId: String
    let fallbackBalance: Double

    @State private var points: [AccountBalanceHistoryPoint] = []
    @State private var currentBalance: Double?
    @State private var isLoading = true
    @State private var loadFailed = false
    @State private var selectedRange: AccountHistoryRange = .oneMonth
    @State private var selectedPoint: AccountBalanceHistoryPoint?

    @SwiftUI.Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let service = AccountBalanceHistoryService()

    private var filtered: [AccountBalanceHistoryPoint] {
        AccountHistoryMath.filter(points: points, range: selectedRange)
    }

    private var chartPoints: [AccountBalanceHistoryPoint] {
        AccountHistoryMath.chartPoints(points: points, range: selectedRange)
    }

    private var delta: (absolute: Double, percent: Double) {
        AccountHistoryMath.delta(points: filtered)
    }

    private var isPositive: Bool { delta.absolute >= 0 }

    private var tint: Color {
        isPositive ? MoatTheme.ColorToken.chartPositive : MoatTheme.ColorToken.chartNegative
    }

    private var displayBalance: Double {
        selectedPoint?.balance ?? currentBalance ?? fallbackBalance
    }

    private var periodLabel: String {
        if let selectedPoint {
            return DateFormatterProvider.monthDay(selectedPoint.parsedDate)
        }
        return selectedRange.label
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .frame(height: 180)
            } else if loadFailed || points.isEmpty {
                Text("Balance history will appear after the next sync.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, MoatTheme.Spacing.small)
            } else {
                chartContent
            }
        }
        .task(id: accountId) {
            await load()
        }
    }

    private var chartContent: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            VStack(alignment: .leading, spacing: 4) {
                Text(CurrencyFormatter.formatCompact(displayBalance))
                    .font(.largeTitle.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                HStack(spacing: 4) {
                    Image(systemName: isPositive ? "arrowtriangle.up.fill" : "arrowtriangle.down.fill")
                        .font(.caption2)
                    Text(
                        "\(FinancialChartFormatting.signedCurrency(delta.absolute)) (\(formatPercent(delta.percent))) \(periodLabel)"
                    )
                    .font(.subheadline.weight(.medium))
                }
                .foregroundStyle(tint)
            }

            Chart {
                ForEach(chartPoints) { point in
                    LineMark(
                        x: .value("Date", point.parsedDate),
                        y: .value("Balance", point.balance)
                    )
                    .foregroundStyle(tint)
                    .interpolationMethod(.monotone)
                    .lineStyle(FinancialChartStyle.lineWidth)

                    if point.id == chartPoints.last?.id {
                        PointMark(
                            x: .value("Date", point.parsedDate),
                            y: .value("Balance", point.balance)
                        )
                        .foregroundStyle(tint)
                        .symbolSize(56)
                    }
                }

                if let selectedPoint {
                    RuleMark(x: .value("Selected", selectedPoint.parsedDate))
                        .foregroundStyle(tint.opacity(0.45))
                        .lineStyle(FinancialChartStyle.ruleLine)
                    PointMark(
                        x: .value("Selected", selectedPoint.parsedDate),
                        y: .value("Balance", selectedPoint.balance)
                    )
                    .foregroundStyle(tint)
                    .symbolSize(64)
                }
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .chartXScale(domain: AccountHistoryMath.xDomain(points: chartPoints))
            .chartYScale(domain: AccountHistoryMath.yDomain(points: chartPoints))
            .chartPlotStyle { plotArea in
                plotArea.padding(.horizontal, FinancialChartStyle.plotPadding)
            }
            .chartOverlay { proxy in
                GeometryReader { geometry in
                    FinancialChartInteractionOverlay(
                        proxy: proxy,
                        geometry: geometry,
                        points: chartPoints,
                        date: \.parsedDate,
                        selectedPoint: $selectedPoint
                    )
                }
            }
            .frame(height: 160)
            .animation(FinancialChartStyle.dataAnimation(reduceMotion: reduceMotion), value: selectedRange)
            .animation(FinancialChartStyle.selectionAnimation(reduceMotion: reduceMotion), value: selectedPoint?.id)
            .accessibilityLabel("Account balance history")
            .accessibilityHint(FinancialChartInteraction.accessibilityHint)

            HStack(spacing: 4) {
                ForEach(AccountHistoryRange.allCases) { range in
                    Button {
                        selectedRange = range
                        selectedPoint = nil
                    } label: {
                        Text(range.rawValue)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                selectedRange == range
                                    ? tint
                                    : Color.clear
                            )
                            .foregroundStyle(
                                selectedRange == range
                                    ? Color.black
                                    : tint
                            )
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(range.label)
                    .accessibilityAddTraits(selectedRange == range ? .isSelected : [])
                }
            }
        }
    }

    private func load() async {
        isLoading = true
        loadFailed = false
        defer { isLoading = false }
        do {
            let response = try await service.fetchHistory(accountId: accountId)
            points = response.points
            currentBalance = response.currentBalance
        } catch {
            loadFailed = true
            points = []
        }
    }

    private func formatPercent(_ value: Double) -> String {
        let absolute = String(format: "%.2f", abs(value))
        if value > 0 { return "+\(absolute)%" }
        if value < 0 { return "-\(absolute)%" }
        return "\(absolute)%"
    }
}

actor AccountBalanceHistoryService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetchHistory(accountId: String) async throws -> AccountBalanceHistoryResponse {
        try await apiClient.post(
            path: "/api/v1/accountBalanceHistory/get",
            body: .object(["accountId": .string(accountId)])
        )
    }
}
