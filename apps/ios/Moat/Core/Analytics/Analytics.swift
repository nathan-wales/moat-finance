import Foundation
import PostHog

/// Product analytics wrapper for iOS.
/// Event payloads stay userId XOR demoUser with no PII.
/// Identify may set account email as a PostHog person property; distinct ID stays userId.
enum Analytics {
    private static let prohibitedKeys: Set<String> = [
        "email", "name", "firstname", "lastname", "displayname",
        "merchantname", "merchant", "description", "memo", "note",
        "accountnumber", "routingnumber", "accountmask", "mask",
        "token", "accesstoken", "refreshtoken", "secret", "password",
        "pin", "ssn", "phonenumber", "phone", "address", "street",
        "zip", "postalcode", "dob", "dateofbirth",
    ]

    private static var isConfigured = false
    private static var currentUserId: String?

    static func setup() {
        guard !isConfigured else { return }
        guard let apiKey = Environment.posthogApiKey, !apiKey.isEmpty else {
            if Environment.isDebug {
                AppLogger.warn(
                    "PostHog API key not set, iOS analytics disabled",
                    metadata: ["operation": "analytics.setup"]
                )
            }
            return
        }

        let config = PostHogConfig(projectToken: apiKey, host: Environment.posthogHost)
        config.captureScreenViews = false
        config.captureElementInteractions = false
        config.sessionReplay = false
        PostHogSDK.shared.setup(config)
        isConfigured = true
    }

    static func identify(userId: String, email: String? = nil) {
        currentUserId = userId
        guard isConfigured else { return }
        if let email, !email.isEmpty {
            PostHogSDK.shared.identify(userId, userProperties: ["email": email])
            return
        }
        PostHogSDK.shared.identify(userId)
    }

    static func reset() {
        currentUserId = nil
        guard isConfigured else { return }
        PostHogSDK.shared.reset()
    }

    static func capture(
        _ event: String,
        properties: [String: Any] = [:],
        demoUser: Bool = false
    ) {
        guard isConfigured else { return }

        var payload: [String: Any] = [:]
        for (key, value) in properties {
            if prohibitedKeys.contains(key.lowercased()) { continue }
            if value is String || value is Int || value is Double || value is Bool || value is NSNull {
                payload[key] = value
            }
        }

        if demoUser || currentUserId == nil {
            payload["demoUser"] = true
        } else if let userId = currentUserId {
            payload["userId"] = userId
        }

        PostHogSDK.shared.capture(event, properties: payload)
    }

    static func screen(_ name: String, properties: [String: Any] = [:]) {
        var props = properties
        props["screen"] = name
        capture("$pageview", properties: props)
    }
}
