import Foundation

enum HashtagSuggestions {
    static let maxKeyboardResults = 8

    static func matching(
        from hashtags: [HashtagSummary],
        excluding selected: [String] = [],
        query: String,
        limit: Int? = nil
    ) -> [HashtagSummary] {
        let selectedKeys = Set(selected.map { normalized($0) })
        let available = hashtags.filter { !selectedKeys.contains(normalized($0.name)) }
        let trimmedQuery = normalized(query)

        let ranked: [HashtagSummary]
        if trimmedQuery.isEmpty {
            ranked = available.sorted {
                $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
        } else {
            ranked = available
                .compactMap { hashtag -> (HashtagSummary, Int)? in
                    guard let score = fuzzyScore(candidate: hashtag.name, query: trimmedQuery) else {
                        return nil
                    }
                    return (hashtag, score)
                }
                .sorted { lhs, rhs in
                    if lhs.1 == rhs.1 {
                        return lhs.0.name.localizedCaseInsensitiveCompare(rhs.0.name) == .orderedAscending
                    }
                    return lhs.1 > rhs.1
                }
                .map(\.0)
        }

        guard let limit else { return ranked }
        return Array(ranked.prefix(limit))
    }

    static func keyboardSuggestions(
        from hashtags: [HashtagSummary],
        excluding selected: [String] = [],
        query: String
    ) -> [String] {
        let trimmedQuery = normalized(query)
        let matches = matching(
            from: hashtags,
            excluding: selected,
            query: trimmedQuery,
            limit: maxKeyboardResults + 1
        )

        return matches
            .map(\.name)
            .filter { normalized($0) != trimmedQuery }
            .prefix(maxKeyboardResults)
            .map { $0 }
    }

    static func normalized(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
            .lowercased()
    }

    private static func fuzzyScore(candidate: String, query: String) -> Int? {
        let normalizedCandidate = candidate.lowercased()
        let normalizedQuery = query.lowercased()

        if normalizedCandidate == normalizedQuery { return 1_000 }
        if normalizedCandidate.hasPrefix(normalizedQuery) {
            return 900 - normalizedCandidate.count
        }

        var candidateIndex = normalizedCandidate.startIndex
        var score = 0
        for queryCharacter in normalizedQuery {
            var matched = false
            while candidateIndex < normalizedCandidate.endIndex {
                if normalizedCandidate[candidateIndex] == queryCharacter {
                    score += 10
                    candidateIndex = normalizedCandidate.index(after: candidateIndex)
                    matched = true
                    break
                }
                candidateIndex = normalizedCandidate.index(after: candidateIndex)
            }
            if !matched { return nil }
        }

        return score - normalizedCandidate.count
    }
}
