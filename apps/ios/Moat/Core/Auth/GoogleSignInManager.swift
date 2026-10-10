import AuthenticationServices
import CryptoKit
import Foundation

/// Manages Google Sign-In using ASWebAuthenticationSession with PKCE
/// This approach doesn't require the Google Sign-In SDK, reducing app size
/// and avoiding additional dependencies.
@MainActor
final class GoogleSignInManager: NSObject {
    
    static let shared = GoogleSignInManager()
    
    private var authSession: ASWebAuthenticationSession?
    private var continuation: CheckedContinuation<String, Error>?
    private var codeVerifier: String?
    
    private override init() {
        super.init()
    }
    
    /// Initiates Google Sign-In flow using web-based authentication with PKCE
    /// Returns a GoogleSignInResult containing the ID token for backend verification
    func signIn() async throws -> GoogleSignInResult {
        guard let clientId = googleClientId else {
            throw GoogleSignInError.missingClientId
        }
        
        // Generate PKCE code verifier and challenge
        let verifier = generateCodeVerifier()
        let challenge = generateCodeChallenge(from: verifier)
        self.codeVerifier = verifier
        
        // Build the Google OAuth URL with PKCE
        let authURL = buildAuthURL(clientId: clientId, codeChallenge: challenge)
        
        // Get authorization code
        let authCode = try await getAuthorizationCode(authURL: authURL)
        
        // Exchange authorization code for tokens using PKCE
        let tokens = try await exchangeCodeForTokens(
            code: authCode,
            clientId: clientId,
            codeVerifier: verifier
        )

        #if DEBUG
        logGoogleIdTokenDiagnostics(idToken: tokens.idToken, clientId: clientId)
        #endif
        
        return GoogleSignInResult(idToken: tokens.idToken)
    }
    
    // MARK: - Authorization Code Flow
    
    private func getAuthorizationCode(authURL: URL) async throws -> String {
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: callbackScheme
            ) { [weak self] callbackURL, error in
                guard let self else { return }
                
                if let error {
                    self.continuation?.resume(throwing: GoogleSignInError.authenticationFailed(error))
                    self.continuation = nil
                    return
                }
                
                guard let callbackURL else {
                    self.continuation?.resume(throwing: GoogleSignInError.noCallbackURL)
                    self.continuation = nil
                    return
                }
                
                do {
                    let code = try self.parseAuthorizationCode(from: callbackURL)
                    self.continuation?.resume(returning: code)
                } catch {
                    self.continuation?.resume(throwing: error)
                }
                self.continuation = nil
            }
            
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            
            self.authSession = session
            
            if !session.start() {
                continuation.resume(throwing: GoogleSignInError.failedToStart)
                self.continuation = nil
            }
        }
    }
    
    // MARK: - Token Exchange (PKCE)
    
    private func exchangeCodeForTokens(
        code: String,
        clientId: String,
        codeVerifier: String
    ) async throws -> TokenResponse {
        let redirectURI = "\(callbackScheme):/oauth2redirect"
        
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        let params = [
            "client_id": clientId,
            "code": code,
            "code_verifier": codeVerifier,
            "grant_type": "authorization_code",
            "redirect_uri": redirectURI
        ]
        
        request.httpBody = params
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GoogleSignInError.tokenExchangeFailed("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw GoogleSignInError.tokenExchangeFailed("HTTP \(httpResponse.statusCode): \(errorBody)")
        }
        
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(TokenResponse.self, from: data)
    }
    
    // MARK: - PKCE Helpers
    
    private func generateCodeVerifier() -> String {
        var buffer = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, buffer.count, &buffer)
        return Data(buffer).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
    
    private func generateCodeChallenge(from verifier: String) -> String {
        let data = Data(verifier.utf8)
        let hash = SHA256.hash(data: data)
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
    
    // MARK: - Private Helpers
    
    private var googleClientId: String? {
        Bundle.main.infoDictionary?["GIDClientID"] as? String
    }

    #if DEBUG
    private func logGoogleIdTokenDiagnostics(idToken: String, clientId: String) {
        let parts = idToken.split(separator: ".")
        guard parts.count >= 2,
              let payloadData = Self.base64URLDecodedData(String(parts[1])),
              let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any] else {
            AppLogger.warn("Unable to decode Google ID token claims")
            return
        }

        var metadata: [String: CustomStringConvertible] = [
            "configuredClientId": clientId,
            "tokenAudience": payload["aud"] as? String ?? "missing",
            "issuer": payload["iss"] as? String ?? "missing"
        ]

        if let authorizedParty = payload["azp"] as? String {
            metadata["authorizedParty"] = authorizedParty
        }

        AppLogger.info("Google ID token claims decoded", metadata: metadata)
    }

    private static func base64URLDecodedData(_ value: String) -> Data? {
        var base64 = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let paddingLength = (4 - base64.count % 4) % 4
        base64.append(String(repeating: "=", count: paddingLength))
        return Data(base64Encoded: base64)
    }
    #endif
    
    /// URL scheme for OAuth callback - uses reversed client ID for iOS OAuth clients
    private var callbackScheme: String {
        guard let clientId = googleClientId else { return "" }
        return clientId.components(separatedBy: ".").reversed().joined(separator: ".")
    }
    
    private func buildAuthURL(clientId: String, codeChallenge: String) -> URL {
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        
        let redirectURI = "\(callbackScheme):/oauth2redirect"
        
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "prompt", value: "select_account"),
        ]
        
        return components.url!
    }
    
    private func parseAuthorizationCode(from url: URL) throws -> String {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw GoogleSignInError.invalidCallbackURL
        }
        
        if let error = components.queryItems?.first(where: { $0.name == "error" })?.value {
            throw GoogleSignInError.oauthError(error)
        }
        
        guard let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
            throw GoogleSignInError.noAuthorizationCode
        }
        
        return code
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension GoogleSignInManager: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard Thread.isMainThread else {
            return DispatchQueue.main.sync {
                MainActor.assumeIsolated {
                    Self.getPresentationAnchor()
                }
            }
        }

        return MainActor.assumeIsolated {
            Self.getPresentationAnchor()
        }
    }
    
    @MainActor
    private static func getPresentationAnchor() -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}

// MARK: - Supporting Types

struct GoogleSignInResult {
    /// The ID token to send to the backend for verification
    let idToken: String
}

private struct TokenResponse: Decodable {
    let accessToken: String
    let idToken: String
    let tokenType: String
    let expiresIn: Int
    let scope: String?
    let refreshToken: String?
}

enum GoogleSignInError: LocalizedError {
    case missingClientId
    case failedToStart
    case authenticationFailed(Error)
    case noCallbackURL
    case invalidCallbackURL
    case noAuthorizationCode
    case oauthError(String)
    case tokenExchangeFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .missingClientId:
            return "Google Client ID not configured. Please add GIDClientID to Info.plist."
        case .failedToStart:
            return "Failed to start authentication session."
        case .authenticationFailed(let error):
            return "Authentication failed: \(error.localizedDescription)"
        case .noCallbackURL:
            return "No callback URL received from Google."
        case .invalidCallbackURL:
            return "Invalid callback URL format."
        case .noAuthorizationCode:
            return "No authorization code in callback."
        case .oauthError(let error):
            return "Google sign-in error: \(error)"
        case .tokenExchangeFailed(let reason):
            return "Token exchange failed: \(reason)"
        }
    }
}
