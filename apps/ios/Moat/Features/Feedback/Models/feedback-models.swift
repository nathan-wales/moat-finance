import Foundation

enum FeedbackConstants {
    static let maxMessageLength = 2000
    static let placeholder = "Tell us what happened or what you expected."
    static let privacyText =
        "Any information you share may be reviewed to help improve Moat Finance. You can also email support@moatfinance.ai."
    static let source = "WEB_APP"
    static let platform = "ios"
}

struct CreateFeedbackRequest: Encodable {
    let source: String
    let message: String
    let route: String?
    let platform: String?
    let appVersion: String?
    let userAgent: String?
    let metadata: [String: String]?
}

struct CreateFeedbackResponse: Decodable {
    let feedbackId: String
    let status: String
}
