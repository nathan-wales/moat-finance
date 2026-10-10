import Foundation

enum TransactionRuleMatcher {
    static func matchingRule(
        for transaction: TransactionItem,
        originalDescription: String,
        in rules: [TransactionRule]
    ) -> TransactionRule? {
        let activeRules = rules
            .filter(\.isActive)
            .sorted { $0.priority < $1.priority }

        guard !activeRules.isEmpty else { return nil }

        let descriptionCandidates = uniqueLowercased([
            originalDescription,
            transaction.description,
            transaction.merchantName,
            transaction.displayTitle,
        ])

        if let exactNameMatch = activeRules.first(where: { rule in
            let name = rule.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return descriptionCandidates.contains(name)
        }) {
            return exactNameMatch
        }

        return activeRules.first { rule in
            matchesRule(
                rule,
                transaction: transaction,
                descriptionCandidates: descriptionCandidates
            )
        }
    }

    private static func matchesRule(
        _ rule: TransactionRule,
        transaction: TransactionItem,
        descriptionCandidates: [String]
    ) -> Bool {
        let groups = rule.resolvedGroups
        guard !groups.isEmpty else { return false }

        let groupResults = groups.map { group in
            matchesGroup(
                group,
                transaction: transaction,
                descriptionCandidates: descriptionCandidates
            )
        }

        return rule.resolvedMatch == .all
            ? groupResults.allSatisfy { $0 }
            : groupResults.contains(true)
    }

    private static func matchesGroup(
        _ group: RuleConditionGroup,
        transaction: TransactionItem,
        descriptionCandidates: [String]
    ) -> Bool {
        guard !group.conditions.isEmpty else { return false }
        let results = group.conditions.map { condition in
            matches(
                condition: condition,
                transaction: transaction,
                descriptionCandidates: descriptionCandidates
            )
        }
        return group.resolvedMatch == .all
            ? results.allSatisfy { $0 }
            : results.contains(true)
    }

    private static func matches(
        condition: RuleCondition,
        transaction: TransactionItem,
        descriptionCandidates: [String]
    ) -> Bool {
        switch condition.field {
        case .merchant, .description:
            return matchesText(
                operatorValue: condition.operatorValue,
                target: condition.valueText,
                candidates: descriptionCandidates
            )
        case .category:
            let category = transaction.displayCategory
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            return matchesText(
                operatorValue: condition.operatorValue,
                target: condition.valueText,
                candidates: [category]
            )
        case .account:
            let account = (transaction.account ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            return matchesText(
                operatorValue: condition.operatorValue,
                target: condition.valueText,
                candidates: [account]
            )
        case .amount:
            return matchesAmount(
                operatorValue: condition.operatorValue,
                amount: transaction.amount,
                target: condition.valueNumber,
                second: condition.secondValueNumber
            )
        case .date, .notes:
            return true
        }
    }

    private static func matchesText(
        operatorValue: RuleOperator,
        target: String?,
        candidates: [String]
    ) -> Bool {
        let needle = (target ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        switch operatorValue {
        case .contains:
            guard !needle.isEmpty else { return false }
            return candidates.contains { $0.contains(needle) }
        case .notContains:
            guard !needle.isEmpty else { return true }
            return candidates.allSatisfy { !$0.contains(needle) }
        case .startsWith:
            guard !needle.isEmpty else { return false }
            return candidates.contains { $0.hasPrefix(needle) }
        case .endsWith:
            guard !needle.isEmpty else { return false }
            return candidates.contains { $0.hasSuffix(needle) }
        case .equals:
            return candidates.contains(needle)
        case .notEquals:
            return candidates.allSatisfy { $0 != needle }
        case .isEmpty:
            return candidates.allSatisfy(\.isEmpty)
        case .isNotEmpty:
            return candidates.contains { !$0.isEmpty }
        default:
            return false
        }
    }

    private static func matchesAmount(
        operatorValue: RuleOperator,
        amount: Double,
        target: Double?,
        second: Double?
    ) -> Bool {
        guard let target else { return false }

        switch operatorValue {
        case .equals:
            return amount == target
        case .notEquals:
            return amount != target
        case .greaterThan:
            return amount > target
        case .greaterThanOrEqual:
            return amount >= target
        case .lessThan:
            return amount < target
        case .lessThanOrEqual:
            return amount <= target
        case .between:
            guard let second else { return false }
            let lower = min(target, second)
            let upper = max(target, second)
            return amount >= lower && amount <= upper
        default:
            return false
        }
    }

    private static func uniqueLowercased(_ values: [String?]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []

        for value in values {
            guard let trimmed = value?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased(),
                !trimmed.isEmpty,
                !seen.contains(trimmed)
            else { continue }

            seen.insert(trimmed)
            result.append(trimmed)
        }

        return result
    }
}
