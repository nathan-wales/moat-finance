import SwiftUI

private struct FinancialLineChartPreview: View {
    @State private var selectedPoint: FinancialChartSelectionPoint<String>?

    let points: [FinancialChartSelectionPoint<String>]

    var body: some View {
        MoatCard {
            FinancialChartContainer(title: "Preview", summary: selectedPoint.map { FinancialChartFormatting.currency($0.value) }) {
                FinancialLineChart(
                    points: points,
                    valueLabel: "Balance",
                    xAxisStride: 2,
                    tint: MoatTheme.ColorToken.chartPrimary,
                    showsArea: true,
                    date: \.date,
                    value: \.value,
                    accessibilityLabel: "Preview line chart",
                    selectedPoint: $selectedPoint
                )
            }
        }
        .padding()
    }
}

private struct FinancialPositiveNegativeBarChartPreview: View {
    @State private var selectedPoint: FinancialChartSelectionPoint<String>?

    let points: [FinancialChartSelectionPoint<String>]

    var body: some View {
        MoatCard {
            FinancialChartContainer(title: "Preview", summary: selectedPoint.map { FinancialChartFormatting.signedCurrency($0.value) }) {
                PositiveNegativeBarChart(
                    points: points,
                    valueLabel: "Net",
                    xAxisStride: 2,
                    date: \.date,
                    value: \.value,
                    accessibilityLabel: "Preview bar chart",
                    selectedPoint: $selectedPoint
                )
            }
        }
        .padding()
    }
}

#Preview("Financial line - light") {
    FinancialLineChartPreview(points: FinancialChartPreviewData.positivePoints)
        .preferredColorScheme(.light)
}

#Preview("Financial line - dark") {
    FinancialLineChartPreview(points: FinancialChartPreviewData.positivePoints)
        .preferredColorScheme(.dark)
}

#Preview("Financial bar - mixed cash flow") {
    FinancialPositiveNegativeBarChartPreview(points: FinancialChartPreviewData.mixedPoints)
}

#Preview("Financial bar - negative only") {
    FinancialPositiveNegativeBarChartPreview(points: FinancialChartPreviewData.negativePoints)
}

#Preview("Financial chart - empty") {
    FinancialPositiveNegativeBarChartPreview(points: [])
}

#Preview("Financial chart - large dynamic type") {
    FinancialPositiveNegativeBarChartPreview(points: FinancialChartPreviewData.mixedPoints)
        .environment(\.dynamicTypeSize, .accessibility3)
}

private enum FinancialChartPreviewData {
    static let positivePoints = makePoints(values: [100_000, 108_000, 104_000, 116_000, 122_000, 128_000])
    static let negativePoints = makePoints(values: [-1_200, -2_400, -900, -3_100, -1_700, -2_200])
    static let mixedPoints = makePoints(values: [3_200, -1_100, 3_800, 0, 5_900, -2_500])

    private static func makePoints(values: [Double]) -> [FinancialChartSelectionPoint<String>] {
        values.enumerated().map { index, value in
            let month = String(format: "2024-%02d", index + 1)
            return FinancialChartSelectionPoint(
                id: month,
                date: DateFormatterProvider.parseYearMonth(month) ?? Date(),
                value: value,
                label: DateFormatterProvider.formatYearMonth(month)
            )
        }
    }
}
