import Foundation

enum DemoModeDefaults {
    static let sessionKey = "moat.demoMode.sessionKey"
    static let expiresAt = "moat.demoMode.expiresAt"
}

struct DemoModeStatus: Decodable, Equatable {
    let isDemoMode: Bool
    let overlayExpiresAt: Date?
    let hasUnsavedDemoChanges: Bool
    let noticeDismissed: Bool
}

struct EnterDemoModeResponse: Decodable, Equatable {
    let success: Bool
    let sessionKey: String
    let expiresAt: Date
}

struct DemoModeSuccessResponse: Decodable, Equatable {
    let success: Bool
}

struct DemoModeActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}