import SwiftUI

enum InsightsChartCtaCopy {
    static func pageLabel(for tab: InsightsTab) -> String {
        switch tab {
        case .spending: "spending"
        case .income: "income"
        case .netIncome: "net income"
        }
    }

    static func featureRequestMessage(for tab: InsightsTab) -> String {
        "I'd like better charts on the \(pageLabel(for: tab)) insights page: "
    }

    static func customReportPrompt(for tab: InsightsTab) -> String {
        "Use the Moat Finance MCP tools to generate a custom \(pageLabel(for: tab)) report for me. Specifically: "
    }
}
