import SwiftUI

enum FinancialChartStyle {
    static let standardHeight: CGFloat = 200
    static let compactHeight: CGFloat = 176
    static let plotPadding: CGFloat = 4
    static let barCornerRadius: CGFloat = 5
    static let selectedPointSize: CGFloat = 8

    static let lineWidth = StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round)
    static let forecastLineWidth = StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round, dash: [5, 5])
    static let ruleLine = StrokeStyle(lineWidth: 1, lineCap: .round)
    static let zeroLine = StrokeStyle(lineWidth: 1.2, lineCap: .round)

    static var positive: Color { MoatTheme.ColorToken.positive }
    static var negative: Color { MoatTheme.ColorToken.destructive }
    static var neutral: Color { MoatTheme.ColorToken.chartMuted }
    static var grid: Color { MoatTheme.ColorToken.chartGrid }
    static var selection: Color { MoatTheme.ColorToken.chartPrimary }
    static var secondaryText: Color { MoatTheme.ColorToken.textTertiary }

    static func selectionAnimation(reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : .easeOut(duration: 0.12)
    }

    static func dataAnimation(reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : .easeInOut(duration: 0.24)
    }
}
