import SwiftUI

/// One action rendered as editable prose: "Set category to Investments".
struct RuleActionSentence: View {
    @Binding var action: EditableRuleActionDraft
    let canDelete: Bool
    let onDelete: () -> Void
    var onHashtagFocusChange: ((Bool) -> Void)? = nil

    var body: some View {
        InlineRuleSentence(accessibilityLabel: "Action") {
            InlineRulePickerToken(
                accessibilityLabel: "Action",
                title: action.actionType.displayTitle,
                options: RuleActionType.allCases.map {
                    InlineRuleOption(value: $0, title: $0.displayTitle, systemImage: $0.systemImage)
                },
                selection: $action.actionType,
                onSelect: handleActionTypeChange
            )

            valueTokens
        } trailing: {
            if canDelete {
                InlineRuleRemoveButton(accessibilityLabel: "Remove action", action: onDelete)
            }
        }
    }

    @ViewBuilder
    private var valueTokens: some View {
        switch action.actionType {
        case .setCategory:
            InlineRuleStaticText("to")
            RuleCategoryToken(
                accessibilityLabel: "Category to set",
                name: $action.actionText
            )
        case .setDescription:
            InlineRuleStaticText("to")
            InlineRuleTextToken(
                accessibilityLabel: "New description",
                placeholder: "new description",
                text: $action.actionText
            )
        case .setType:
            InlineRuleStaticText("hidden from lists and totals", systemImage: "eye.slash")
        case .addHashtag:
            InlineRuleTextToken(
                accessibilityLabel: "Hashtag",
                placeholder: "hashtag",
                text: $action.actionText,
                autocapitalization: .never,
                autocorrectionDisabled: true,
                onFocusChange: onHashtagFocusChange
            )
        }
    }

    private func handleActionTypeChange(_ actionType: RuleActionType) {
        onHashtagFocusChange?(false)
        action.actionText = actionType == .setType ? "SKIP" : ""
    }
}
