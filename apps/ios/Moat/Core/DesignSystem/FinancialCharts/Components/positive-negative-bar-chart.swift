import Charts
import SwiftUI

struct PositiveNegativeBarChart<Point: Identifiable>: View where Point.ID: Equatable {
    let points: [Point]
    let valueLabel: String
    let xAxisStride: Int
    let date: (Point) -> Date
    let value: (Point) -> Double
    let accessibilityLabel: String
    @Binding var selectedPoint: Point?

    @SwiftUI.Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var domain: ClosedRange<Double> {
        FinancialChartSelection.paddedDomain(values: points.map(value), includeZero: true)
    }

    var body: some View {
        Chart {
            RuleMark(y: .value("Zero", 0))
                .foregroundStyle(FinancialChartStyle.neutral.opacity(0.8))
                .lineStyle(FinancialChartStyle.zeroLine)

            ForEach(points) { point in
                BarMark(
                    x: .value("Period", date(point), unit: .month),
                    y: .value(valueLabel, value(point))
                )
                .foregroundStyle(color(for: value(point)))
                .cornerRadius(FinancialChartStyle.barCornerRadius)
                .opacity(opacity(for: point))
                .accessibilityLabel(FinancialChartFormatting.monthYear(date(point)))
                .accessibilityValue(FinancialChartFormatting.signedCurrency(value(point)))
            }
        }
        .chartXAxis {
            FinancialChartAxis.monthXAxis(stride: xAxisStride)
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
                    date: date,
                    selectedPoint: $selectedPoint
                )
            }
        }
        .frame(height: FinancialChartStyle.compactHeight)
        .animation(FinancialChartStyle.dataAnimation(reduceMotion: reduceMotion), value: points.count)
        .animation(FinancialChartStyle.selectionAnimation(reduceMotion: reduceMotion), value: selectedPoint?.id)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint(FinancialChartInteraction.accessibilityHint)
    }

    private func color(for value: Double) -> Color {
        if value > 0 { return FinancialChartStyle.positive }
        if value < 0 { return FinancialChartStyle.negative }
        return FinancialChartStyle.neutral
    }

    private func opacity(for point: Point) -> Double {
        guard let selectedPoint else { return 0.9 }
        return selectedPoint.id == point.id ? 1 : 0.32
    }
}
