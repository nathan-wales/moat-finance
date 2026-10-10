import Foundation

struct RulePreviewAppliedState: Equatable {
    var date: Date
    var description: String?
    var amount: Double
    var type: TransactionKind
    var category: String?
    var hashtags: [String]

    init(transaction: RulePreviewTransaction) {
        date = transaction.date
        description = transaction.description
        amount = transaction.amount
        type = transaction.type
        category = transaction.category
        hashtags = transaction.hashtags
    }
}

enum RulePreviewHelpers {
    static func committedConditions(from conditions: [EditableRuleConditionDraft]) -> [EditableRuleConditionDraft] {
        conditions.filter(isCommittable)
    }

    static func hasActionsSet(_ actions: [EditableRuleActionDraft]) -> Bool {
        actions.contains { action in
            switch action.actionType {
            case .setType:
                return true
            default:
                return !action.actionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }
        }
    }

    static func applyActionsToPreview(
        _ transaction: RulePreviewTransaction,
        actions: [EditableRuleActionDraft]
    ) -> RulePreviewAppliedState {
        var result = RulePreviewAppliedState(transaction: transaction)

        for action in actions {
            switch action.actionType {
            case .setCategory:
                let value = action.actionText.trimmingCharacters(in: .whitespacesAndNewlines)
                if !value.isEmpty {
                    result.category = value
                }
            case .setDescription:
                let value = action.actionText.trimmingCharacters(in: .whitespacesAndNewlines)
                if !value.isEmpty {
                    result.description = value
                }
            case .setType:
                result.type = action.transactionType
            case .addHashtag:
                let tag = action.actionText
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .replacingOccurrences(of: "^#", with: "", options: .regularExpression)
                if !tag.isEmpty, !result.hashtags.contains(tag) {
                    result.hashtags.append(tag)
                }
            }
        }

        return result
    }

    private static func isCommittable(_ condition: EditableRuleConditionDraft) -> Bool {
        if !condition.operatorValue.needsValue {
            return true
        }

        if condition.field.usesNumber {
            guard AmountInputFormatter.parse(condition.conditionNumber) != nil else { return false }
            if condition.operatorValue == .between {
                return AmountInputFormatter.parse(condition.secondConditionNumber) != nil
            }
            return true
        }

        if condition.field.usesDate {
            return true
        }

        return !condition.conditionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
