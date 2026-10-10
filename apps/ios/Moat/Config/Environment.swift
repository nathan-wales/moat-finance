import Foundation

/// App environment configuration
/// Values are loaded from xcconfig files at build time
enum Environment {
    
    // MARK: - API Configuration
    
    /// Base URL for the Moat Finance API
    static var apiBaseURL: URL {
        guard let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
              let url = URL(string: urlString.replacingOccurrences(of: "\\", with: "")) else {
            return URL(string: "http://127.0.0.1:3001")!
        }
        return url
    }

    static var webBaseURL: URL {
        if let urlString = Bundle.main.infoDictionary?["WEB_BASE_URL"] as? String,
           let url = URL(string: urlString.replacingOccurrences(of: "\\", with: "")) {
            return url
        }

        if apiBaseURL.host == "localhost" || apiBaseURL.host == "127.0.0.1" {
            return URL(string: "http://127.0.0.1:3000")!
        }

        return URL(string: "https://moatfinance.ai")!
    }
    
    // MARK: - App Info
    
    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
    
    static var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
    
    static var bundleIdentifier: String {
        Bundle.main.bundleIdentifier ?? "com.moatfinance.app"
    }

    /// Logo.dev publishable key for JIT institution logos (safe for client-side CDN use).
    static var logoDevPublishableKey: String? {
        guard let key = Bundle.main.infoDictionary?["LOGO_DEV_PUBLISHABLE_KEY"] as? String else {
            return nil
        }

        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    static var posthogApiKey: String? {
        guard let key = Bundle.main.infoDictionary?["POSTHOG_API_KEY"] as? String else {
            return nil
        }
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    static var posthogHost: String {
        guard let host = Bundle.main.infoDictionary?["POSTHOG_HOST"] as? String else {
            return "https://app.posthog.com"
        }
        let trimmed = host.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "https://app.posthog.com" : trimmed
    }

    // MARK: - Environment Detection
    
    static var isDebug: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
    
    static var isProduction: Bool {
        !isDebug
    }
}

// MARK: - API Endpoints

extension Environment {
    
    enum Endpoint {
        case authExchange
        case authRegister
        case authRefresh
        case authRevoke
        case balanceSnapshotHistory
        case investmentGetAll
        case transactionMonthlyAggregates
        
        var path: String {
            switch self {
            case .authExchange:
                return "/api/v1/auth/exchange"
            case .authRegister:
                return "/api/v1/auth/register"
            case .authRefresh:
                return "/api/v1/auth/refresh"
            case .authRevoke:
                return "/api/v1/auth/revoke"
            case .balanceSnapshotHistory:
                return "/api/v1/balanceSnapshot/getHistory"
            case .investmentGetAll:
                return "/api/v1/investment/getAll"
            case .transactionMonthlyAggregates:
                return "/api/v1/transaction/getMonthlyAggregates"
            }
        }
        
        var url: URL {
            Environment.apiBaseURL.appendingPathComponent(path)
        }
    }
}
