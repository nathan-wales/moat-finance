import UIKit

enum AskAIProvider: String {
    case chatGPT
    case claude
}

enum AskAIDispatchError: LocalizedError {
    case invalidURL

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Could not open the AI provider link."
        }
    }
}

struct AskAIDispatchService {
    func copyToClipboard(_ text: String) {
        UIPasteboard.general.string = text
    }

    func providerURL(for provider: AskAIProvider, prompt: String) throws -> URL {
        let encodedPrompt = prompt.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? prompt
        let urlString: String

        switch provider {
        case .chatGPT:
            urlString = "https://chatgpt.com/?q=\(encodedPrompt)"
        case .claude:
            urlString = "https://claude.ai/new?q=\(encodedPrompt)"
        }

        guard let url = URL(string: urlString) else {
            throw AskAIDispatchError.invalidURL
        }

        return url
    }

    @MainActor
    func openProvider(_ provider: AskAIProvider, prompt: String) throws {
        let url = try providerURL(for: provider, prompt: prompt)
        UIApplication.shared.open(url)
    }
}
