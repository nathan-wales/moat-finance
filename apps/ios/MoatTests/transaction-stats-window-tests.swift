import XCTest
@testable import Moat

final class TransactionStatsWindowTests: XCTestCase {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        return calendar
    }()

    func testDefaultStartDateIsStartOfDayThirtyDaysAgo() throws {
        let now = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 8, day: 26, hour: 15)))
        let start = TransactionStatsWindow.defaultStartDate(now: now, calendar: calendar)
        let expected = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 7, day: 27)))

        XCTAssertEqual(start, expected)
    }

    func testSummaryFiltersUseLookbackWhenListHasNoDateFilter() throws {
        let lookback = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 7, day: 27)))
        var listFilters = TransactionFilterState()
        listFilters.category = "Groceries"
        listFilters.type = .expense
        listFilters.cursor = 40

        let statsFilters = TransactionStatsWindow.summaryFilters(from: listFilters, lookbackStart: lookback)

        XCTAssertEqual(statsFilters.startDate, lookback)
        XCTAssertNil(statsFilters.endDate)
        XCTAssertEqual(statsFilters.category, "Groceries")
        XCTAssertEqual(statsFilters.type, .expense)
        XCTAssertEqual(statsFilters.cursor, 0)
        XCTAssertNil(listFilters.startDate)
    }

    func testSummaryFiltersKeepExplicitDateRange() throws {
        let lookback = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 7, day: 27)))
        let startDate = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 1, day: 1)))
        let endDate = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 1, day: 31)))
        var listFilters = TransactionFilterState()
        listFilters.startDate = startDate
        listFilters.endDate = endDate

        let statsFilters = TransactionStatsWindow.summaryFilters(from: listFilters, lookbackStart: lookback)

        XCTAssertEqual(statsFilters.startDate, startDate)
        XCTAssertEqual(statsFilters.endDate, endDate)
    }

    func testLookbackExpandsWhenOlderVisibleTransactionIsScrolledIntoView() throws {
        let current = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 7, day: 27)))
        let oldestVisible = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 6, day: 10, hour: 18)))
        let expected = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 6, day: 10)))

        let expanded = TransactionStatsWindow.expandedLookbackStart(
            current: current,
            oldestVisibleDate: oldestVisible,
            hasExplicitDateFilter: false,
            calendar: calendar
        )

        XCTAssertEqual(expanded, expected)
    }

    func testLookbackDoesNotShrinkForNewerVisibleTransactions() throws {
        let current = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 6, day: 10)))
        let oldestVisible = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 8, day: 20)))

        let expanded = TransactionStatsWindow.expandedLookbackStart(
            current: current,
            oldestVisibleDate: oldestVisible,
            hasExplicitDateFilter: false,
            calendar: calendar
        )

        XCTAssertNil(expanded)
    }

    func testLookbackDoesNotExpandWhenUserSetADateFilter() throws {
        let current = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 7, day: 27)))
        let oldestVisible = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 1, day: 1)))

        let expanded = TransactionStatsWindow.expandedLookbackStart(
            current: current,
            oldestVisibleDate: oldestVisible,
            hasExplicitDateFilter: true,
            calendar: calendar
        )

        XCTAssertNil(expanded)
    }
}
