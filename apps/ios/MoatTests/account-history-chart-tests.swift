import XCTest
@testable import Moat

final class AccountHistoryChartTests: XCTestCase {
    private let now = date("2026-08-26")

    func testOneDayUsesTheLastTwoSnapshots() {
        let filtered = AccountHistoryMath.filter(points: sampleHistory, range: .oneDay, now: now)

        XCTAssertEqual(filtered.map(\.date), ["2026-08-25", "2026-08-26"])
        XCTAssertEqual(filtered.map(\.balance), [179_560, 178_621])
    }

    func testOneWeekAndOneMonthFilterToTheSelectedWindow() {
        let week = AccountHistoryMath.filter(points: sampleHistory, range: .oneWeek, now: now)
        let month = AccountHistoryMath.filter(points: sampleHistory, range: .oneMonth, now: now)

        XCTAssertEqual(week.map(\.date), [
            "2026-08-19",
            "2026-08-20",
            "2026-08-21",
            "2026-08-22",
            "2026-08-23",
            "2026-08-24",
            "2026-08-25",
            "2026-08-26",
        ])
        XCTAssertEqual(month.first?.date, "2026-07-27")
        XCTAssertEqual(month.last?.date, "2026-08-26")
        XCTAssertEqual(month.count, 9)
    }

    func testChartPointsFillTheSelectedRangeDayByDay() {
        let month = AccountHistoryMath.chartPoints(points: sampleHistory, range: .oneMonth, now: now)

        XCTAssertEqual(month.first?.date, "2026-07-27")
        XCTAssertEqual(month.last?.date, "2026-08-26")
        XCTAssertEqual(month.count, 31)
        XCTAssertEqual(month.first?.balance, 177_000)
        XCTAssertEqual(month.last?.balance, 178_621)
    }

    func testYearToDateAndAllKeepEarlierPoints() {
        let ytd = AccountHistoryMath.filter(points: sampleHistory, range: .ytd, now: now)
        let all = AccountHistoryMath.filter(points: sampleHistory, range: .all, now: now)

        XCTAssertEqual(ytd.first?.date, "2026-01-15")
        XCTAssertEqual(all.first?.date, "2025-12-31")
        XCTAssertEqual(all.count, sampleHistory.count)
    }

    func testChartPointsFillMissingDaysSoScrubbingHitsEachDay() {
        let sparse: [AccountBalanceHistoryPoint] = [
            AccountBalanceHistoryPoint(date: "2026-08-20", balance: 100),
            AccountBalanceHistoryPoint(date: "2026-08-23", balance: 130),
        ]

        let points = AccountHistoryMath.chartPoints(points: sparse, range: .oneWeek, now: now)

        XCTAssertEqual(points.map(\.date), [
            "2026-08-20",
            "2026-08-21",
            "2026-08-22",
            "2026-08-23",
        ])
        XCTAssertEqual(points.map(\.balance), [100, 100, 100, 130])
    }

    func testSinglePointSeriesStillDrawsALine() {
        let points = AccountHistoryMath.chartPoints(
            points: [AccountBalanceHistoryPoint(date: "2026-08-26", balance: 50)],
            range: .oneDay,
            now: now
        )

        XCTAssertEqual(points.count, 2)
        XCTAssertEqual(points.map(\.balance), [50, 50])
        XCTAssertEqual(points.last?.date, "2026-08-26")
        XCTAssertLessThan(points[0].parsedDate, points[1].parsedDate)
    }

    func testOneDayChartUsesSnapshotsWithoutFillingTheGap() {
        let sparse: [AccountBalanceHistoryPoint] = [
            AccountBalanceHistoryPoint(date: "2026-08-20", balance: 100),
            AccountBalanceHistoryPoint(date: "2026-08-26", balance: 140),
        ]

        let points = AccountHistoryMath.chartPoints(points: sparse, range: .oneDay, now: now)

        XCTAssertEqual(points.map(\.date), ["2026-08-20", "2026-08-26"])
        XCTAssertEqual(points.map(\.balance), [100, 140])
    }

