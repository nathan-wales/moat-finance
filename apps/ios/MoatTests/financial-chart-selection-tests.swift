import XCTest
@testable import Moat

final class FinancialChartSelectionTests: XCTestCase {
    func testNearestPointReturnsNilForEmptyDataset() {
        let point: FinancialChartSelectionPoint<String>? = FinancialChartSelection.nearestPoint(
            to: Date(timeIntervalSince1970: 0),
            in: []
        )

        XCTAssertNil(point)
    }

    func testNearestPointReturnsSinglePoint() throws {
        let target = try makeDate("2024-02")
        let onlyPoint = FinancialChartSelectionPoint(id: "jan", date: try makeDate("2024-01"), value: 10)

        let nearest = FinancialChartSelection.nearestPoint(to: target, in: [onlyPoint])

        XCTAssertEqual(nearest, onlyPoint)
    }

    func testNearestPointChoosesClosestDateWithMissingMonths() throws {
        let points = [
            FinancialChartSelectionPoint(id: "jan", date: try makeDate("2024-01"), value: 100),
            FinancialChartSelectionPoint(id: "apr", date: try makeDate("2024-04"), value: 400),
            FinancialChartSelectionPoint(id: "dec", date: try makeDate("2024-12"), value: 1_200),
        ]

        let nearest = FinancialChartSelection.nearestPoint(to: try makeDate("2024-05"), in: points)

        XCTAssertEqual(nearest?.id, "apr")
    }

    func testNearestPointKeepsStableEarlierPointForDuplicateDates() throws {
        let duplicateDate = try makeDate("2024-03")
        let points = [
            FinancialChartSelectionPoint(id: "first", date: duplicateDate, value: 1),
            FinancialChartSelectionPoint(id: "second", date: duplicateDate, value: 2),
        ]

        let nearest = FinancialChartSelection.nearestPoint(to: duplicateDate, in: points)

        XCTAssertEqual(nearest?.id, "first")
    }

    func testPaddedDomainHandlesEmptyAndSinglePointDatasets() {
        XCTAssertEqual(FinancialChartSelection.paddedDomain(values: [], includeZero: true), 0...1)

        let singlePointDomain = FinancialChartSelection.paddedDomain(values: [25], includeZero: false)

        XCTAssertLessThan(singlePointDomain.lowerBound, 25)
        XCTAssertGreaterThan(singlePointDomain.upperBound, 25)
    }

    func testPaddedDomainIncludesZeroForAllPositiveAndAllNegativeValues() {
        let positiveDomain = FinancialChartSelection.paddedDomain(values: [10, 20, 30], includeZero: true)
        let negativeDomain = FinancialChartSelection.paddedDomain(values: [-30, -20, -10], includeZero: true)

        XCTAssertLessThanOrEqual(positiveDomain.lowerBound, 0)
        XCTAssertGreaterThan(positiveDomain.upperBound, 30)
        XCTAssertLessThan(negativeDomain.lowerBound, -30)
        XCTAssertGreaterThanOrEqual(negativeDomain.upperBound, 0)
    }

    func testPaddedDomainHandlesMixedAndZeroValues() {
        let mixedDomain = FinancialChartSelection.paddedDomain(values: [-12.5, 0, 37.25], includeZero: true)

        XCTAssertLessThan(mixedDomain.lowerBound, -12.5)
        XCTAssertGreaterThan(mixedDomain.upperBound, 37.25)
    }

    func testCurrencyAndPercentFormatting() {
        XCTAssertEqual(FinancialChartFormatting.signedCurrency(25), "+$25")
        XCTAssertEqual(FinancialChartFormatting.signedCurrency(-25), "-$25")
        XCTAssertEqual(FinancialChartFormatting.signedCurrency(0), "$0")
        XCTAssertEqual(FinancialChartFormatting.percent(42.4), "42%")
        XCTAssertEqual(FinancialChartFormatting.ratioPercent(0.314), "31%")
    }

    func testDateLabelFormatting() throws {
        let date = try makeDate("2026-04")

        XCTAssertEqual(FinancialChartFormatting.month(date), "Apr")
        XCTAssertEqual(FinancialChartFormatting.monthYear(date), "Apr 2026")
    }

    private func makeDate(_ value: String) throws -> Date {
        try XCTUnwrap(DateFormatterProvider.parseYearMonth(value))
    }
}
