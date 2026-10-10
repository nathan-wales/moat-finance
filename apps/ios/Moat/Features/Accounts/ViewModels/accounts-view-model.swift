import Foundation

@MainActor
final class AccountsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var institutions: [PlaidInstitution] = []
    @Published private(set) var actionMessage: AccountsActionMessage?

    private let service: AccountsService
    private let linkCoordinator: PlaidLinkCoordinator

    init(
        service: AccountsService = AccountsService(),
        linkCoordinator: PlaidLinkCoordinator? = nil
    ) {
        self.service = service
        self.linkCoordinator = linkCoordinator ?? PlaidLinkCoordinator()
    }

    var totalBalance: Double {
        institutions.reduce(0) { $0 + $1.balance }
    }

    var accountCount: Int {
        institutions.reduce(0) { $0 + $1.accounts.count }
    }

    var reconnectCount: Int {
        institutions.filter(\.requiresReconnect).count
    }

    var isDemoMode: Bool {
        let sessionKey = UserDefaults.standard.string(forKey: DemoModeDefaults.sessionKey)
        return sessionKey?.isEmpty == false
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    /// Opens native Plaid Link for a new connection.
    ///
    /// Do not present `ConnectInstitutionSheet` here. Restore that multi-provider
    /// interstitial when MX and Finicity integration is ready.
    func connectWithLink() async {
        if isDemoMode {
            actionMessage = AccountsActionMessage(
                title: "Demo connection",
                message: "Sample institutions cannot run a Plaid connect flow. Exit demo mode to connect a real institution."
            )
            return
        }

        await performAction(title: "Bank connected") {
            let linkToken = try await service.createLinkToken()
            let completion = try await linkCoordinator.open(linkToken: linkToken.linkToken)
            let result = try await service.exchangePublicToken(
                publicToken: completion.publicToken,
                metadata: completion.metadata
            )
            PostConnectTransactionPolling.shared.start(plaidItemDbId: result.plaidItemDbId)
            let noun = result.accountCount == 1 ? "account" : "accounts"
            return "\(result.institutionName) is connected with \(result.accountCount) \(noun)."
        }
        await refresh()
    }

    func reconnectWithLink(for institution: PlaidInstitution) async {
        if isDemoMode {
            actionMessage = AccountsActionMessage(
                title: "Demo connection",
                message: "Sample institutions cannot run a Plaid reconnect flow. Exit demo mode to reconnect a real institution."
            )
            return
        }

        await performAction(title: "Institution reconnected") {
            let linkToken = try await service.createReconnectToken(itemId: institution.id)
            _ = try await linkCoordinator.open(linkToken: linkToken.linkToken)
            try await service.reconnectItem(itemId: institution.id)

            return "\(institution.institutionName) is reconnected and syncing."
        }
        await refresh()
    }

    func syncAll() async {
        await performAction(title: "Sync started") {
            try await service.syncAll()
            MoatDataRefresh.notifyTransactionsChanged()
            return "All connected institutions are syncing."
        }
        await refresh()
    }

    func sync(_ institution: PlaidInstitution) async {
        await performAction(title: "Sync started") {
            try await service.syncItem(itemId: institution.id)
            MoatDataRefresh.notifyTransactionsChanged()
            return institution.institutionName
        }
        await refresh()
    }

    func reconnect(_ institution: PlaidInstitution) async {
        await performAction(title: "Reconnect started") {
            try await service.reconnectItem(itemId: institution.id)
            return institution.institutionName
        }
        await refresh()
    }

    func disconnect(_ institution: PlaidInstitution) async {
        await performAction(title: "Institution disconnected") {
            try await service.disconnectItem(itemId: institution.id)
            MoatDataRefresh.notifyTransactionsChanged()
            return institution.institutionName
        }
        await refresh()
    }

    func setHidden(_ account: PlaidAccount, hidden: Bool) async {
        await performAction(title: hidden ? "Account hidden" : "Account shown") {
            try await service.setAccountHidden(accountId: account.id, hidden: hidden)
            return account.displayName
        }
        await refresh()
    }

    func setSyncEnabled(_ account: PlaidAccount, syncEnabled: Bool) async {
        await performAction(title: syncEnabled ? "Sync resumed" : "Sync paused") {
            try await service.setAccountSyncEnabled(accountId: account.id, syncEnabled: syncEnabled)
            return account.displayName
        }
        await refresh()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    func setActionMessage(title: String, message: String) {
        actionMessage = AccountsActionMessage(title: title, message: message)
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            let result = try await service.load()
            institutions = result.institutions
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

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = AccountsActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            if error as? PlaidLinkError == .cancelled {
                state = .loaded
                return
            }

            if case PlaidLinkError.linkExited(let message) = error {
                actionMessage = AccountsActionMessage(
                    title: "Bank connection closed",
                    message: "Plaid Link did not complete. If your bank opened an OAuth page, return to Moat from the browser or banking app to finish the connection. \(message)"
                )
                state = .loaded
                return
            }

            actionMessage = AccountsActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }

}
