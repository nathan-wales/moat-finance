import Foundation

struct McpPersonalAccessToken: Decodable, Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let tokenPrefix: String
    let scopes: [String]
    let clientName: String?
    let expiresAt: Date?
    let revokedAt: Date?
    let lastUsedAt: Date?
    let createdAt: Date

    var status: AIAccessStatus {
        AIAccessStatus.resolve(revokedAt: revokedAt, expiresAt: expiresAt)
    }
}

struct CreatedMcpPersonalAccessToken: Decodable, Equatable {
    let id: String
    let name: String
    let tokenPrefix: String
    let scopes: [String]
    let clientName: String?
    let expiresAt: Date?
    let createdAt: Date
    let token: String
}

struct McpOAuthClientConnection: Decodable, Identifiable, Equatable, Hashable {
    let oauthClientId: String
    let oauthClientIds: [String]
    let clientId: String
    let name: String
    let clientProfile: String
    let tokenPrefix: String
    let scopes: [String]
    let connectedAt: Date
    let lastUsedAt: Date?
    let expiresAt: Date
    let refreshTokenExpiresAt: Date?
    let revokedAt: Date?

    var id: String { oauthClientIds.joined(separator: ":") }

    var displayName: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? clientProfile : trimmed
    }

    var status: AIAccessStatus {
        if revokedAt != nil { return .revoked }
        let expires = refreshTokenExpiresAt ?? expiresAt
        if expires <= Date() { return .expired }
        return .active
    }
}

struct McpLogEntry: Decodable, Identifiable, Equatable, Hashable {
    let id: String
    let clientName: String?
    let clientProfile: String?
    let toolName: String
    let status: String
    let durationMs: Int
    let errorCode: String?
    let rateLimited: Bool
    let requiredScopes: [String]
    let grantedScopes: [String]
    let createdAt: Date
    let personalAccessTokenId: String?
    let oauthAccessTokenId: String?

    var authTypeLabel: String {
        if personalAccessTokenId != nil { return "PAT" }
        if oauthAccessTokenId != nil { return "OAuth" }
        return "Unknown"
    }

    var statusLabel: String {
        switch status {
        case "success": return "Success"
        case "denied": return "Denied"
        case "rate_limited": return "Rate limited"
        default: return "Error"
        }
    }

    var clientDisplayName: String {
        let trimmed = clientName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "Unknown client" : trimmed
    }
}

struct McpPersonalAccessTokenListResponse: Decodable, Equatable {
    let tokens: [McpPersonalAccessToken]
}

struct CreatedMcpPersonalAccessTokenResponse: Decodable, Equatable {
    let token: CreatedMcpPersonalAccessToken
}

struct McpOAuthConnectionListResponse: Decodable, Equatable {
    let connections: [McpOAuthClientConnection]
}

struct McpLogListResponse: Decodable, Equatable {
    let logs: [McpLogEntry]
    let nextCursor: String?
}

struct AIAccessSuccessResponse: Decodable, Equatable {
    let success: Bool
}

enum AIAccessStatus: String {
    case active = "Active"
    case expired = "Expired"
    case revoked = "Revoked"

    static func resolve(revokedAt: Date?, expiresAt: Date?) -> AIAccessStatus {
        if revokedAt != nil { return .revoked }
        if let expiresAt, expiresAt <= Date() { return .expired }
        return .active
    }
}

struct AIAccessActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

struct McpLogFilters: Equatable {
    var status = ""
    var authType = ""
    var search = ""
}

enum AIAccessSectionLoadState: Equatable {
    case idle
    case loading
    case loaded
    case error(String)
}

enum AIAccessDateFormatting {
    private static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static let absoluteDateTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .medium
        return formatter
    }()

    private static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()

    static func short(_ date: Date?) -> String {
        guard let date else { return "Never" }
        return shortDate.string(from: date)
    }

    static func absolute(_ date: Date) -> String {
        absoluteDateTime.string(from: date)
    }

    static func relative(_ date: Date) -> String {
        relative.localizedString(for: date, relativeTo: Date())
    }
}
