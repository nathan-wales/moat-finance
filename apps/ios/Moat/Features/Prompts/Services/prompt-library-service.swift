import Foundation

enum PromptLibraryError: LocalizedError {
    case missingResource
    case decodeFailed

    var errorDescription: String? {
        switch self {
        case .missingResource:
            return "Prompt library data is missing from the app bundle."
        case .decodeFailed:
            return "Prompt library data could not be read."
        }
    }
}

final class PromptLibraryService {
    static let shared = PromptLibraryService()

    private var cachedPrompts: [AiPrompt]?

    func loadPrompts() throws -> [AiPrompt] {
        if let cachedPrompts {
            return cachedPrompts
        }

        guard let url = Bundle.main.url(forResource: "prompts", withExtension: "json") else {
            throw PromptLibraryError.missingResource
        }

        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        let prompts = try decoder.decode([AiPrompt].self, from: data)
        cachedPrompts = prompts
        return prompts
    }

    func getAllTags(from prompts: [AiPrompt]) -> [AiPromptTag] {
        var seen = Set<AiPromptTag>()
        for prompt in prompts {
            for tag in prompt.tags {
                seen.insert(tag)
            }
        }
        return seen.sorted { $0.rawValue < $1.rawValue }
    }

    func filterByTag(_ tag: AiPromptTag, in prompts: [AiPrompt]) -> [AiPrompt] {
        prompts.filter { $0.tags.contains(tag) }
    }

    func filterPrompts(
        in prompts: [AiPrompt],
        query: String,
        activeTag: PromptTagFilter
    ) -> [AiPrompt] {
        let tagFiltered: [AiPrompt]
        switch activeTag {
        case .all:
            tagFiltered = prompts
        case .tag(let tag):
            tagFiltered = filterByTag(tag, in: prompts)
        }

        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            return tagFiltered
        }

        let normalizedQuery = trimmedQuery.lowercased()
        return tagFiltered.filter { prompt in
            prompt.title.lowercased().contains(normalizedQuery)
                || prompt.tags.contains { $0.rawValue.contains(normalizedQuery) }
        }
    }

    func getPromptById(_ id: String, in prompts: [AiPrompt]) -> AiPrompt? {
        prompts.first { $0.id == id }
    }

    func assemblePrompt(_ prompt: AiPrompt, context: AiPromptContext = AiPromptContext()) -> String {
        var parts = [prompt.prompt]

        if context.currentDate != nil || context.accountCount != nil {
            var contextLines: [String] = []

            if let currentDate = context.currentDate {
                contextLines.append("Today's date: \(currentDate).")
            }

            if let accountCount = context.accountCount {
                let noun = accountCount == 1 ? "account" : "accounts"
                contextLines.append("I have \(accountCount) linked \(noun) in Moat Finance.")
            }

            parts.append("\n\nContext: \(contextLines.joined(separator: " "))")
        }

        return parts.joined()
    }

    func defaultContext(accountCount: Int? = nil) -> AiPromptContext {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return AiPromptContext(
            currentDate: formatter.string(from: Date()),
            accountCount: accountCount
        )
    }
}
