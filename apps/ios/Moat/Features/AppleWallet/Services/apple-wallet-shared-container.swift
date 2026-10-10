import Foundation

/// App Group and Keychain access group used to share FinanceKit state with a background delivery
/// extension. Both are read from Info.plist and are absent until the App Group is registered in
/// the Apple Developer portal and added to the entitlements of both targets — until then every
/// lookup returns `nil`, the Keychain stays app-local, and background delivery stays disabled.
enum AppleWalletSharedContainer {
    private static let appGroupKey = "MOAT_APP_GROUP_IDENTIFIER"
    private static let keychainAccessGroupKey = "MOAT_KEYCHAIN_ACCESS_GROUP"

    static var appGroupIdentifier: String? {
        configuredValue(forKey: appGroupKey)
    }

    static var keychainAccessGroup: String? {
        configuredValue(forKey: keychainAccessGroupKey)
    }

    /// Background delivery launches a separate extension process, which is only reachable when the
    /// app group exists. Without it, `enableBackgroundDelivery` would register a callback nothing
    /// can receive.
    static var isBackgroundDeliverySupported: Bool {
        appGroupIdentifier != nil
    }

    private static func configuredValue(forKey key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }

        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
