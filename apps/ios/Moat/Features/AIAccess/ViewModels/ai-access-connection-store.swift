import Foundation

@MainActor
final class AIAccessConnectionStore: ObservableObject {
    static let shared = AIAccessConnectionStore()
    private static let bannerDismissKey = "moat:ai-access-connect-banner-dismissed"
    private static let legacyBannerDismissKey = "moat:agent-access-connect-banner-dismissed"

    enum ConnectionState: Equatable {
        case unknown
        case unconnected
        case connected
    }

    @Published private(set) var state: ConnectionState = .unknown
    @Published private(set) var isBannerDismissed: Bool

    private let service: AIAccessService

    init(service: AIAccessService = AIAccessService()) {
        self.service = service
        let defaults = UserDefaults.standard
        let dismissed =
            defaults.bool(forKey: Self.bannerDismissKey)
            || defaults.bool(forKey: Self.legacyBannerDismissKey)
        isBannerDismissed = dismissed
        if dismissed, !defaults.bool(forKey: Self.bannerDismissKey) {
            defaults.set(true, forKey: Self.bannerDismissKey)
        }
    }

    var shouldShowBanner: Bool {
        state == .unconnected && !isBannerDismissed
    }

    func dismissBanner() {
        guard !isBannerDismissed else { return }
        isBannerDismissed = true
        UserDefaults.standard.set(true, forKey: Self.bannerDismissKey)
    }

    func refresh() async {
        do {
            let connected = try await service.hasAnyConnection()
            state = connected ? .connected : .unconnected
        } catch {
            AppLogger.warn(
                "Failed to refresh AI access connection state",
                metadata: ["error": error.localizedDescription]
            )
        }
    }

    func apply(oauthConnections: [McpOAuthClientConnection], tokens: [McpPersonalAccessToken]) {
        let hasActiveAccess = oauthConnections.contains { $0.status == .active }
            || tokens.contains { $0.status == .active }
        state = hasActiveAccess ? .connected : .unconnected
    }
}
