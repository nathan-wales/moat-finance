import Foundation

/// Summary metrics for the dashboard
struct DashboardSummary: Equatable {
    let currentNetWorth: Double
    let previousNetWorth: Double
    let percentChange: Double
    let absoluteChange: Double
    let dataPoints: [NetWorthPoint]
    let monthlyAggregates: [MonthlyAggregate]
    let avgIncome: Double
    let avgExpenses: Double
    let avgNetGain: Double
    let allocationSections: [DashboardPortfolioAllocationSection]

    init(
        currentNetWorth: Double,
        previousNetWorth: Double,
        percentChange: Double,
        absoluteChange: Double,
        dataPoints: [NetWorthPoint],
        monthlyAggregates: [MonthlyAggregate] = [],
        avgIncome: Double = 0,
        avgExpenses: Double = 0,
        avgNetGain: Double = 0,
        allocationSections: [DashboardPortfolioAllocationSection] = []
    ) {
        self.currentNetWorth = currentNetWorth
        self.previousNetWorth = previousNetWorth
        self.percentChange = percentChange
        self.absoluteChange = absoluteChange
        self.dataPoints = dataPoints
        self.monthlyAggregates = monthlyAggregates
        self.avgIncome = avgIncome
        self.avgExpenses = avgExpenses
        self.avgNetGain = avgNetGain
        self.allocationSections = allocationSections
    }

    var isPositiveChange: Bool {
        absoluteChange >= 0
    }

    var formattedPercentChange: String {
        let sign = percentChange >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.1f", percentChange))%"
    }

    var formattedAbsoluteChange: String {
        let sign = absoluteChange >= 0 ? "+" : ""
        return "\(sign)\(CurrencyFormatter.formatCompact(absoluteChange))"
    }

    var totalAllocationValue: Double {
        allocationSections.reduce(0) { $0 + $1.value }
    }
}

// MARK: - Monthly aggregates

struct MonthlyAggregate: Decodable, Identifiable, Equatable {
    let month: String
    let income: Double
    let expenses: Double
    let netGain: Double

    var id: String { month }

    var date: Date {
        DateFormatterProvider.parseYearMonth(month) ?? Date()
    }
}

struct MonthlyAggregateResponse: Decodable, Equatable {
    let months: [MonthlyAggregate]
    let avgNetGain: Double
}

struct MonthlyAggregateRequest: Encodable {
    let months: Int
}

// MARK: - Summary metrics

struct SummaryMetricsResponse: Decodable, Equatable {
    let avgIncome: Double
    let avgExpenses: Double
    let avgNetGain: Double
    let monthCount: Int
}

// MARK: - Portfolio allocation

struct DashboardPortfolioAllocationSection: Decodable, Identifiable, Equatable {
    let key: String
    let label: String
    let value: Double
    let items: [PortfolioAllocationItem]

    var id: String { key }
}

struct PortfolioAllocationResponse: Decodable, Equatable {
    let sections: [DashboardPortfolioAllocationSection]
}

// MARK: - Factory

extension DashboardSummary {
    static func make(
        dataPoints: [NetWorthPoint],
        monthlyAggregates: [MonthlyAggregate],
        metrics: SummaryMetricsResponse?,
        allocation: [DashboardPortfolioAllocationSection]
    ) -> DashboardSummary {
        let sorted = dataPoints.sorted { $0.date < $1.date }
        let current = sorted.last?.total ?? 0
        let previous = sorted.dropLast().last?.total ?? current

        let absoluteChange = current - previous
        let percentChange = previous != 0 ? (absoluteChange / previous) * 100 : 0

        return DashboardSummary(
            currentNetWorth: current,
            previousNetWorth: previous,
            percentChange: percentChange,
            absoluteChange: absoluteChange,
            dataPoints: sorted,
            monthlyAggregates: monthlyAggregates,
            avgIncome: metrics?.avgIncome ?? 0,
            avgExpenses: metrics?.avgExpenses ?? 0,
            avgNetGain: metrics?.avgNetGain ?? 0,
            allocationSections: allocation.filter { $0.value > 0 }.sorted { $0.value > $1.value }
        )
    }
}
