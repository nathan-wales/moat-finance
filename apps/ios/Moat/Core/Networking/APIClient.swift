import Foundation

/// Centralized API client for making authenticated requests
actor APIClient {
    
    // MARK: - Singleton
    
    static let shared = APIClient()
    
    // MARK: - Dependencies
    
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    
    // MARK: - Initialization
    
    init(session: URLSession = .shared) {
        self.session = session
        
        // Configure JSON decoder with ISO8601 date handling
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            
            // Try ISO8601 with fractional seconds first
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: dateString) {
                return date
            }
            
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateString) {
                return date
            }

            let dateOnlyFormatter = DateFormatter()
            dateOnlyFormatter.calendar = Calendar(identifier: .gregorian)
            dateOnlyFormatter.locale = Locale(identifier: "en_US_POSIX")
            dateOnlyFormatter.timeZone = TimeZone(secondsFromGMT: 0)
            dateOnlyFormatter.dateFormat = "yyyy-MM-dd"
            if let date = dateOnlyFormatter.date(from: dateString) {
                return date
            }
            
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date format: \(dateString)")
        }
        
        // Configure JSON encoder
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }
    
    // MARK: - Request Methods
    
    /// Makes a GET request to the specified endpoint
    func get<T: Decodable>(
        endpoint: Environment.Endpoint,
        authenticated: Bool = true
    ) async throws -> T {
        let request = try await buildRequest(
            url: endpoint.url,
            method: "GET",
            authenticated: authenticated
        )
        
        return try await execute(request)
    }
    
    /// Makes a POST request to the specified endpoint
    func post<T: Decodable, Body: Encodable>(
        endpoint: Environment.Endpoint,
        body: Body,
        authenticated: Bool = true
    ) async throws -> T {
        var request = try await buildRequest(
            url: endpoint.url,
            method: "POST",
            authenticated: authenticated
        )
        
        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        return try await execute(request)
    }
    
    /// Makes a POST request without a body
    func post<T: Decodable>(
        endpoint: Environment.Endpoint,
        authenticated: Bool = true
    ) async throws -> T {
        let request = try await buildRequest(
            url: endpoint.url,
            method: "POST",
            authenticated: authenticated
        )
        
        return try await execute(request)
    }

    func get<T: Decodable>(
        path: String,
        query: [String: String] = [:],
        authenticated: Bool = true
    ) async throws -> T {
        let request = try await buildRequest(
            url: url(for: path, query: query),
            method: "GET",
            authenticated: authenticated
        )

        return try await execute(request)
    }

    func post<T: Decodable>(
        path: String,
        body: JSONValue = .object([:]),
        authenticated: Bool = true
    ) async throws -> T {
        var request = try await buildRequest(
            url: url(for: path),
            method: "POST",
            authenticated: authenticated
        )

        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        return try await execute(request)
    }

    func post<T: Decodable, Body: Encodable>(
        path: String,
        body: Body,
        authenticated: Bool = true
    ) async throws -> T {
        var request = try await buildRequest(
            url: url(for: path),
            method: "POST",
            authenticated: authenticated
        )

        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        return try await execute(request)
    }
    
    // MARK: - Private Helpers
    
    private func buildRequest(
        url: URL,
        method: String,
        authenticated: Bool
    ) async throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("MoatApp-iOS/\(Environment.appVersion)", forHTTPHeaderField: "User-Agent")

        let demoSessionKey = UserDefaults.standard.string(forKey: DemoModeDefaults.sessionKey)
        if let sessionKey = demoSessionKey, !sessionKey.isEmpty {
            request.setValue("demo", forHTTPHeaderField: "x-active-app-context")
            request.setValue(sessionKey, forHTTPHeaderField: "x-demo-overlay-session-key")
        }
        
        if authenticated {
            if demoSessionKey?.isEmpty == false {
                if let accessToken = try? await AuthManager.shared.getValidAccessToken() {
                    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
                }
            } else {
                // Use getValidAccessToken() to automatically refresh expired tokens
                let accessToken = try await AuthManager.shared.getValidAccessToken()
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            }
        }
        
        return request
    }

    private func url(for path: String, query: [String: String] = [:]) throws -> URL {
        guard var components = URLComponents(
            url: Environment.apiBaseURL,
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }

        components.path = path.hasPrefix("/") ? path : "/\(path)"

        if !query.isEmpty {
            components.queryItems = query
                .sorted { $0.key < $1.key }
                .map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        return url
    }

    private static func transportFailureMetadata(
        for request: URLRequest,
        error: Error
    ) -> [String: CustomStringConvertible] {
        var metadata: [String: CustomStringConvertible] = [
            "path": request.url?.path ?? "unknown",
            "method": request.httpMethod ?? "unknown",
            "transient": error.isTransientTransportFailure,
        ]
        for (key, value) in error.transportLogMetadata {
            metadata[key] = value
        }
        return metadata
    }

    private static func logTransportFailure(request: URLRequest, error: Error) {
        let metadata = transportFailureMetadata(for: request, error: error)
        if error.isTransientTransportFailure {
            RemoteLogger.warn(
                "API request failed",
                event: "api.request_failed",
                feature: "network",
                operation: "execute",
                metadata: metadata
            )
            return
        }

        RemoteLogger.error(
            "API request failed",
            event: "api.request_failed",
            feature: "network",
            operation: "execute",
            metadata: metadata
        )
    }
    
    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            if error.isCancellation {
                throw CancellationError()
            }

            Self.logTransportFailure(request: request, error: error)
            throw APIError.networkError(error)
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        // Handle HTTP errors
        switch httpResponse.statusCode {
        case 200...299:
            break // Success
        case 401:
            RemoteLogger.warn(
                "API unauthorized",
                event: "api.unauthorized",
                feature: "network",
                operation: "execute",
                metadata: ["path": request.url?.path ?? "unknown"]
            )
            throw APIError.unauthorized
        default:
            RemoteLogger.error(
                "API HTTP error",
                event: "api.http_error",
                feature: "network",
                operation: "execute",
                metadata: [
                    "path": request.url?.path ?? "unknown",
                    "statusCode": httpResponse.statusCode
                ]
            )
            let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data)
            throw APIError.httpError(
                statusCode: httpResponse.statusCode,
                message: errorResponse?.displayMessage
            )
        }
        
        // Handle empty responses for void return types
        if T.self == EmptyResponse.self && data.isEmpty {
            return EmptyResponse() as! T
        }
        
        // Decode response (API wraps all responses in { data: ... })
        do {
            // First try to decode as wrapped response
            let wrapped = try decoder.decode(APIResponse<T>.self, from: data)
            return wrapped.data
        } catch {
            // Fallback: try direct decoding for backwards compatibility
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        }
    }
}

// MARK: - Response Wrapper

/// API responses are wrapped in { data: T }
private struct APIResponse<T: Decodable>: Decodable {
    let data: T
}
