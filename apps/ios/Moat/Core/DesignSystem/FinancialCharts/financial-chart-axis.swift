import Charts
import SwiftUI

enum FinancialChartAxis {
    @AxisContentBuilder
    static func monthXAxis(stride: Int) -> some AxisContent {
        AxisMarks(values: .stride(by: .month, count: stride)) { value in
            if let date = value.as(Date.self) {
                AxisValueLabel {
                    Text(FinancialChartFormatting.month(date))
                        .font(.caption2)
                        .foregroundStyle(FinancialChartStyle.secondaryText)
                }
            }
        }
    }

    @AxisContentBuilder
    static func currencyYAxis(position: AxisMarkPosition = .trailing) -> some AxisContent {
        AxisMarks(position: position) { value in
            if let amount = value.as(Double.self) {
                AxisValueLabel {
                    Text(FinancialChartFormatting.compactCurrency(amount))
                        .font(.caption2)
                        .foregroundStyle(FinancialChartStyle.secondaryText)
                }
            }
            AxisGridLine(stroke: StrokeStyle(lineWidth: 1))
                .foregroundStyle(FinancialChartStyle.grid)
        }
    }

    @AxisContentBuilder
    static func percentYAxis(position: AxisMarkPosition = .trailing) -> some AxisContent {
        AxisMarks(position: position) { value in
            if let percent = value.as(Double.self) {
                AxisValueLabel {
                    Text(FinancialChartFormatting.percent(percent))
                        .font(.caption2)
                        .foregroundStyle(FinancialChartStyle.secondaryText)
                }
            }
            AxisGridLine(stroke: StrokeStyle(lineWidth: 1))
                .foregroundStyle(FinancialChartStyle.grid)
        }
    }
}
