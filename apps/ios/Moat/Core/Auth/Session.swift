import Foundation

/// Represents the user's authentication session
struct Session: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
    let userId: String?
    let email: String?
    let name: String?
    
    /// Whether the access token has expired
    var isExpired: Bool {
        Date() >= expiresAt
    }
    
    /// Whether the access token will expire soon (within 5 minutes)
    var expiresSoon: Bool {
        Date().addingTimeInterval(300) >= expiresAt
    }
}

enum SessionMappingError: LocalizedError {
    case missingRefreshToken

    var errorDescription: String? {
        switch self {
        case .missingRefreshToken:
            return "Authentication response did not include a refresh token."
        }
    }
}

// MARK: - API Response Mapping

extension Session {
    /// Creates a Session from the API auth exchange response
    init(
        from response: AuthTokenResponse,
        email: String? = nil,
        fallbackRefreshToken: String? = nil,
        existingSession: Session? = nil
    ) throws {
        guard let refreshToken = response.refreshToken ?? fallbackRefreshToken else {
            throw SessionMappingError.missingRefreshToken
        }

        self.accessToken = response.accessToken
        self.refreshToken = refreshToken
        self.expiresAt = response.expiresAt
        self.userId = response.user?.id ?? existingSession?.userId
        self.email = email ?? response.email ?? existingSession?.email
        self.name = response.user?.name ?? existingSession?.name
    }
}
