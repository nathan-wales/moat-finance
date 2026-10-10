import Foundation
import OSLog

enum RemoteLogLevel {
    case info
    case warning
    case error
}

enum AppLogger {
    private static let logger = Logger(subsystem: Environment.bundleIdentifier, category: "MoatApp")

    static func info(_ message: String, metadata: [String: CustomStringConvertible] = [:]) {
        log(level: .info, message: message, metadata: metadata)
    }

    static func warn(_ message: String, metadata: [String: CustomStringConvertible] = [:]) {
        log(level: .warning, message: message, metadata: metadata)
    }

    static func error(_ message: String, metadata: [String: CustomStringConvertible] = [:]) {
        log(level: .error, message: message, metadata: metadata)
    }

    static func logRemote(
        level: RemoteLogLevel,
        message: String,
        event: String? = nil,
        feature: String,
        operation: String,
        metadata: [String: CustomStringConvertible] = [:]
    ) {
        switch level {
        case .info:
            info(message, metadata: metadata)
            RemoteLogger.info(
                message,
                event: event,
                feature: feature,
                operation: operation,
                metadata: metadata
            )
        case .warning:
            warn(message, metadata: metadata)
            RemoteLogger.warn(
                message,
                event: event,
                feature: feature,
                operation: operation,
                metadata: metadata
            )
        case .error:
            error(message, metadata: metadata)
            RemoteLogger.error(
                message,
                event: event,
                feature: feature,
                operation: operation,
                metadata: metadata
            )
        }
    }

    static func logRemote(
        _ message: String,
        event: String? = nil,
        feature: String,
        operation: String,
        metadata: [String: CustomStringConvertible] = [:]
    ) {
        logRemote(
            level: .error,
            message: message,
            event: event,
            feature: feature,
            operation: operation,
            metadata: metadata
        )
    }

    private static func log(
        level: LogLevel,
        message: String,
        metadata: [String: CustomStringConvertible]
    ) {
        let details = sanitizedDetails(from: metadata)

        switch level {
        case .info:
            logger.info("\(message, privacy: .public) \(details, privacy: .public)")
        case .warning:
            logger.warning("\(message, privacy: .public) \(details, privacy: .public)")
        case .error:
            logger.error("\(message, privacy: .public) \(details, privacy: .public)")
        }
    }

    private static func sanitizedDetails(from metadata: [String: CustomStringConvertible]) -> String {
        guard !metadata.isEmpty else { return "" }

        let pairs = metadata
            .sorted { $0.key < $1.key }
            .map { key, value in
                "\(key)=\(isSensitive(key) ? "[redacted]" : String(describing: value))"
            }

        return pairs.joined(separator: " ")
    }

    private static func isSensitive(_ key: String) -> Bool {
        let lowercased = key.lowercased()
        return lowercased.contains("token")
            || lowercased.contains("password")
            || lowercased.contains("secret")
            || lowercased.contains("email")
            || lowercased.contains("account")
            || lowercased.contains("routing")
    }

    private enum LogLevel {
        case info
        case warning
        case error
    }
}
