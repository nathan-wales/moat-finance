import Foundation

actor RulesService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func loadCategories() async throws -> [CategoryItem] {
        try await apiClient.get(path: "/api/v1/category/list")
    }

    func load() async throws -> RulesLoadResult {
        async let rules: [TransactionRule] = apiClient.get(path: "/api/v1/rule/list")
        async let settings: RuleSettings? = apiClient.get(path: "/api/v1/rule/getSettings")
        async let categories: [CategoryItem] = apiClient.get(path: "/api/v1/category/list")
        async let hashtags: [HashtagSummary] = apiClient.get(path: "/api/v1/hashtag/list")

        return try await RulesLoadResult(
            rules: rules,
            settings: settings,
            categories: categories,
            hashtags: hashtags
        )
    }

    func save(rule: TransactionRule?, draft: EditableRuleDraft) async throws -> TransactionRule {
        var body: [String: JSONValue] = [
            "name": .string(draft.name.trimmingCharacters(in: .whitespacesAndNewlines)),
            "match": .string(draft.match.rawValue),
            "conditions": .array(draft.conditions.map(conditionBody(from:))),
            "conditionGroups": .array(draft.groups.map { group in
                .object([
                    "match": .string(group.match.rawValue),
                    "conditions": .array(group.conditions.map(conditionBody(from:)))
                ])
            }),
            "actions": .array(draft.actions.map(actionBody(from:)))
        ]

        let path: String
        if let rule {
            body["id"] = .string(rule.id)
            path = "/api/v1/rule/update"
        } else {
            path = "/api/v1/rule/create"
        }

        return try await apiClient.post(path: path, body: .object(body))
    }

    func delete(id: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/rule/delete",
            body: .object(["id": .string(id)])
        )
    }

    func getById(id: String) async throws -> TransactionRule {
        try await apiClient.post(
            path: "/api/v1/rule/getById",
            body: .object(["id": .string(id)])
        )
    }

    func resolveForTransaction(transactionId: String) async throws -> ResolvedTransactionRule {
        try await apiClient.post(
            path: "/api/v1/rule/resolveForTransaction",
            body: .object(["transactionId": .string(transactionId)])
        )
    }

    func linkToTransaction(transactionId: String, ruleId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/rule/linkToTransaction",
            body: .object([
                "transactionId": .string(transactionId),
                "ruleId": .string(ruleId)
            ])
        )
    }

    func reorder(orderedIds: [String]) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/rule/reorder",
            body: .object(["orderedIds": .array(orderedIds.map(JSONValue.string))])
        )
    }

    func toggleActive(id: String, isActive: Bool) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/rule/toggleActive",
            body: .object([
                "id": .string(id),
                "isActive": .bool(isActive)
            ])
        )
    }

    func previewMatchCount(id: String) async throws -> RulePreviewCount {
        try await apiClient.post(
            path: "/api/v1/rule/previewMatchCount",
            body: .object(["id": .string(id)])
        )
    }

    func previewConditions(draft: EditableRuleDraft, appliedRuleId: String? = nil) async throws -> RuleDraftPreview {
        // A group with nothing committable yet would fail server-side validation,
        // so half-typed groups are left out of the preview entirely.
        let committedGroups = draft.groups.compactMap {
            group -> (match: RuleMatch, conditions: [EditableRuleConditionDraft])? in
            let conditions = RulePreviewHelpers.committedConditions(from: group.conditions)
            return conditions.isEmpty ? nil : (match: group.match, conditions: conditions)
        }

        var body: [String: JSONValue] = [
            "match": .string(draft.match.rawValue),
            "conditions": .array(committedGroups.flatMap { $0.conditions }.map(conditionBody(from:))),
            "conditionGroups": .array(committedGroups.map { group in
                .object([
                    "match": .string(group.match.rawValue),
                    "conditions": .array(group.conditions.map(conditionBody(from:)))
                ])
            })
        ]

        if let appliedRuleId {
            body["appliedRuleId"] = .string(appliedRuleId)
        }

        return try await apiClient.post(
            path: "/api/v1/rule/previewConditions",
            body: .object(body)
        )
    }

    func applyHistorical(id: String) async throws -> HistoricalApplyResult {
        try await apiClient.post(
            path: "/api/v1/rule/applyHistorical",
            body: .object(["id": .string(id)])
        )
    }

    func updateSettings(_ preference: RuleExecutionPreference) async throws -> RuleSettings {
        try await apiClient.post(
            path: "/api/v1/rule/updateSettings",
            body: .object(["ruleExecutionPreference": .string(preference.rawValue)])
        )
    }

    private func conditionBody(from condition: EditableRuleConditionDraft) -> JSONValue {
        var body: [String: JSONValue] = [
            "field": .string(condition.field.rawValue),
            "operator": .string(condition.operatorValue.rawValue),
            "valueText": .null,
            "valueNumber": .null,
            "valueDate": .null,
            "secondValueNumber": .null,
            "secondValueDate": .null
        ]

        if condition.operatorValue.needsValue {
            if condition.field.usesNumber {
                body["valueNumber"] = .number(AmountInputFormatter.parse(condition.conditionNumber) ?? 0)
                if condition.operatorValue == .between {
                    body["secondValueNumber"] = .number(AmountInputFormatter.parse(condition.secondConditionNumber) ?? 0)
                }
            } else if condition.field.usesDate {
                body["valueDate"] = .string(RuleDateEncoding.string(from: condition.conditionDate))
                if condition.operatorValue == .between {
                    body["secondValueDate"] = .string(RuleDateEncoding.string(from: condition.secondConditionDate))
                }
            } else {
                body["valueText"] = .string(condition.conditionText.trimmingCharacters(in: .whitespacesAndNewlines))
            }
        }

        return .object(body)
    }

    private func actionBody(from action: EditableRuleActionDraft) -> JSONValue {
        let value: String
        switch action.actionType {
        case .setType:
            value = "SKIP"
        default:
            value = action.actionText.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return .object([
            "type": .string(action.actionType.rawValue),
            "valueText": .string(value),
            "hashtagId": .null
        ])
    }
}

private enum RuleDateEncoding {
    private static let formatter = ISO8601DateFormatter()

    static func string(from date: Date) -> String {
        formatter.string(from: date)
    }
}