    func testDeltaUsesFirstAndLastFilteredBalances() {
        let filtered = AccountHistoryMath.filter(points: sampleHistory, range: .oneMonth, now: now)
        let delta = AccountHistoryMath.delta(points: filtered)

        XCTAssertEqual(delta.absolute, 178_621 - 177_000, accuracy: 0.001)
        XCTAssertEqual(delta.percent, ((178_621 - 177_000) / 177_000) * 100, accuracy: 0.001)
    }

    func testYDomainZoomsToTheSeriesInsteadOfIncludingZero() {
        let points = AccountHistoryMath.chartPoints(points: sampleHistory, range: .oneMonth, now: now)
        let domain = AccountHistoryMath.yDomain(points: points)

        XCTAssertGreaterThan(domain.lowerBound, 100_000)
        XCTAssertLessThan(domain.lowerBound, points.map(\.balance).min() ?? 0)
        XCTAssertGreaterThan(domain.upperBound, points.map(\.balance).max() ?? 0)
        XCTAssertGreaterThan(domain.upperBound - domain.lowerBound, 0)
    }

    func testShorterRangesProduceATighterXDomainThanLongerRanges() {
        let week = AccountHistoryMath.xDomain(
            points: AccountHistoryMath.chartPoints(points: sampleHistory, range: .oneWeek, now: now)
        )
        let month = AccountHistoryMath.xDomain(
            points: AccountHistoryMath.chartPoints(points: sampleHistory, range: .oneMonth, now: now)
        )
        let all = AccountHistoryMath.xDomain(
            points: AccountHistoryMath.chartPoints(points: sampleHistory, range: .all, now: now)
        )

        XCTAssertLessThan(week.upperBound.timeIntervalSince(week.lowerBound), month.upperBound.timeIntervalSince(month.lowerBound))
        XCTAssertLessThan(month.upperBound.timeIntervalSince(month.lowerBound), all.upperBound.timeIntervalSince(all.lowerBound))
    }

    func testNearestPointChangesWhenScrubbingToTheNextDay() throws {
        let points = AccountHistoryMath.chartPoints(points: sampleHistory, range: .oneWeek, now: now)
        let first = try XCTUnwrap(points.first)
        let second = try XCTUnwrap(points.dropFirst().first)

        let nearestFirst = FinancialChartSelection.nearestPoint(
            to: first.parsedDate,
            in: points,
            date: \.parsedDate
        )
        let nearestSecond = FinancialChartSelection.nearestPoint(
            to: second.parsedDate,
            in: points,
            date: \.parsedDate
        )

        XCTAssertEqual(nearestFirst?.id, first.id)
        XCTAssertEqual(nearestSecond?.id, second.id)
        XCTAssertNotEqual(nearestFirst?.id, nearestSecond?.id)
    }

    func testMonthDayFormatterUsesTheSavedDate() {
        XCTAssertEqual(DateFormatterProvider.monthDay(date("2026-08-12")), "Aug 12")
    }

    private var sampleHistory: [AccountBalanceHistoryPoint] {
        [
            AccountBalanceHistoryPoint(date: "2025-12-31", balance: 170_000),
            AccountBalanceHistoryPoint(date: "2026-01-15", balance: 171_200),
            AccountBalanceHistoryPoint(date: "2026-07-01", balance: 176_500),
            AccountBalanceHistoryPoint(date: "2026-07-27", balance: 177_000),
            AccountBalanceHistoryPoint(date: "2026-08-19", balance: 179_100),
            AccountBalanceHistoryPoint(date: "2026-08-20", balance: 179_250),
            AccountBalanceHistoryPoint(date: "2026-08-21", balance: 179_400),
            AccountBalanceHistoryPoint(date: "2026-08-22", balance: 179_480),
            AccountBalanceHistoryPoint(date: "2026-08-23", balance: 179_510),
            AccountBalanceHistoryPoint(date: "2026-08-24", balance: 179_540),
            AccountBalanceHistoryPoint(date: "2026-08-25", balance: 179_560),
            AccountBalanceHistoryPoint(date: "2026-08-26", balance: 178_621),
        ]
    }
}

private func date(_ value: String) -> Date {
    DateFormatterProvider.parseYearMonthDay(value) ?? Date(timeIntervalSince1970: 0)
}
