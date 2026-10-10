import XCTest
@testable import Moat

final class HashtagSuggestionsTests: XCTestCase {
    private let hashtags = [
        HashtagSummary(id: "1", name: "wildflower-monthly", normalizedName: "wildflower-monthly"),
        HashtagSummary(id: "2", name: "wildflower-month", normalizedName: "wildflower-month"),
        HashtagSummary(id: "3", name: "wildflower-rent", normalizedName: "wildflower-rent"),
        HashtagSummary(id: "4", name: "monthly-rent", normalizedName: "monthly-rent"),
        HashtagSummary(id: "5", name: "mortgage-monthly", normalizedName: "mortgage-monthly"),
        HashtagSummary(id: "6", name: "housing", normalizedName: "housing"),
    ]

    func testPrefixMatchesRankAboveFuzzyMatches() {
        let results = HashtagSuggestions.matching(
            from: hashtags,
            query: "wildflower-monthl"
        ).map(\.name)

        XCTAssertEqual(results.first, "wildflower-monthly")
        XCTAssertTrue(results.contains("wildflower-month"))
        XCTAssertLessThan(
            results.firstIndex(of: "wildflower-monthly") ?? .max,
            results.firstIndex(of: "monthly-rent") ?? .max
        )
    }

    func testKeyboardSuggestionsExcludeExactQueryAndCapResults() {
        let results = HashtagSuggestions.keyboardSuggestions(
            from: hashtags,
            query: "wildflower-monthly"
        )

        XCTAssertFalse(results.contains("wildflower-monthly"))
        XCTAssertLessThanOrEqual(results.count, HashtagSuggestions.maxKeyboardResults)
    }

    func testKeyboardSuggestionsHideWhenNoUsefulMatches() {
        let results = HashtagSuggestions.keyboardSuggestions(
            from: [HashtagSummary(id: "1", name: "rent", normalizedName: "rent")],
            query: "rent"
        )

        XCTAssertTrue(results.isEmpty)
    }

    func testExcludesSelectedHashtags() {
        let results = HashtagSuggestions.matching(
            from: hashtags,
            excluding: ["#Housing", "monthly-rent"],
            query: "hous"
        ).map(\.name)

        XCTAssertFalse(results.contains("housing"))
        XCTAssertFalse(results.contains("monthly-rent"))
    }

    func testEmptyQueryReturnsSortedAvailableHashtags() {
        let results = HashtagSuggestions.matching(from: hashtags, query: "").map(\.name)

        XCTAssertEqual(results.first, "housing")
        XCTAssertEqual(results.count, hashtags.count)
    }
}
