import Foundation

enum AppLockTimeout: String, CaseIterable, Identifiable {
    case immediately
    case oneMinute
    case fiveMinutes
    case fifteenMinutes

    static let storageKey = "moat.appLock.timeout"
    static let enabledKey = "moat.appLock.biometricEnabled"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .immediately:
            return "Immediately"
        case .oneMinute:
            return "1 minute"
        case .fiveMinutes:
            return "5 minutes"
        case .fifteenMinutes:
            return "15 minutes"
        }
    }

    var graceInterval: TimeInterval {
        switch self {
        case .immediately:
            return 0
        case .oneMinute:
            return 60
        case .fiveMinutes:
            return 300
        case .fifteenMinutes:
            return 900
        }
    }
}

final class AppLockPreferences {
    static let shared = AppLockPreferences()

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var isBiometricUnlockEnabled: Bool {
        get { defaults.bool(forKey: AppLockTimeout.enabledKey) }
        set { defaults.set(newValue, forKey: AppLockTimeout.enabledKey) }
    }

    var lockTimeout: AppLockTimeout {
        get {
            guard
                let rawValue = defaults.string(forKey: AppLockTimeout.storageKey),
                let timeout = AppLockTimeout(rawValue: rawValue)
            else {
                return .immediately
            }
            return timeout
        }
        set { defaults.set(newValue.rawValue, forKey: AppLockTimeout.storageKey) }
    }

    func reset() {
        defaults.removeObject(forKey: AppLockTimeout.enabledKey)
        defaults.removeObject(forKey: AppLockTimeout.storageKey)
    }
}
