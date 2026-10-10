import Foundation

// MARK: - Enums

enum CommunityTipAttribution: String, Codable, CaseIterable, Identifiable {
    case `public` = "PUBLIC"
    case anonymous = "ANONYMOUS"

    var id: String { rawValue }

    var displayTitle: String {
        switch self {
        case .public: return "Public (show my name)"
        case .anonymous: return "Anonymous"
        }
    }
}

enum CommunityTipStatus: String, Codable, CaseIterable {
    case llmReview = "LLM_REVIEW"
    case pendingAdminReview = "PENDING_ADMIN_REVIEW"
    case changesRequired = "CHANGES_REQUIRED"
    case approved = "APPROVED"
    case rejected = "REJECTED"
    case archived = "ARCHIVED"
    case expired = "EXPIRED"

    var displayLabel: String {
        switch self {
        case .llmReview: return "In review"
        case .pendingAdminReview: return "Pending review"
        case .changesRequired: return "Changes required"
        case .approved: return "Approved"
        case .rejected: return "Rejected"
        case .archived: return "Archived"
        case .expired: return "Expired"
        }
    }
}

enum CommunityTipFeedSort: String, Codable, CaseIterable, Identifiable {
    case recommended
    case newest
    case mostLiked = "most_liked"

    var id: String { rawValue }

    var displayTitle: String {
        switch self {
        case .recommended: return "Recommended"
        case .newest: return "Newest"
        case .mostLiked: return "Most liked"
        }
    }
}

// MARK: - Public Author

struct CommunityTipPublicAuthor: Codable, Hashable {
    let displayName: String
    let imageUrl: String?
}

// MARK: - Summary & Detail

struct CommunityTipPublicSummary: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let bodyPreview: String
    let attribution: CommunityTipAttribution
    let author: CommunityTipPublicAuthor?
    let tags: [String]
    let keywords: [String]
    let tipType: String?
    let potentialBenefit: String?
    var likeCount: Int
    var likedByCurrentUser: Bool
    let ownedByCurrentUser: Bool
    let publishedAt: String?
    let personallyTested: Bool
}

struct CommunityTipPublicDetail: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let bodyPreview: String
    let attribution: CommunityTipAttribution
    let author: CommunityTipPublicAuthor?
    let tags: [String]
    let keywords: [String]
    let tipType: String?
    let potentialBenefit: String?
    var likeCount: Int
    var likedByCurrentUser: Bool
    let ownedByCurrentUser: Bool
    let publishedAt: String?
    let personallyTested: Bool
    let body: String
    let merchantNames: [String]
    let transactionCategories: [String]
    let estimatedSavingsPercent: Double?
    let estimatedSavingsAmount: Double?
    let countryCodes: [String]
    let requirements: [String]
    let externalUrl: String?
    let expiresAt: String?
}

struct CommunityTipOwnerDetail: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let bodyPreview: String
    let attribution: CommunityTipAttribution
    let author: CommunityTipPublicAuthor?
    let tags: [String]
    let keywords: [String]
    let tipType: String?
    let potentialBenefit: String?
    var likeCount: Int
    var likedByCurrentUser: Bool
    let ownedByCurrentUser: Bool
    let publishedAt: String?
    let personallyTested: Bool
    let body: String
    let merchantNames: [String]
    let transactionCategories: [String]
    let estimatedSavingsPercent: Double?
    let estimatedSavingsAmount: Double?
    let countryCodes: [String]
    let requirements: [String]
    let externalUrl: String?
    let expiresAt: String?
    let status: CommunityTipStatus
    let moderationReason: String?
    let createdAt: String
    let updatedAt: String
}

// MARK: - Feed

struct CommunityTipFeedResponse: Codable {
    let items: [CommunityTipPublicSummary]
    let nextCursor: String?
}

// MARK: - Transaction Recommendation

struct CommunityTipTransactionRecommendation: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let bodyPreview: String
    let attribution: CommunityTipAttribution
    let author: CommunityTipPublicAuthor?
    let tags: [String]
    let keywords: [String]
    let tipType: String?
    let potentialBenefit: String?
    var likeCount: Int
    var likedByCurrentUser: Bool
    let ownedByCurrentUser: Bool
    let publishedAt: String?
    let personallyTested: Bool
    let matchedKeywords: [String]
    let totalScore: Double
    let potentialBenefitAmount: Double?
}

// MARK: - Requests

struct ListCommunityTipsRequest: Encodable {
    let sort: String?
    let query: String?
    let cursor: String?
    let limit: Int?
}

struct CreateCommunityTipRequest: Encodable {
    let title: String
    let body: String
    let attribution: String
}

struct UpdateCommunityTipRequest: Encodable {
    let tipId: String
    let title: String?
    let body: String?
    let attribution: String?
}

struct TipIdRequest: Encodable {
    let tipId: String
}

struct ListForTransactionRequest: Encodable {
    let transactionId: String
    let limit: Int?
}

struct SetCommunityTipSettingsRequest: Encodable {
    let showCommunityTipsOnTransactions: Bool
}

// MARK: - Settings

struct CommunityTipSettings: Codable {
    var showCommunityTipsOnTransactions: Bool
}

// MARK: - Like Response

typealias LikeCommunityTipResponse = CommunityTipPublicSummary

// MARK: - Action Message

struct CommunityTipActionMessage: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}
