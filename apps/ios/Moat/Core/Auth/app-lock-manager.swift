import Foundation
import SwiftUI

@MainActor
final class AppLockManager: ObservableObject {
    static let shared = AppLockManager()

    @Published private(set) var isLocked = false
    @Published private(set) var isPrivacyOverlayVisible = false
    @Published private(set) var unlockAttemptID = UUID()

    private let preferences: AppLockPreferences
    private let biometricService: BiometricAuthService
    private let authManager: AuthManager
    private var backgroundedAt: Date?
    private var skipNextForegroundLock = false

    private init() {
        preferences = AppLockPreferences.shared
        biometricService = BiometricAuthService.shared
        authManager = AuthManager.shared
        isLocked = preferences.isBiometricUnlockEnabled && biometricService.canAuthenticate()
    }

    var isEnabled: Bool {
        preferences.isBiometricUnlockEnabled && biometricService.canAuthenticate()
    }

    var lockTimeout: AppLockTimeout {
        get { preferences.lockTimeout }
        set { preferences.lockTimeout = newValue }
    }

    var biometryType: MoatBiometryType {
        biometricService.biometryType
    }

    var settingsToggleTitle: String {
        biometricService.biometryType.settingsToggleTitle
    }

    func prepareForAuthenticatedSession() {
        guard shouldEnforceLock else {
            isLocked = false
            isPrivacyOverlayVisible = false
            return
        }

        if !biometricService.canAuthenticate() {
            Task { await handleBiometricUnavailable() }
            return
        }

        isLocked = true
        unlockAttemptID = UUID()
    }

    func handleScenePhase(_ phase: ScenePhase, isDemoMode: Bool) {
        guard !isDemoMode else {
            isPrivacyOverlayVisible = false
            return
        }

        switch phase {
        case .active:
            handleBecameActive()
        case .inactive:
            if shouldEnforceLock {
                isPrivacyOverlayVisible = true
            }
        case .background:
            handleEnteredBackground()
        @unknown default:
            break
        }
    }

    func lock() {
        guard shouldEnforceLock else { return }
        isLocked = true
        isPrivacyOverlayVisible = true
        unlockAttemptID = UUID()
    }

    func unlock() async throws {
        guard shouldEnforceLock else {
            isLocked = false
            isPrivacyOverlayVisible = false
            return
        }

        let authenticated = try await biometricService.authenticate(
            reason: "Unlock Moat to access your financial data."
        )

        guard authenticated else { return }

        AppLogger.info(
            "Biometric unlock succeeded",
            metadata: ["operation": "app_lock.unlock"]
        )

        do {
            _ = try await authManager.getValidAccessToken()
            AppLogger.info(
                "Session validated after biometric unlock",
                metadata: ["operation": "app_lock.unlock"]
            )
            Analytics.capture("app_lock_unlocked")
        } catch {
            AppLogger.warn(
                "Session validation failed after biometric unlock",
                metadata: [
                    "operation": "app_lock.unlock",
                    "permanent": authManager.isPermanentSessionFailure(error)
                ]
            )

            if authManager.isPermanentSessionFailure(error) {
                await authManager.signOut(reason: "unlock_session_validation_failed")
            }

            throw error
        }

        isLocked = false
        isPrivacyOverlayVisible = false
        backgroundedAt = nil
    }

    func enableBiometricUnlock() async throws {
        guard biometricService.canAuthenticate() else {
            throw BiometricAuthError.notAvailable
        }

        _ = try await biometricService.authenticate(
            reason: "Confirm your identity to enable biometric unlock."
        )

        preferences.isBiometricUnlockEnabled = true
        skipNextForegroundLock = true
        isLocked = false
        isPrivacyOverlayVisible = false
        backgroundedAt = nil
    }

    func disableBiometricUnlock() async throws {
        if preferences.isBiometricUnlockEnabled {
            _ = try await biometricService.authenticate(
                reason: "Confirm your identity to disable biometric unlock."
            )
        }

        preferences.isBiometricUnlockEnabled = false
        isLocked = false
        isPrivacyOverlayVisible = false
        backgroundedAt = nil
    }

    func resetOnLogout() {
        preferences.reset()
        isLocked = false
        isPrivacyOverlayVisible = false
        backgroundedAt = nil
        skipNextForegroundLock = false
    }

    func handleBiometricUnavailable() async {
        AppLogger.warn(
            "Biometric unlock unavailable; clearing local session",
            metadata: ["operation": "app_lock.biometric_unavailable"]
        )
        resetOnLogout()
        await authManager.signOut(reason: "biometric_unavailable")
    }

    private var shouldEnforceLock: Bool {
        preferences.isBiometricUnlockEnabled
            && authManager.state == .signedIn
            && biometricService.canAuthenticate()
    }

    private func handleEnteredBackground() {
        guard shouldEnforceLock else {
            isPrivacyOverlayVisible = false
            return
        }

        backgroundedAt = Date()
        isPrivacyOverlayVisible = true
    }

    private func handleBecameActive() {
        guard shouldEnforceLock else {
            isPrivacyOverlayVisible = false
            return
        }

        if skipNextForegroundLock {
            skipNextForegroundLock = false
            isPrivacyOverlayVisible = false
            return
        }

        if let backgroundedAt, shouldRequireUnlock(since: backgroundedAt) {
            lock()
        } else {
            isPrivacyOverlayVisible = isLocked
            if !isLocked {
                isPrivacyOverlayVisible = false
            }
        }
    }

    private func shouldRequireUnlock(since backgroundedAt: Date) -> Bool {
        Date().timeIntervalSince(backgroundedAt) >= preferences.lockTimeout.graceInterval
    }
}
