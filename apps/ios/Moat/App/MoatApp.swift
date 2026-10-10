import SwiftUI

@main
struct MoatApp: App {
    @SwiftUI.Environment(\.scenePhase) private var scenePhase
    @AppStorage(DemoModeDefaults.sessionKey) private var demoSessionKey = ""
    @StateObject private var deepLinkRouter = DeepLinkRouter()
    @AppStorage(MoatAppearance.storageKey) private var appearanceRawValue = MoatAppearance.system.rawValue

    private var appearance: MoatAppearance {
        MoatAppearance(rawValue: appearanceRawValue) ?? .system
    }

    init() {
        MoatToggleAppearance.configure()
        Analytics.setup()
        AppLogger.info(
            "App launch started",
            metadata: [
                "operation": "app.launch",
                "bundleIdentifier": Environment.bundleIdentifier,
                "appVersion": Environment.appVersion,
                "buildNumber": Environment.buildNumber
            ]
        )

        Task {
            await AuthManager.shared.bootstrap()
        }
    }

    var body: some Scene {
        WindowGroup {
            AppRouter()
                .environmentObject(deepLinkRouter)
                .onOpenURL { url in
                    deepLinkRouter.handle(url)
                }
                .tint(MoatTheme.ColorToken.ink)
                .preferredColorScheme(appearance.colorScheme)
                .onChange(of: scenePhase) { phase in
                    AppLockManager.shared.handleScenePhase(phase, isDemoMode: !demoSessionKey.isEmpty)
                }
        }
    }
}
