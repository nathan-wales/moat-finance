import Foundation
import Security

/// Securely stores authentication credentials in the Keychain.
/// v1 uses standard Keychain accessibility (`AfterFirstUnlockThisDeviceOnly`) rather than
/// biometric access control on tokens. Biometric unlock is enforced as a UI gate instead.
final class CredentialsStore {
    
    static let shared = CredentialsStore()
    
    private let service = "com.moatfinance.app"
    private let sessionKey = "user_session"
    
    private init() {}
    
    // MARK: - Session Storage
    
    /// Saves the current session to the Keychain
    func saveSession(_ session: Session) throws {
        let data = try JSONEncoder().encode(session)
        try save(data: data, forKey: sessionKey)
        AppLogger.info(
            "Auth session saved to Keychain",
            metadata: [
                "operation": "credentials.save_session",
                "hasRefreshCredential": !session.refreshToken.isEmpty,
                "hasUserId": session.userId != nil
            ]
        )
    }
    
    /// Retrieves the stored session from the Keychain
    func loadSession() -> Session? {
        switch load(forKey: sessionKey) {
        case .success(let data):
            do {
                let session = try JSONDecoder().decode(Session.self, from: data)
                AppLogger.info(
                    "Auth session read from Keychain",
                    metadata: [
                        "operation": "credentials.load_session",
                        "result": "success",
                        "hasRefreshCredential": !session.refreshToken.isEmpty,
                        "hasUserId": session.userId != nil
                    ]
                )
                return session
            } catch {
                AppLogger.warn(
                    "Stored auth session could not be decoded",
                    metadata: [
                        "operation": "credentials.load_session",
                        "result": "decode_failed"
                    ]
                )
                return nil
            }
        case .notFound:
            AppLogger.info(
                "No auth session found in Keychain",
                metadata: [
                    "operation": "credentials.load_session",
                    "result": "not_found"
                ]
            )
            return nil
        case .failure(let status):
            AppLogger.warn(
                "Keychain auth session read failed",
                metadata: [
                    "operation": "credentials.load_session",
                    "result": "keychain_error",
                    "status": status
                ]
            )
            return nil
        }
    }
    
    /// Removes the stored session from the Keychain
    func clearSession() {
        delete(forKey: sessionKey)
    }
    
    // MARK: - Private Keychain Operations
    
    private func save(data: Data, forKey key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            return
        }

        guard updateStatus == errSecItemNotFound else {
            throw CredentialsStoreError.saveFailed(updateStatus)
        }

        var addQuery = query
        attributes.forEach { key, value in
            addQuery[key] = value
        }

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw CredentialsStoreError.saveFailed(status)
        }
    }
    
    private func load(forKey key: String) -> KeychainLoadResult {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecItemNotFound {
            return .notFound
        }

        guard status == errSecSuccess, let data = result as? Data else {
            return .failure(status)
        }

        return .success(data)
    }
    
    private func delete(forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Errors

private enum KeychainLoadResult {
    case success(Data)
    case notFound
    case failure(OSStatus)
}

enum CredentialsStoreError: LocalizedError {
    case saveFailed(OSStatus)
    
    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "Failed to save credentials: \(status)"
        }
    }
}
