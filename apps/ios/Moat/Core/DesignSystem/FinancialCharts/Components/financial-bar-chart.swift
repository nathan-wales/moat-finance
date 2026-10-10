import Charts
import SwiftUI

struct FinancialBarChart<Point: Identifiable>: View where Point.ID: Equatable {
    let points: [Point]
    let valueLabel: String
    let xAxisStride: Int
    let tint: Color
    let valueDomain: ClosedRange<Double>?
    let date: (Point) -> Date
    let value: (Point) -> Double
    let valueFormatter: (Double) -> String
    let accessibilityLabel: String
    @Binding var selectedPoint: Point?

    @SwiftUI.Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var domain: ClosedRange<Double> {
        valueDomain ?? FinancialChartSelection.paddedDomain(values: points.map(value), includeZero: true)
    }

    var body: some View {
        Chart(points) { point in
            BarMark(
                x: .value("Period", date(point), unit: .month),
                y: .value(valueLabel, value(point))
            )
            .foregroundStyle(tint)
            .cornerRadius(FinancialChartStyle.barCornerRadius)
            .opacity(opacity(for: point))
            .accessibilityLabel(FinancialChartFormatting.monthYear(date(point)))
            .accessibilityValue(valueFormatter(value(point)))
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

    private func opacity(for point: Point) -> Double {
        guard let selectedPoint else { return 0.92 }
        return selectedPoint.id == point.id ? 1 : 0.34
    }
}
