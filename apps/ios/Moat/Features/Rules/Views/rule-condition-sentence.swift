import SwiftUI

/// One condition rendered as editable prose: "Description contains my529".
struct RuleConditionSentence: View {
    @Binding var condition: EditableRuleConditionDraft
    let showsLeadingConnector: Bool
    var connector: String = "and"
    let canDelete: Bool
    let onDelete: () -> Void
    let onCommit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if showsLeadingConnector {
                Text(connector)
                    .font(InlineRuleTokenMetrics.font)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }
            sentence
        }
    }

    private var sentence: some View {
        InlineRuleSentence(accessibilityLabel: "Condition") {
            InlineRulePickerToken(
                accessibilityLabel: "Condition field",
                title: condition.field.title,
                options: RuleField.allCases.map {
                    InlineRuleOption(value: $0, title: $0.title, systemImage: $0.systemImage)
                },
                selection: $condition.field,
                onSelect: handleFieldChange
            )

            InlineRulePickerToken(
                accessibilityLabel: "Condition operator",
                title: condition.operatorValue.sentenceTitle,
                options: condition.conditionOperators.map {
                    InlineRuleOption(value: $0, title: $0.sentenceTitle)
                },
                selection: $condition.operatorValue,
                onSelect: { _ in onCommit() }
            )

            if condition.operatorValue.needsValue {
                valueTokens
            }
        } trailing: {
            if canDelete {
                InlineRuleRemoveButton(accessibilityLabel: "Remove condition", action: onDelete)
            }
        }
    }

    @ViewBuilder
    private var valueTokens: some View {
        if condition.field.usesNumber {
            numberTokens
        } else if condition.field.usesDate {
            dateTokens
        } else if condition.field == .category {
            RuleCategoryToken(
                accessibilityLabel: "Condition category",
                name: $condition.conditionText,
                onCommit: onCommit
            )
        } else {
            InlineRuleTextToken(
                accessibilityLabel: "Condition value",
                placeholder: "enter text",
                text: $condition.conditionText,
                onCommit: onCommit
            )
        }
    }

    @ViewBuilder
    private var numberTokens: some View {
        if condition.operatorValue == .between {
            amountToken(label: "Minimum amount", placeholder: "min", text: $condition.conditionNumber)
            InlineRuleStaticText("and")
            amountToken(label: "Maximum amount", placeholder: "max", text: $condition.secondConditionNumber)
        } else {
            amountToken(label: "Condition amount", placeholder: "amount", text: $condition.conditionNumber)
        }
    }

    @ViewBuilder
    private var dateTokens: some View {
        if condition.operatorValue == .between {
            InlineRuleDateToken(
                accessibilityLabel: "Start date",
                date: $condition.conditionDate,
                onChange: onCommit
            )
            InlineRuleStaticText("and")
            InlineRuleDateToken(
                accessibilityLabel: "End date",
                date: $condition.secondConditionDate,
                onChange: onCommit
            )
        } else {
            InlineRuleDateToken(
                accessibilityLabel: "Condition date",
                date: $condition.conditionDate,
                onChange: onCommit
            )
        }
    }

    private func amountToken(label: String, placeholder: String, text: Binding<String>) -> some View {
        InlineRuleTextToken(
            accessibilityLabel: label,
            placeholder: placeholder,
            text: text,
            keyboardType: .decimalPad,
            formatsGroupedNumber: true,
            fractionDigits: 2,
            onCommit: onCommit
        )
    }

    private func handleFieldChange(_ newField: RuleField) {
        if newField.usesNumber {
            condition.operatorValue = .greaterThan
        } else if newField.usesDate {
            condition.operatorValue = .on
        } else {
            condition.operatorValue = .contains
        }
        onCommit()
    }
}

extension RuleOperator {
    /// Operators read as part of a sentence here, not as standalone labels.
    var sentenceTitle: String {
        title.lowercased()
    }
}
