import Foundation
import Security

/// Persists FinanceKit history tokens so each sync resumes from the last change instead of
/// re-reading a full lookback window. Tokens live in the Keychain rather than `UserDefaults`
/// per the iOS token-storage rule, and can be shared with an extension via an access group.
protocol AppleFinanceKitHistoryTokenStoring: Sendable {
    func token(forExternalAccountId externalAccountId: String) -> Data?
    func save(_ token: Data, forExternalAccountId externalAccountId: String)
    func clearToken(forExternalAccountId externalAccountId: String)
}

final class AppleFinanceKitHistoryTokenStore: AppleFinanceKitHistoryTokenStoring {
    static let shared = AppleFinanceKitHistoryTokenStore()

    private let service = "com.moatfinance.app.financekit-history"
    private let accessGroup: String?

    init(accessGroup: String? = AppleWalletSharedContainer.keychainAccessGroup) {
        self.accessGroup = accessGroup
    }

    func token(forExternalAccountId externalAccountId: String) -> Data? {
        var query = baseQuery(for: externalAccountId)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess, let data = result as? Data else {
            AppLogger.warn(
                "Apple Wallet history token read failed",
                metadata: [
                    "operation": "apple_wallet.history_token.load",
                    "status": status
                ]
            )
            return nil
        }

        return data
    }

    func save(_ token: Data, forExternalAccountId externalAccountId: String) {
        let query = baseQuery(for: externalAccountId)
        let attributes: [String: Any] = [
            kSecValueData as String: token,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            return
        }

        guard updateStatus == errSecItemNotFound else {
            AppLogger.warn(
                "Apple Wallet history token update failed",
                metadata: [
                    "operation": "apple_wallet.history_token.save",
                    "status": updateStatus
                ]
            )
            return
        }

        var addQuery = query
        for (key, value) in attributes {
            addQuery[key] = value
        }

        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        if addStatus != errSecSuccess {
            AppLogger.warn(
                "Apple Wallet history token write failed",
                metadata: [
                    "operation": "apple_wallet.history_token.save",
                    "status": addStatus
                ]
            )
        }
    }

    func clearToken(forExternalAccountId externalAccountId: String) {
        SecItemDelete(baseQuery(for: externalAccountId) as CFDictionary)
    }

    private func baseQuery(for externalAccountId: String) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: externalAccountId
        ]

        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        return query
    }
}
