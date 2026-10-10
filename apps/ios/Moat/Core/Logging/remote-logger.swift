import Foundation

enum RemoteLogger {
    private struct IngestPayload: Encodable {
        let level: String
        let message: String
        let event: String
        let feature: String?
        let operation: String?
        let platform: String
        let appVersion: String
        let buildNumber: String
        let metadata: [String: RemoteLogValue]?
    }

    enum RemoteLogValue: Encodable {
        case string(String)
        case int(Int)
        case double(Double)
        case bool(Bool)

        func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case .string(let value):
                try container.encode(value)
            case .int(let value):
                try container.encode(value)
            case .double(let value):
                try container.encode(value)
            case .bool(let value):
                try container.encode(value)
            }
        }
    }

    static func info(
        _ message: String,
        event: String? = nil,
        feature: String? = nil,
        operation: String? = nil,
        metadata: [String: CustomStringConvertible] = [:]
    ) {
        send(
            level: "info",
            message: message,
            event: event,
            feature: feature,
            operation: operation,
            metadata: metadata
        )
    }

    static func warn(
        _ message: String,
        event: String? = nil,
        feature: String? = nil,
        operation: String? = nil,
        metadata: [String: CustomStringConvertible] = [:]
    ) {
        send(
            level: "warn",
            message: message,
            event: event,
            feature: feature,
            operation: operation,
            metadata: metadata
        )
    }

    static func error(
        _ message: String,
        event: String? = nil,
        feature: String? = nil,
        operation: String? = nil,
        metadata: [String: CustomStringConvertible] = [:]
    ) {
        send(
            level: "error",
            message: message,
            event: event,
            feature: feature,
            operation: operation,
            metadata: metadata
        )
    }

    private static func send(
        level: String,
        message: String,
        event: String?,
        feature: String?,
        operation: String?,
        metadata: [String: CustomStringConvertible]
    ) {
        let trimmedMessage = String(message.prefix(500))
        let resolvedEvent = event ?? slugify(trimmedMessage)

        let payload = IngestPayload(
            level: level,
            message: trimmedMessage,
            event: String(resolvedEvent.prefix(100)),
            feature: feature,
            operation: operation,
            platform: "IOS",
            appVersion: Environment.appVersion,
            buildNumber: Environment.buildNumber,
            metadata: encodeMetadata(metadata)
        )

        Task.detached(priority: .utility) {
            do {
                let token = try await AuthManager.shared.getValidAccessToken()
                guard !token.isEmpty else { return }

                let _: EmptyResponse = try await APIClient.shared.post(
                    path: "/api/v1/clientLog/ingest",
                    body: payload,
                    authenticated: true
                )
            } catch {
                // Remote logging must never affect app behavior.
            }
        }
    }

    private static func slugify(_ value: String) -> String {
        let lowered = value.lowercased()
        let allowed = lowered.map { character -> Character in
            if character.isLetter || character.isNumber {
                return character
            }
            return "_"
        }

        let collapsed = String(allowed)
            .replacingOccurrences(of: "__+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))

        return collapsed.isEmpty ? "client_log" : collapsed
    }

    private static func encodeMetadata(
        _ metadata: [String: CustomStringConvertible]
    ) -> [String: RemoteLogValue]? {
        guard !metadata.isEmpty else { return nil }

        var encoded: [String: RemoteLogValue] = [:]
        for (key, value) in metadata.sorted(by: { $0.key < $1.key }) {
            let normalizedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalizedKey.isEmpty else { continue }

            if let boolValue = value as? Bool {
                encoded[normalizedKey] = .bool(boolValue)
                continue
            }

            if let intValue = value as? Int {
                encoded[normalizedKey] = .int(intValue)
                continue
            }

            if let doubleValue = value as? Double {
                encoded[normalizedKey] = .double(doubleValue)
                continue
            }

            let stringValue = String(describing: value)
            encoded[normalizedKey] = .string(String(stringValue.prefix(500)))
        }

        return encoded.isEmpty ? nil : encoded
    }
}
