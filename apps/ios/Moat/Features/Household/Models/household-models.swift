import Foundation

struct HouseholdState: Decodable, Equatable {
    let canManage: Bool
    let owner: HouseholdOwnerSummary
    let membership: HouseholdMembershipSummary?
    let pendingInvite: HouseholdInviteSummary?
}

struct HouseholdOwnerSummary: Decodable, Equatable {
    let id: String
    let name: String?
    let email: String?
}

struct HouseholdMembershipSummary: Decodable, Identifiable, Equatable {
    let id: String
    let status: String
    let createdAt: Date
    let updatedAt: Date
    let member: HouseholdMemberSummary
}

struct HouseholdMemberSummary: Decodable, Equatable {
    let id: String
    let name: String?
    let email: String?
    let access: String

    var displayName: String {
        if let name, !name.isEmpty { return name }
        if let email, !email.isEmpty { return email }
        return "Household member"
    }
}

struct HouseholdInviteSummary: Decodable, Identifiable, Equatable {
    let id: String
    let inviteeName: String
    let inviteeEmail: String
    let status: String
    let createdAt: Date
    let expiresAt: Date
    let sentAt: Date?
}

struct HouseholdInviteResponse: Decodable, Equatable {
    let invite: HouseholdInviteSummary
}

struct HouseholdSuccessResponse: Decodable, Equatable {
    let success: Bool
}

struct HouseholdActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

enum HouseholdValidationError: LocalizedError {
    case emptyName
    case invalidEmail

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter the member name."
        case .invalidEmail:
            return "Enter a valid email address."
        }
    }
}