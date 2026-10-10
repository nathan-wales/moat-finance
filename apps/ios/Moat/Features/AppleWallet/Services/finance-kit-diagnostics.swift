import Foundation

enum FinanceKitDiagnostics {
    private static let financeKitEntitlementKey = "com.apple.developer.financekit"
    private static let financialDataUsageKey = "NSFinancialDataUsageDescription"

    static var isSimulator: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }

    static func hasFinanceKitEntitlement() -> Bool {
        if let embeddedProfileResult = entitlementFromEmbeddedProfile() {
            return embeddedProfileResult
        }

        // TestFlight and App Store builds omit embedded.mobileprovision.
        return !isSimulator
    }

    private static func entitlementFromEmbeddedProfile() -> Bool? {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let content = String(data: data, encoding: .isoLatin1),
              let plistStart = content.range(of: "<?xml"),
              let plistEnd = content.range(of: "</plist>") else {
            return nil
        }

        let plistString = String(content[plistStart.lowerBound...plistEnd.upperBound])
        guard let plistData = plistString.data(using: .utf8),
              let plist = try? PropertyListSerialization.propertyList(
                  from: plistData,
                  options: [],
                  format: nil
              ) as? [String: Any],
              let entitlements = plist["Entitlements"] as? [String: Any],
              let value = entitlements[financeKitEntitlementKey] else {
            return nil
        }

        if let enabled = value as? Bool {
            return enabled
        }

        if let values = value as? [String] {
            return values.contains("financial-data")
        }

        return true
    }

    static func hasFinancialDataUsageDescription() -> Bool {
        guard let description = Bundle.main.object(forInfoDictionaryKey: financialDataUsageKey) as? String else {
            return false
        }

        return !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    static func snapshot(extra: [String: CustomStringConvertible] = [:]) -> [String: CustomStringConvertible] {
        var metadata: [String: CustomStringConvertible] = [
            "bundleId": Environment.bundleIdentifier,
            "appVersion": Environment.appVersion,
            "buildNumber": Environment.buildNumber,
            "isDebug": Environment.isDebug,
            "isSimulator": isSimulator,
            "osVersion": ProcessInfo.processInfo.operatingSystemVersionString,
            "financeKitOSSupported": AppleFinanceKitAvailability.isSupportedOSVersion,
            "hasFinanceKitEntitlement": hasFinanceKitEntitlement(),
            "hasFinancialDataUsageDescription": hasFinancialDataUsageDescription(),
        ]

        for (key, value) in extra {
            metadata[key] = value
        }

        return metadata
    }

    static func logSnapshot(operation: String, level: RemoteLogLevel = .info, extra: [String: CustomStringConvertible] = [:]) {
        var metadata = snapshot(extra: extra)
        metadata["operation"] = operation

        AppLogger.logRemote(
            level: level,
            message: "Apple Wallet diagnostics",
            feature: "apple-financekit",
            operation: operation,
            metadata: metadata
        )
    }

    static func logError(_ message: String, operation: String, error: Error, extra: [String: CustomStringConvertible] = [:]) {
        var metadata = snapshot(extra: extra)
        metadata["operation"] = operation
        metadata["errorType"] = String(describing: type(of: error))
        metadata["errorMessage"] = error.localizedDescription

        AppLogger.logRemote(
            level: .error,
            message: message,
            feature: "apple-financekit",
            operation: operation,
            metadata: metadata
        )
    }
}
