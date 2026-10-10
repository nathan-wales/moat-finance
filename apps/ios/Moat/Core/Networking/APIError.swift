import Foundation

/// Errors that can occur during API requests
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, message: String?)
    case decodingError(Error)
    case networkError(Error)
    case unauthorized
    case serverError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode, let message):
            return message ?? "HTTP error \(statusCode)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unauthorized:
            return "Unauthorized. Please sign in again."
        case .serverError(let message):
            return message
        }
    }
    
    var isUnauthorized: Bool {
        if case .unauthorized = self { return true }
        if case .httpError(let code, _) = self { return code == 401 }
        return false
    }
}

/// Standard error response from the API
struct APIErrorResponse: Decodable {
    let error: String?
    let message: String?
    
    var displayMessage: String {
        error ?? message ?? "An unknown error occurred"
    }
}
