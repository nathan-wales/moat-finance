import Foundation

struct DashboardLayout: Decodable, Equatable {
    var widgets: [DashboardWidgetInstance]

    static let empty = DashboardLayout(widgets: [])

    var visibleWidgets: [DashboardWidgetInstance] {
        widgets
            .filter(\.isVisible)
            .sorted { $0.order < $1.order }
    }

    func containsSingleton(type: String) -> Bool {
        widgets.contains { widget in
            widget.widgetType == type && widget.isVisible
        }
    }
}

struct DashboardWidgetInstance: Codable, Identifiable, Equatable {
    let id: String
    let widgetType: String
    let order: Int
    let isVisible: Bool
    let config: [String: JSONValue]?

    func updated(order: Int? = nil, isVisible: Bool? = nil) -> DashboardWidgetInstance {
        DashboardWidgetInstance(
            id: id,
            widgetType: widgetType,
            order: order ?? self.order,
            isVisible: isVisible ?? self.isVisible,
            config: config
        )
    }

    var requestBody: JSONValue {
        .object([
            "id": .string(id),
            "widgetType": .string(widgetType),
            "order": .number(Double(order)),
            "isVisible": .bool(isVisible),
            "config": config.map(JSONValue.object) ?? .null
        ])
    }
}

struct DashboardWidgetDefinition: Identifiable, Equatable {
    let type: String
    let title: String
    let description: String
    let category: DashboardWidgetCategory
    let systemImage: String
    let singleton: Bool
    let isSupported: Bool

    var id: String { type }

    static let all: [DashboardWidgetDefinition] = [
        DashboardWidgetDefinition(
            type: "net-worth-chart",
            title: "Net Worth Over Time",
            description: "Track historical net worth movement.",
            category: .financialHealth,
            systemImage: "chart.line.uptrend.xyaxis",
            singleton: true,
            isSupported: true
        ),
        DashboardWidgetDefinition(
            type: "monthly-cash-flow",
            title: "Monthly Cash Flow",
            description: "Review recent income, expenses, and net gain.",
            category: .financialHealth,
            systemImage: "arrow.up.arrow.down",
            singleton: true,
            isSupported: true
        ),
        DashboardWidgetDefinition(
            type: "spending-by-category",
            title: "Spending by Category",
            description: "See your top spending categories.",
            category: .financialHealth,
            systemImage: "chart.pie.fill",
            singleton: true,
            isSupported: true
        ),
        DashboardWidgetDefinition(
            type: "recent-transactions",
            title: "Recent Transactions",
            description: "Scan the latest account activity.",
            category: .review,
            systemImage: "list.bullet.rectangle.fill",
            singleton: true,
            isSupported: true
        ),
        DashboardWidgetDefinition(
            type: "forecasted-balance",
            title: "Forecasted Net Worth",
            description: "Project net worth over a selected time horizon.",
            category: .forecasting,
            systemImage: "sparkline",
            singleton: true,
            isSupported: true
        ),
        DashboardWidgetDefinition(
            type: "portfolio-allocation",
            title: "Portfolio Allocation",
            description: "Compare asset allocation by section.",
            category: .financialHealth,
            systemImage: "square.grid.2x2.fill",
            singleton: true,
            isSupported: true
        ),
        DashboardWidgetDefinition(
            type: "summary-metrics",
            title: "12-month Average",
            description: "Compare average income, expenses, and net gain.",
            category: .financialHealth,
            systemImage: "equal",
            singleton: true,
            isSupported: true
        ),
        DashboardWidgetDefinition(
            type: "assets-vs-liabilities",
            title: "Assets vs Liabilities",
            description: "Compare total assets and liabilities.",
            category: .financialHealth,
            systemImage: "scale.3d",
            singleton: true,
            isSupported: false
        ),
        DashboardWidgetDefinition(
            type: "rules-automation-impact",
            title: "Rules Automation Impact",
            description: "Measure transaction automation progress.",
            category: .review,
            systemImage: "bolt.fill",
            singleton: true,
            isSupported: false
        )
    ]

    static var supportedLibrary: [DashboardWidgetDefinition] {
        all.filter(\.isSupported)
    }

    static func definition(for type: String) -> DashboardWidgetDefinition {
        all.first { $0.type == type }
            ?? DashboardWidgetDefinition(
                type: type,
                title: type
                    .split(separator: "-")
                    .map { $0.capitalized }
                    .joined(separator: " "),
                description: "This widget is not available on iOS yet.",
                category: .review,
                systemImage: "square.dashed",
                singleton: true,
                isSupported: false
            )
    }
}

enum DashboardWidgetCategory: String, CaseIterable, Identifiable {
    case financialHealth
    case forecasting
    case review

    var id: String { rawValue }

    var title: String {
        switch self {
        case .financialHealth: "Financial Health"
        case .forecasting: "Forecasting"
        case .review: "Review"
        }
    }
}

enum ForecastHorizon {
    static let options = [1, 3, 5, 10, 15, 20, 30, 40, 50]

    static func label(for years: Int) -> String {
        years == 1 ? "1 year" : "\(years) years"
    }
}

struct ForecastedBalancePoint: Identifiable, Equatable {
    let month: String
    let value: Double
    let isForecast: Bool

    var id: String { "\(month)-\(isForecast)" }

    var date: Date {
        DateFormatterProvider.parseYearMonth(month) ?? Date()
    }
}
