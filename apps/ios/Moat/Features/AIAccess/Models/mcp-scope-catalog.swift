import Foundation

enum McpScope: String, CaseIterable, Identifiable, Codable, Hashable {
    case read = "mcp:read"
    case accountsRead = "mcp:accounts:read"
    case transactionsRead = "mcp:transactions:read"
    case rulesRead = "mcp:rules:read"
    case budgetRead = "mcp:budget:read"
    case forecastRead = "mcp:forecast:read"
    case retirementRead = "mcp:retirement:read"
    case taxRead = "mcp:tax:read"
    case memoriesRead = "mcp:memories:read"
    case memoriesWrite = "mcp:memories:write"
    case reportsWrite = "mcp:reports:write"
    case feedbackWrite = "mcp:feedback:write"
    case rulesWrite = "mcp:rules:write"
    case transactionsWrite = "mcp:transactions:write"
    case budgetWrite = "mcp:budget:write"
    case retirementWrite = "mcp:retirement:write"
    case taxWrite = "mcp:tax:write"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .read: return "Basic app access"
        case .accountsRead: return "View accounts"
        case .transactionsRead: return "View transactions"
        case .budgetRead: return "View budgets"
        case .forecastRead: return "View forecasts"
        case .retirementRead: return "View retirement plans"
        case .taxRead: return "View taxes"
        case .rulesRead: return "View rules"
        case .memoriesRead: return "Read memories"
        case .memoriesWrite: return "Save memories"
        case .reportsWrite: return "Create reports"
        case .feedbackWrite: return "Send feedback"
        case .rulesWrite: return "Create, manage, and apply rules"
        case .transactionsWrite: return "Edit and hide transactions"
        case .budgetWrite: return "Adjust and delete budgets"
        case .retirementWrite: return "Create and manage retirement scenarios"
        case .taxWrite: return "Upload tax documents and confirm tax facts"
        }
    }

    static let recommendedDefaults: [McpScope] = [
        .read, .accountsRead, .transactionsRead, .budgetRead, .forecastRead, .retirementRead, .feedbackWrite,
    ]

    static let readOnlyFull: [McpScope] = [
        .read, .accountsRead, .transactionsRead, .budgetRead, .forecastRead, .retirementRead, .taxRead, .rulesRead, .memoriesRead,
    ]

    static let financialAssistant: [McpScope] = [
        .read, .accountsRead, .transactionsRead, .budgetRead, .forecastRead, .retirementRead, .taxRead, .rulesRead, .memoriesRead,
        .rulesWrite, .transactionsWrite, .budgetWrite, .retirementWrite, .taxWrite, .feedbackWrite,
    ]

    static var advertised: [McpScope] {
        shipped(Array(allCases))
    }

    static func shipped(_ scopes: [McpScope]) -> [McpScope] {
        if ProductFlags.taxesEnabled { return scopes }
        return scopes.filter { $0 != .taxRead && $0 != .taxWrite }
    }
}

enum McpScopePreset: String, CaseIterable, Identifiable {
    case recommended
    case readOnlyFull = "read-only-full"
    case financialAssistant = "financial-assistant"
    case custom

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recommended: return "Recommended"
        case .readOnlyFull: return "Read-only full access"
        case .financialAssistant: return "Financial assistant"
        case .custom: return "Custom"
        }
    }

    var description: String {
        switch self {
        case .recommended:
            return "Best for local AI tools. Can view your accounts, transactions, budgets, forecasts, and retirement plan, and send feedback when something is missing or an MCP tool fails."
        case .readOnlyFull:
            return "Can view all financial context, including rules and memories."
        case .financialAssistant:
            return "Can view financial context and make changes: create rules, edit transactions, adjust budgets, and manage retirement scenarios. Also send feedback."
        case .custom:
            return "Choose exactly what this token can access."
        }
    }

    var scopes: [McpScope]? {
        switch self {
        case .recommended: return McpScope.shipped(McpScope.recommendedDefaults)
        case .readOnlyFull: return McpScope.shipped(McpScope.readOnlyFull)
        case .financialAssistant: return McpScope.shipped(McpScope.financialAssistant)
        case .custom: return nil
        }
    }

    static func detect(from scopes: [McpScope]) -> McpScopePreset {
        let set = Set(scopes)
        if set == Set(McpScope.shipped(McpScope.recommendedDefaults)) { return .recommended }
        if set == Set(McpScope.shipped(McpScope.readOnlyFull)) { return .readOnlyFull }
        if set == Set(McpScope.shipped(McpScope.financialAssistant)) { return .financialAssistant }
        return .custom
    }
}

enum McpTokenExpirationOption: String, CaseIterable, Identifiable {
    case days30 = "30"
    case days90 = "90"
    case days365 = "365"
    case never

    var id: String { rawValue }

    var label: String {
        switch self {
        case .days30: return "30 days"
        case .days90: return "90 days"
        case .days365: return "1 year"
        case .never: return "Never"
        }
    }

    var expiresInDays: Int? {
        switch self {
        case .days30: return 30
        case .days90: return 90
        case .days365: return 365
        case .never: return nil
        }
    }
}
