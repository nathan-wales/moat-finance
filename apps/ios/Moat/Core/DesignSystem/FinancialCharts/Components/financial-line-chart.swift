import Charts
import SwiftUI

struct FinancialLineChart<Point: Identifiable>: View where Point.ID: Equatable {
    let points: [Point]
    let valueLabel: String
    let xAxisStride: Int
    let tint: Color
    let showsArea: Bool
    let date: (Point) -> Date
    let value: (Point) -> Double
    let accessibilityLabel: String
    @Binding var selectedPoint: Point?

    @SwiftUI.Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var domain: ClosedRange<Double> {
        FinancialChartSelection.paddedDomain(values: points.map(value), includeZero: false)
    }

    var body: some View {
        Chart {
            ForEach(points) { point in
                if showsArea {
                    AreaMark(
                        x: .value("Month", date(point)),
                        y: .value(valueLabel, value(point))
                    )
                    .foregroundStyle(areaGradient)
                    .interpolationMethod(.monotone)
                }

                LineMark(
                    x: .value("Month", date(point)),
                    y: .value(valueLabel, value(point))
                )
                .foregroundStyle(tint)
                .lineStyle(FinancialChartStyle.lineWidth)
                .interpolationMethod(.monotone)
                .accessibilityLabel(FinancialChartFormatting.monthYear(date(point)))
                .accessibilityValue(FinancialChartFormatting.currency(value(point)))
            }

            if let selectedPoint {
                RuleMark(x: .value("Selected month", date(selectedPoint)))
                    .foregroundStyle(FinancialChartStyle.selection.opacity(0.45))
                    .lineStyle(FinancialChartStyle.ruleLine)

                PointMark(
                    x: .value("Selected month", date(selectedPoint)),
                    y: .value(valueLabel, value(selectedPoint))
                )
                .symbolSize(56)
                .foregroundStyle(tint)
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
        .frame(height: FinancialChartStyle.standardHeight)
        .animation(FinancialChartStyle.dataAnimation(reduceMotion: reduceMotion), value: points.count)
        .animation(FinancialChartStyle.selectionAnimation(reduceMotion: reduceMotion), value: selectedPoint?.id)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint(FinancialChartInteraction.accessibilityHint)
    }

    private var areaGradient: LinearGradient {
        LinearGradient(
            colors: [
                tint.opacity(0.16),
                tint.opacity(0.02),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}
