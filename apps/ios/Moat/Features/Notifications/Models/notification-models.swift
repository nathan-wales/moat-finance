import Foundation

enum NotificationSignalType: String, Codable, CaseIterable, Sendable {
    case transactionAppeared = "transaction_appeared"
    case expectedTransactionMissing = "expected_transaction_missing"
    case budgetThreshold = "budget_threshold"
    case balanceThreshold = "balance_threshold"
    case largeTransaction = "large_transaction"
    case recurringAmountChanged = "recurring_amount_changed"
    case upcomingRecurringBill = "upcoming_recurring_bill"
    case accountSyncStale = "account_sync_stale"
    case scheduledSummary = "scheduled_summary"
}

enum NotificationChannel: String, Codable, CaseIterable, Sendable {
    case email
    case push
    case inApp = "in_app"
}

struct NotificationExplanationFact: Codable, Sendable, Hashable {
    let label: String
    let value: String
}

struct NotificationExplanation: Codable, Sendable {
    let signalType: String
    let summary: String
    let facts: [NotificationExplanationFact]
}

struct NotificationRule: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let plainLanguageSummary: String?
    let signalType: NotificationSignalType
    let channels: [NotificationChannel]
    let isActive: Bool
    let isPaused: Bool
    let source: String
    let sourceAttribution: String?
    let lastEvaluatedAt: String?
    let fireCount: Int
}

struct NotificationRuleListResponse: Codable, Sendable {
    let rules: [NotificationRule]
}

struct NotificationPreferences: Codable, Sendable {
    var timezone: String
    var pushPrivacyLevel: String
    var quietHoursEnabled: Bool?
    var quietHoursStartMinute: Int?
    var quietHoursEndMinute: Int?
    var maxPushPerDay: Int?
    var weeklySummaryEnabled: Bool
    var weeklySummaryDayOfWeek: Int
    var weeklySummaryMinuteOfDay: Int
    var weeklySummaryChannels: [NotificationChannel]?
    var emailEnabled: Bool
    var pushEnabled: Bool
    var inAppEnabled: Bool
}

struct NotificationPreferencesResponse: Codable, Sendable {
    let preferences: NotificationPreferences
}

struct NotificationInboxItem: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let body: String
    let deliveryResult: String
    let explanation: NotificationExplanation?
    let readAt: String?
    let resolutionStatus: String?
    let createdAt: String
    let isWeeklySummary: Bool
}

struct NotificationInboxResponse: Codable, Sendable {
    let items: [NotificationInboxItem]
}

struct NotificationSuggestion: Codable, Identifiable, Sendable {
    let id: String
    let suggestionKey: String
    let title: String
    let description: String
    let templateId: String
    let createdAt: String
}

struct NotificationSuggestionListResponse: Codable, Sendable {
    let suggestions: [NotificationSuggestion]
}

/// Checked by contract tests against `@moat/monitoring-rules` enums.
enum NotificationContractEnums {
    static let signalTypes = NotificationSignalType.allCases.map(\.rawValue).sorted()
    static let channels = NotificationChannel.allCases.map(\.rawValue).sorted()
}
