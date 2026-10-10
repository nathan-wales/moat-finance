import Foundation

@MainActor
final class AccountSettingsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var snapshot: AccountSettingsSnapshot?
    @Published private(set) var actionMessage: AccountSettingsActionMessage?
    @Published private(set) var generatedTwoFactorSecret: TwoFactorSecretResponse?
    @Published private(set) var backupCodes: [String] = []
    @Published private(set) var exportedDataText: String?
    @Published private(set) var profileName: String?

    private let service: AccountSettingsService
    private let authManager: AuthManager

    init(service: AccountSettingsService = AccountSettingsService()) {
        self.service = service
        authManager = .shared
    }

    var email: String { authManager.session?.email ?? "" }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func updateProfile(name: String) async throws {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw AccountSettingsValidationError.emptyName }
        let response = try await service.updateProfile(name: trimmedName)
        profileName = response.name
        actionMessage = AccountSettingsActionMessage(title: "Profile updated", message: response.name)
    }

    func exportData() async -> Bool {
        do {
            let data = try await service.exportData()
            exportedDataText = data.prettyPrintedJSON
            return true
        } catch {
            actionMessage = AccountSettingsActionMessage(title: "Export failed", message: error.localizedDescription)
            return false
        }
    }

    func generateTwoFactorSecret() async {
        do {
            generatedTwoFactorSecret = try await service.generateTwoFactorSecret()
        } catch {
            actionMessage = AccountSettingsActionMessage(title: "Two-factor setup failed", message: error.localizedDescription)
        }
    }

    func enableTwoFactor(token: String) async throws {
        let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedToken.isEmpty else { throw AccountSettingsValidationError.emptyToken }
        guard let secret = generatedTwoFactorSecret?.secret else { return }
        let response = try await service.enableTwoFactor(secret: secret, token: trimmedToken)
        backupCodes = response.backupCodes
        generatedTwoFactorSecret = nil
        await refresh()
    }

    func disableTwoFactor(password: String) async throws {
        let trimmedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPassword.isEmpty else { throw AccountSettingsValidationError.emptyPassword }
        try await service.disableTwoFactor(password: trimmedPassword)
        actionMessage = AccountSettingsActionMessage(title: "Two-factor disabled", message: "Password verification completed")
        await refresh()
    }

    func deleteAccount(confirmationEmail: String) async throws {
        let trimmedEmail = confirmationEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedEmail.caseInsensitiveCompare(email) == .orderedSame else { throw AccountSettingsValidationError.emailMismatch }
        try await service.deleteAccount(email: trimmedEmail)
        await authManager.signOut(reason: "account_deleted")
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            snapshot = try await service.load()
            state = .loaded
        } catch {
            if error.isCancellation {
                if case .refreshing = state {
                    state = .loaded
                }
                return
            }
            state = .error(error)
        }
    }
}

private extension JSONValue {
    var prettyPrintedJSON: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        guard let data = try? encoder.encode(self),
              let text = String(data: data, encoding: .utf8)
        else {
            return displayValue
        }

        return text
    }

    var exportSummary: String {
        guard let object = objectValue else { return displayValue }
        let financialData = object["financialData"]?.objectValue
        let automation = object["automation"]?.objectValue
        let investments = object["investments"]?.objectValue
        let connectedAccounts = object["connectedAccounts"]?.objectValue

        let transactions = financialData?["transactions"]?.arrayValue?.count ?? 0
        let categories = financialData?["categories"]?.arrayValue?.count ?? 0
        let rules = automation?["rules"]?.arrayValue?.count ?? 0
        let portfolios = investments?["portfolios"]?.arrayValue?.count ?? 0
        let plaidAccounts = connectedAccounts?["plaidAccounts"]?.arrayValue?.count ?? 0

        return "\(transactions) transactions, \(categories) categories, \(rules) rules, \(portfolios) investments, \(plaidAccounts) linked accounts"
    }
}