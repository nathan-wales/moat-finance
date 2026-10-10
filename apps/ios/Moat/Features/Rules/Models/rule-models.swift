import Foundation

enum RuleField: String, Codable, CaseIterable, Identifiable {
    case merchant = "MERCHANT"
    case description = "DESCRIPTION"
    case amount = "AMOUNT"
    case category = "CATEGORY"
    case date = "DATE"
    case account = "ACCOUNT"
    case notes = "NOTES"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .merchant: "Merchant"
        case .description: "Description"
        case .amount: "Amount"
        case .category: "Category"
        case .date: "Date"
        case .account: "Account"
        case .notes: "Notes"
        }
    }

    var systemImage: String {
        switch self {
        case .merchant: "storefront"
        case .description: "text.alignleft"
        case .amount: "dollarsign"
        case .category: "folder"
        case .date: "calendar"
        case .account: "creditcard"
        case .notes: "note.text"
        }
    }

    var usesNumber: Bool { self == .amount }
    var usesDate: Bool { self == .date }
}

enum RuleOperator: String, Codable, CaseIterable, Identifiable {
    case contains = "CONTAINS"
    case notContains = "NOT_CONTAINS"
    case startsWith = "STARTS_WITH"
    case endsWith = "ENDS_WITH"
    case equals = "EQUALS"
    case notEquals = "NOT_EQUALS"
    case greaterThan = "GREATER_THAN"
    case greaterThanOrEqual = "GREATER_THAN_OR_EQUAL"
    case lessThan = "LESS_THAN"
    case lessThanOrEqual = "LESS_THAN_OR_EQUAL"
    case isEmpty = "IS_EMPTY"
    case isNotEmpty = "IS_NOT_EMPTY"
    case before = "BEFORE"
    case after = "AFTER"
    case on = "ON"
    case between = "BETWEEN"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .contains: "Contains"
        case .notContains: "Does not contain"
        case .startsWith: "Starts with"
        case .endsWith: "Ends with"
        case .equals: "Equals"
        case .notEquals: "Does not equal"
        case .greaterThan: "Greater than"
        case .greaterThanOrEqual: "Greater than or equal"
        case .lessThan: "Less than"
        case .lessThanOrEqual: "Less than or equal"
        case .isEmpty: "Is empty"
        case .isNotEmpty: "Is not empty"
        case .before: "Before"
        case .after: "After"
        case .on: "On"
        case .between: "Between"
        }
    }

    var needsValue: Bool {
        self != .isEmpty && self != .isNotEmpty
    }

    static let textOperators: [RuleOperator] = [.contains, .notContains, .startsWith, .endsWith, .equals, .notEquals, .isEmpty, .isNotEmpty]
    static let numberOperators: [RuleOperator] = [.equals, .notEquals, .greaterThan, .greaterThanOrEqual, .lessThan, .lessThanOrEqual, .between]
    static let dateOperators: [RuleOperator] = [.before, .after, .on, .between]
}

enum RuleActionType: String, Codable, CaseIterable, Identifiable {
    case setCategory = "SET_CATEGORY"
    case setDescription = "SET_DESCRIPTION"
    case setType = "SET_TYPE"
    case addHashtag = "ADD_HASHTAG"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .setCategory: "Set category"
        case .setDescription: "Set description"
        case .setType: "Set type"
        case .addHashtag: "Add hashtag"
        }
    }

    var displayTitle: String {
        switch self {
        case .setType: "Hide transaction"
        default: title
        }
    }

    var systemImage: String {
        switch self {
        case .setCategory: "folder"
        case .setDescription: "text.alignleft"
        case .setType: "eye.slash"
        case .addHashtag: "number"
        }
    }
}

enum RuleExecutionPreference: String, Codable, CaseIterable, Identifiable {
    case alwaysAsk = "ALWAYS_ASK"
    case applyHistorical = "APPLY_HISTORICAL"
    case futureOnly = "FUTURE_ONLY"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .alwaysAsk: "Always ask"
        case .applyHistorical: "Apply historical"
        case .futureOnly: "Future only"
        }
    }
}

enum RuleMatch: String, Codable, CaseIterable, Identifiable {
    case all = "ALL"
    case any = "ANY"

    var id: String { rawValue }

    var conditionsHeaderSuffix: String {
        switch self {
        case .all: "conditions match"
        case .any: "condition matches"
        }
    }

    var groupsHeaderSuffix: String {
        "of these match"
    }

    var connector: String {
        switch self {
        case .all: "and"
        case .any: "or"
        }
    }
}

