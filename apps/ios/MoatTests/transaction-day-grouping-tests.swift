import XCTest
@testable import Moat

final class TransactionDayGroupingTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)

    func testChronologicalSortIsDateFieldOnly() {
        var filters = TransactionFilterState()
        XCTAssertTrue(filters.isChronologicalSort)

        filters.sortDescending = false
        XCTAssertTrue(filters.isChronologicalSort)

        filters.sortField = .amount
        XCTAssertFalse(filters.isChronologicalSort)

        filters.sortField = .account
        XCTAssertFalse(filters.isChronologicalSort)
    }

    func testGroupTransactionsByDayPreservesOrderAndNets() throws {
        let dayOne = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 8, day: 1)))
        let dayTwo = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 7, day: 31)))

        let transactions = [
            makeTransaction(id: "1", date: dayOne, amount: 10, type: .income),
            makeTransaction(id: "2", date: dayOne.addingTimeInterval(3_600), amount: 4, type: .expense),
            makeTransaction(id: "3", date: dayTwo, amount: 20, type: .expense),
        ]

        let groups = groupTransactionsByDay(transactions, calendar: calendar)

        XCTAssertEqual(groups.count, 2)
        XCTAssertEqual(groups[0].transactions.map(\.id), ["1", "2"])
        XCTAssertEqual(groups[0].dayNet, 6, accuracy: 0.001)
        XCTAssertEqual(groups[1].transactions.map(\.id), ["3"])
        XCTAssertEqual(groups[1].dayNet, -20, accuracy: 0.001)
    }

    func testDisplaySubtitleIsDateOnly() throws {
        let date = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 7, day: 30)))
        let transaction = makeTransaction(
            id: "card",
            date: date,
            amount: 12,
            type: .expense,
            account: "Apple Card"
        )

        XCTAssertEqual(transaction.displaySubtitle, DateFormatterProvider.fullDate(date))
        XCTAssertFalse(transaction.displaySubtitle.contains("Apple Card"))
    }

    func testPendingFlagTracksPostedUpdates() {
        let pending = makeTransaction(
            id: "pending",
            date: Date(),
            amount: 9,
            type: .expense,
            pending: true,
            source: "PLAID",
            category: "Eating Out"
        )
        let posted = makeTransaction(
            id: "posted",
            date: Date(),
            amount: 9,
            type: .expense,
            pending: false,
            source: "PLAID",
            category: "Eating Out"
        )

        XCTAssertTrue(pending.isPendingTransaction)
        XCTAssertTrue(pending.isPendingPlaidTransaction)
        XCTAssertFalse(posted.isPendingTransaction)
        XCTAssertFalse(posted.isPendingPlaidTransaction)
        XCTAssertEqual(pending.displayCategorySystemImage, CategoryItem.systemImage(forName: "Eating Out"))
    }

    func testCategoryIconPrefersCategoryRefIconKey() {
        let transaction = makeTransaction(
            id: "icon",
            date: Date(),
            amount: 5,
            type: .income,
            category: "Salary",
            categoryRef: TransactionCategoryRef(id: "c1", name: "Salary", icon: "wallet")
        )

        XCTAssertEqual(
            transaction.displayCategorySystemImage,
            CategoryIconCatalog.systemImage(forKey: "wallet") ?? "wallet.pass.fill"
        )
    }

    func testGroupSplitTransactionsKeepsChildrenWhenParentIsMissing() throws {
        let day = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 8, day: 1)))
        let other = makeTransaction(id: "other", date: day, amount: 9, type: .expense)
        let childB = makeTransaction(
            id: "child-b",
            date: day,
            amount: 40,
            type: .expense,
            splitGroupId: "parent",
            splitParentId: "parent"
        )
        let childA = makeTransaction(
            id: "child-a",
            date: day,
            amount: 60,
            type: .expense,
            splitGroupId: "parent",
            splitParentId: "parent"
        )

        let grouped = groupSplitTransactions([other, childB, childA])
        XCTAssertEqual(grouped.map(\.id), ["other", "child-b", "child-a"])
        XCTAssertEqual(childA.splitSiblings(in: grouped).map(\.id), ["child-b"])
        XCTAssertTrue(childA.hasExistingSplit)
        XCTAssertFalse(childA.canEditAmount)
    }

    private func makeTransaction(
        id: String,
        date: Date,
        amount: Double,
        type: TransactionKind,
        account: String? = nil,
        pending: Bool? = nil,
        source: String? = nil,
        category: String? = nil,
        categoryRef: TransactionCategoryRef? = nil,
        splitGroupId: String? = nil,
        splitParentId: String? = nil
    ) -> TransactionItem {
        TransactionItem(
            id: id,
            date: date,
            postedDate: nil,
            amount: amount,
            type: type,
            category: category,
            categoryId: nil,
            description: "Test",
            originalDescription: nil,
            merchantName: nil,
            account: account,
            source: source,
            pending: pending,
            hidden: nil,
            splitGroupId: splitGroupId,
            splitParentId: splitParentId,
            splitOriginalAmount: nil,
            appliedRuleId: nil,
            hashtags: nil,
            categoryRef: categoryRef
        )
    }
}
