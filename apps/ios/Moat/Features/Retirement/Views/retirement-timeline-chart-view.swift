import SwiftUI

struct RetirementTimelinePoint: Identifiable, Equatable {
    let id: Int
    let date: Date
    let netWorth: Double
    let age: Int
}

struct RetirementTimelineChartView: View {
    let years: [RetirementProjectionYear]
    @State private var selectedPoint: RetirementTimelinePoint?

    private var points: [RetirementTimelinePoint] {
        years.map { year in
            let components = DateComponents(calendar: Calendar(identifier: .gregorian), year: year.year, month: 1, day: 1)
            return RetirementTimelinePoint(
                id: year.year,
                date: components.date ?? Date(),
                netWorth: year.netWorth,
                age: year.age
            )
        }
    }

    private var displayPoint: RetirementTimelinePoint? {
        selectedPoint ?? points.last
    }

    var body: some View {
        FinancialChartContainer(
            title: "Lifetime timeline",
            summary: displayPoint.map { RetirementCurrency.money($0.netWorth) },
            detail: displayPoint.map { point in
                if let today = selectedYear(for: point)?.netWorthTodayDollars, abs(today - point.netWorth) >= 1 {
                    return "Age \(point.age) · ≈ \(RetirementCurrency.money(today)) in today's dollars"
                }
                return "Age \(point.age)"
            }
        ) {
            FinancialLineChart(
                points: points,
                valueLabel: "Net Worth",
                xAxisStride: 5,
                tint: MoatTheme.ColorToken.chartPrimary,
                showsArea: true,
                date: \.date,
                value: \.netWorth,
                accessibilityLabel: "Retirement net worth timeline",
                selectedPoint: $selectedPoint
            )
        }
    }

    private func selectedYear(for point: RetirementTimelinePoint) -> RetirementProjectionYear? {
        years.first { $0.year == point.id }
    }
}
