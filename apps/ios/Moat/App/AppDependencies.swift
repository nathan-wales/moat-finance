import Foundation

/// Central dependency container for the app
/// In a larger app, this would use proper DI. For the scaffold, we use singletons.
@MainActor
enum AppDependencies {
    
    // MARK: - Core Services
    
    static let apiClient = APIClient.shared
    static let credentialsStore = CredentialsStore.shared
    static let authManager = AuthManager.shared
    static let appLockManager = AppLockManager.shared
    static let biometricAuthService = BiometricAuthService.shared
    
    // MARK: - Feature Services
    
    static func makeDashboardService() -> DashboardService {
        DashboardService(apiClient: apiClient)
    }
}