struct TransactionRule: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let isActive: Bool
    let priority: Int
    let match: RuleMatch?
    let applyModePreference: String?
    let createdAt: Date?
    let updatedAt: Date?
    let conditions: [RuleCondition]
    let conditionGroups: [RuleConditionGroup]?
    let actions: [RuleAction]

    var resolvedMatch: RuleMatch { match ?? .all }

    var resolvedGroups: [RuleConditionGroup] {
        if let conditionGroups, !conditionGroups.isEmpty {
            return conditionGroups
        }
        return [
            RuleConditionGroup(
                id: "legacy-\(id)",
                match: .all,
                sortOrder: 0,
                conditions: conditions
            )
        ]
    }
}

struct RuleConditionGroup: Decodable, Identifiable, Equatable {
    let id: String?
    let match: RuleMatch?
    let sortOrder: Int?
    let conditions: [RuleCondition]

    var resolvedMatch: RuleMatch { match ?? .all }
}

struct RuleCondition: Decodable, Identifiable, Equatable {
    let id: String?
    let sortOrder: Int?
    let field: RuleField
    let operatorValue: RuleOperator
    let valueText: String?
    let valueNumber: Double?
    let valueDate: Date?
    let secondValueNumber: Double?
    let secondValueDate: Date?

    private enum CodingKeys: String, CodingKey {
        case id
        case sortOrder
        case field
        case operatorValue = "operator"
        case valueText
        case valueNumber
        case valueDate
        case secondValueNumber
        case secondValueDate
    }

    var displayValue: String {
        if let valueText, !valueText.isEmpty { return valueText }
        if let valueNumber { return CurrencyFormatter.formatCompact(valueNumber) }
        if let valueDate { return DateFormatterProvider.fullDate(valueDate) }
        return operatorValue.needsValue ? "-" : ""
    }
}

struct RuleAction: Decodable, Identifiable, Equatable {
    let id: String?
    let sortOrder: Int?
    let type: RuleActionType
    let valueText: String?
    let hashtagId: String?
    let hashtag: HashtagSummary?

    var displayValue: String {
        hashtag?.name ?? valueText ?? "-"
    }
}

struct RuleSettings: Decodable, Equatable {
    let ruleExecutionPreference: RuleExecutionPreference?
}

struct RulePreviewCount: Decodable, Equatable {
    let count: Int
}

struct RuleDraftPreview: Decodable, Equatable {
    let totalCount: Int
    let preview: [RulePreviewTransaction]
}

struct RulePreviewTransaction: Decodable, Identifiable, Equatable {
    let id: String
    let date: Date
    let description: String?
    let amount: Double
    let type: TransactionKind
    let category: String?
    let account: String?
    let hashtags: [String]

    var displayTitle: String {
        trimmed(description) ?? "Transaction"
    }

    var displaySubtitle: String {
        [trimmed(category), trimmed(account), DateFormatterProvider.fullDate(date)]
            .compactMap { $0 }
            .joined(separator: " - ")
    }
}

struct HistoricalApplyUpdate: Decodable, Equatable {
    let id: String
    let description: String?
    let type: String?
    let category: String?
    let addedHashtagNames: [String]?
}

struct HistoricalApplyResult: Decodable, Equatable {
    let affected: Int
    let deletedIds: [String]
    let updates: [HistoricalApplyUpdate]

    var displayCount: Int { affected }
}

struct RulesLoadResult {
    let rules: [TransactionRule]
    let settings: RuleSettings?
    let categories: [CategoryItem]
    let hashtags: [HashtagSummary]
}

struct ResolvedTransactionRule: Decodable, Equatable {
    let ruleId: String?
}

struct RuleActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

struct EditableRuleDraft {
    var name: String
    var match: RuleMatch
    var groups: [EditableRuleConditionGroupDraft]
    var actions: [EditableRuleActionDraft]

    /// Flat view over every group. Assigning collapses the draft to one group,
    /// since a flat list carries no grouping to preserve.
    var conditions: [EditableRuleConditionDraft] {
        get { groups.flatMap(\.conditions) }
        set {
            if groups.count == 1 {
                groups[0].conditions = newValue
                return
            }
            groups = [EditableRuleConditionGroupDraft(match: .all, conditions: newValue)]
            match = .all
        }
    }

    init(rule: TransactionRule?) {
        name = rule?.name ?? ""
        match = rule?.resolvedMatch ?? .all
        if let rule {
            groups = rule.resolvedGroups.map(EditableRuleConditionGroupDraft.init(group:))
        } else {
            groups = [EditableRuleConditionGroupDraft()]
        }
        actions = rule?.actions.map(EditableRuleActionDraft.init(action:)) ?? [EditableRuleActionDraft()]
    }

