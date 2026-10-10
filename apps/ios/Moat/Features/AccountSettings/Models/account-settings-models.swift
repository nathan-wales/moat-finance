import Foundation

struct AccountSettingsSnapshot: Equatable {
    let twoFactorStatus: TwoFactorStatus
}

struct ProfileUpdateResponse: Decodable, Equatable {
    let name: String
}

struct TwoFactorStatus: Decodable, Equatable {
    let twoFactorEnabled: Bool
    let twoFactorVerified: Bool
}

struct TwoFactorSecretResponse: Decodable, Equatable {
    let secret: String
    let qrCode: String
}

struct TwoFactorEnableResponse: Decodable, Equatable {
    let backupCodes: [String]
}

struct AccountSettingsActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

enum AccountSettingsValidationError: LocalizedError {
    case emptyName
    case emptyToken
    case emptyPassword
    case emailMismatch

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter a display name."
        case .emptyToken:
            return "Enter a verification code."
        case .emptyPassword:
            return "Enter your password."
        case .emailMismatch:
            return "Email does not match."
        }
    }
}