import XCTest
@testable import Moat

final class TransactionRuleMatcherTests: XCTestCase {
    func testMatchesRuleByExactName() {
        let transaction = makeTransaction(description: "Tithing")
        let rules = [
            makeRule(id: "rule-1", name: "Tithing", conditions: [
                makeCondition(field: .description, operatorValue: .contains, valueText: "Tithe"),
            ]),
        ]

        let matched = TransactionRuleMatcher.matchingRule(
            for: transaction,
            originalDescription: "Tithing",
            in: rules
        )

        XCTAssertEqual(matched?.id, "rule-1")
    }

    func testMatchesRuleByDescriptionContains() {
        let transaction = makeTransaction(description: "Tithing")
        let rules = [
            makeRule(id: "rule-1", name: "Church giving", conditions: [
                makeCondition(field: .description, operatorValue: .contains, valueText: "Tithing"),
            ]),
        ]

        let matched = TransactionRuleMatcher.matchingRule(
            for: transaction,
            originalDescription: "ACH TITHING TRANSFER",
            in: rules
        )

        XCTAssertEqual(matched?.id, "rule-1")
    }

    func testIgnoresInactiveRules() {
        let transaction = makeTransaction(description: "Tithing")
        let rules = [
            makeRule(id: "rule-1", name: "Tithing", isActive: false, conditions: [
                makeCondition(field: .description, operatorValue: .contains, valueText: "Tithing"),
            ]),
        ]

        let matched = TransactionRuleMatcher.matchingRule(
            for: transaction,
            originalDescription: "Tithing",
            in: rules
        )

        XCTAssertNil(matched)
    }

    private func makeTransaction(description: String) -> TransactionItem {
        TransactionItem(
            id: "tx-1",
            date: Date(timeIntervalSince1970: 0),
            postedDate: nil,
            amount: 10,
            type: .expense,
            category: "Tithing",
            categoryId: nil,
            description: description,
            originalDescription: description,
            merchantName: nil,
            account: "Checking",
            source: "PLAID",
            pending: false,
            hidden: false,
            splitGroupId: nil,
            splitParentId: nil,
            splitOriginalAmount: nil,
            appliedRuleId: nil,
            hashtags: nil,
            categoryRef: nil
        )
    }

    private func makeRule(
        id: String,
        name: String,
        isActive: Bool = true,
        conditions: [RuleCondition]
    ) -> TransactionRule {
        TransactionRule(
            id: id,
            name: name,
            isActive: isActive,
            priority: 1,
            match: .all,
            applyModePreference: nil,
            createdAt: nil,
            updatedAt: nil,
            conditions: conditions,
            conditionGroups: nil,
            actions: [
                RuleAction(
                    id: "action-1",
                    sortOrder: 0,
                    type: .setCategory,
                    valueText: "Tithing",
                    hashtagId: nil,
                    hashtag: nil
                ),
            ]
        )
    }

    private func makeCondition(
        field: RuleField,
        operatorValue: RuleOperator,
        valueText: String
    ) -> RuleCondition {
        RuleCondition(
            id: UUID().uuidString,
            sortOrder: 0,
            field: field,
            operatorValue: operatorValue,
            valueText: valueText,
            valueNumber: nil,
            valueDate: nil,
            secondValueNumber: nil,
            secondValueDate: nil
        )
    }
}