    init(
        name: String,
        match: RuleMatch = .all,
        groups: [EditableRuleConditionGroupDraft],
        actions: [EditableRuleActionDraft]
    ) {
        self.name = name
        self.match = match
        self.groups = groups
        self.actions = actions
    }

    init(name: String, conditions: [EditableRuleConditionDraft], actions: [EditableRuleActionDraft]) {
        self.name = name
        self.match = .all
        self.groups = [EditableRuleConditionGroupDraft(match: .all, conditions: conditions)]
        self.actions = actions
    }
}

struct EditableRuleConditionGroupDraft: Identifiable, Equatable {
    let id: String
    var match: RuleMatch
    var conditions: [EditableRuleConditionDraft]

    init(match: RuleMatch = .all, conditions: [EditableRuleConditionDraft]? = nil) {
        id = UUID().uuidString
        self.match = match
        self.conditions = conditions ?? [EditableRuleConditionDraft()]
    }

    init(group: RuleConditionGroup) {
        id = group.id ?? UUID().uuidString
        match = group.resolvedMatch
        conditions = group.conditions.map(EditableRuleConditionDraft.init(condition:))
        if conditions.isEmpty {
            conditions = [EditableRuleConditionDraft()]
        }
    }
}

struct EditableRuleConditionDraft: Identifiable, Equatable {
    let id: String
    var field: RuleField
    var operatorValue: RuleOperator
    var conditionText: String
    var conditionNumber: String
    var secondConditionNumber: String
    var conditionDate: Date
    var secondConditionDate: Date

    init() {
        id = UUID().uuidString
        field = .merchant
        operatorValue = .contains
        conditionText = ""
        conditionNumber = ""
        secondConditionNumber = ""
        conditionDate = Date()
        secondConditionDate = Date()
    }

    init(condition: RuleCondition) {
        id = condition.id ?? UUID().uuidString
        field = condition.field
        operatorValue = condition.operatorValue
        conditionText = condition.valueText ?? ""
        conditionNumber = condition.valueNumber.map { AmountInputFormatter.format($0, fractionDigits: 2) } ?? ""
        secondConditionNumber = condition.secondValueNumber.map { AmountInputFormatter.format($0, fractionDigits: 2) } ?? ""
        conditionDate = condition.valueDate ?? Date()
        secondConditionDate = condition.secondValueDate ?? Date()
    }

    init(field: RuleField, operatorValue: RuleOperator, text: String) {
        id = UUID().uuidString
        self.field = field
        self.operatorValue = operatorValue
        conditionText = text
        conditionNumber = ""
        secondConditionNumber = ""
        conditionDate = Date()
        secondConditionDate = Date()
    }

    var conditionOperators: [RuleOperator] {
        if field.usesNumber { return RuleOperator.numberOperators }
        if field.usesDate { return RuleOperator.dateOperators }
        return RuleOperator.textOperators
    }
}

struct EditableRuleActionDraft: Identifiable, Equatable {
    let id: String
    var actionType: RuleActionType
    var actionText: String
    var transactionType: TransactionKind

    init() {
        id = UUID().uuidString
        actionType = .setCategory
        actionText = ""
        transactionType = .expense
    }

    init(action: RuleAction) {
        id = action.id ?? UUID().uuidString
        actionType = action.type
        actionText = action.hashtag?.name ?? action.valueText ?? ""
        transactionType = TransactionKind(rawValue: action.valueText ?? "EXPENSE") ?? .expense
    }

    init(actionType: RuleActionType, text: String) {
        id = UUID().uuidString
        self.actionType = actionType
        actionText = text
        transactionType = TransactionKind(rawValue: text) ?? .expense
    }
}

extension EditableRuleDraft {
    func validate() throws {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw RuleValidationError.emptyName
        }

        for condition in conditions where condition.operatorValue.needsValue {
            if condition.field.usesNumber {
                if AmountInputFormatter.parse(condition.conditionNumber) == nil {
                    throw RuleValidationError.invalidCondition
                }
                if condition.operatorValue == .between, AmountInputFormatter.parse(condition.secondConditionNumber) == nil {
                    throw RuleValidationError.invalidCondition
                }
            }

            if !condition.field.usesNumber && !condition.field.usesDate && condition.conditionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                throw RuleValidationError.invalidCondition
            }
        }

        for action in actions where action.actionType != .setType {
            if action.actionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                throw RuleValidationError.invalidAction
            }
        }
    }
}

private func trimmed(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
        return nil
    }

    return value
}
