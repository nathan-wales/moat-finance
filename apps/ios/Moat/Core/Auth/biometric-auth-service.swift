import Foundation
import LocalAuthentication

enum MoatBiometryType: Equatable {
    case none
    case touchID
    case faceID
    case opticID

    var unlockButtonTitle: String {
        switch self {
        case .faceID:
            return "Unlock with Face ID"
        case .touchID:
            return "Unlock with Touch ID"
        case .opticID:
            return "Unlock"
        case .none:
            return "Enter"
        }
    }

    var settingsToggleTitle: String {
        switch self {
        case .faceID:
            return "Require Face ID"
        case .touchID:
            return "Require Touch ID"
        case .opticID:
            return "Require Optic ID"
        case .none:
            return "Require biometric unlock"
        }
    }
}

enum BiometricAuthError: LocalizedError, Equatable {
    case notAvailable
    case notEnrolled
    case passcodeNotSet
    case biometryLockout
    case userCancelled
    case userFallback
    case systemCancelled
    case authenticationFailed
    case unknown

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Biometric authentication is not available on this device."
        case .notEnrolled:
            return "Biometric authentication is not set up on this device."
        case .passcodeNotSet:
            return "Set a device passcode before enabling biometric unlock."
        case .biometryLockout:
            return "Biometric authentication is locked. Try again later or use your device passcode."
        case .userCancelled:
            return "Authentication was cancelled."
        case .userFallback:
            return "Authentication fallback was selected."
        case .systemCancelled:
            return "Authentication was interrupted."
        case .authenticationFailed:
            return "Authentication failed."
        case .unknown:
            return "Authentication could not be completed."
        }
    }

    static func from(_ error: Error) -> BiometricAuthError {
        guard let laError = error as? LAError else { return .unknown }
        return from(laError)
    }

    static func from(_ error: LAError) -> BiometricAuthError {
        switch error.code {
        case .biometryNotAvailable:
            return .notAvailable
        case .biometryNotEnrolled:
            return .notEnrolled
        case .passcodeNotSet:
            return .passcodeNotSet
        case .biometryLockout:
            return .biometryLockout
        case .userCancel:
            return .userCancelled
        case .userFallback:
            return .userFallback
        case .systemCancel:
            return .systemCancelled
        case .authenticationFailed:
            return .authenticationFailed
        default:
            return .unknown
        }
    }

    var forcesSignOut: Bool {
        switch self {
        case .notAvailable, .notEnrolled, .passcodeNotSet:
            return true
        default:
            return false
        }
    }
}

final class BiometricAuthService {
    static let shared = BiometricAuthService()

    private init() {}

    func canAuthenticate() -> Bool {
        var error: NSError?
        let context = LAContext()
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
    }

    var biometryType: MoatBiometryType {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)

        switch context.biometryType {
        case .faceID:
            return .faceID
        case .touchID:
            return .touchID
        case .opticID:
            return .opticID
        default:
            return .none
        }
    }

    func authenticate(reason: String) async throws -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
        } catch {
            throw BiometricAuthError.from(error)
        }
    }
}
