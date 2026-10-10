import Foundation

enum ConnectInstitutionOverlayPhase: Equatable {
    case none
    case importing(institutionName: String?)
    case succeeded(institutionName: String, accountCount: Int, plaidItemDbId: String)

    var blocksDismiss: Bool {
        switch self {
        case .importing, .succeeded:
            return true
        case .none:
            return false
        }
    }

    var showsOverlay: Bool {
        switch self {
        case .none:
            return false
        case .importing, .succeeded:
            return true
        }
    }
}

struct ConnectInstitutionSuccess: Equatable {
    let institutionName: String
    let accountCount: Int
    let plaidItemDbId: String
}

enum ConnectInstitutionSheetCompletion: Equatable {
    case plaid(ConnectInstitutionSuccess)
    case message(String)
}

@MainActor
final class ConnectInstitutionViewModel: ObservableObject {
    @Published var query = ""
    @Published private(set) var searchResults: [InstitutionSearchResult] = []
    @Published private(set) var isSearching = false
    @Published private(set) var isConnecting = false
    @Published private(set) var selectedInstitutionId: String?
    @Published private(set) var resolvingPopularName: String?
    @Published private(set) var overlayPhase: ConnectInstitutionOverlayPhase = .none
    @Published var errorMessage: String?
    @Published var successMessage: String?
    @Published var showSecurity = false
    @Published var externalConnectURL: IdentifiableURL?
    /// When direct Plaid launch is cancelled/fails before overlay, sheet should dismiss.
    @Published private(set) var shouldDismissDirectConnect = false

    private let service: FinancialConnectionsService
    private let accountsService: AccountsService
    private let launchCoordinator: ProviderLaunchCoordinator
    private var searchTask: Task<Void, Never>?

    init(
        service: FinancialConnectionsService = FinancialConnectionsService(),
        accountsService: AccountsService = AccountsService(),
        launchCoordinator: ProviderLaunchCoordinator? = nil
    ) {
        self.service = service
        self.accountsService = accountsService
        self.launchCoordinator = launchCoordinator ?? ProviderLaunchCoordinator()
    }

    var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var shouldShowPopularGrid: Bool {
        trimmedQuery.count < 2
    }

    func reset() {
        searchTask?.cancel()
        query = ""
        searchResults = []
        isSearching = false
        isConnecting = false
        selectedInstitutionId = nil
        resolvingPopularName = nil
        overlayPhase = .none
        errorMessage = nil
        successMessage = nil
        showSecurity = false
        externalConnectURL = nil
        shouldDismissDirectConnect = false
    }

    func acknowledgeOverlaySuccess() -> ConnectInstitutionSuccess? {
        guard case .succeeded(let institutionName, let accountCount, let plaidItemDbId) = overlayPhase else {
            return nil
        }

        overlayPhase = .none
        return ConnectInstitutionSuccess(
            institutionName: institutionName,
            accountCount: accountCount,
            plaidItemDbId: plaidItemDbId
        )
    }

    func updateQuery(_ value: String) {
        query = value
        errorMessage = nil
        selectedInstitutionId = nil
        resolvingPopularName = nil
        scheduleSearch()
    }

    func selectPopularInstitution(_ institution: TopInstitution) {
        guard !isConnecting else { return }

        errorMessage = nil
        successMessage = nil
        selectedInstitutionId = nil
        resolvingPopularName = institution.name

        Task {
            await resolvePopularInstitution(named: institution.name)
        }
    }

    func selectInstitution(_ institution: InstitutionSearchResult) {
        guard !isConnecting else { return }

        selectedInstitutionId = institution.canonicalInstitutionId
        isConnecting = true

        Task {
            await connect(to: institution)
        }
    }

    /// Opens Plaid Link immediately (no Moat institution-search interstitial).
    ///
    /// TODO: Revisit institution-search / MX / Finicity multi-provider routing when
    /// we have a real user, customer, or business need. Keep that interstitial code —
    /// do not delete it.
    func startDirectPlaidConnect() {
        guard !isConnecting else { return }

        shouldDismissDirectConnect = false
        errorMessage = nil
        successMessage = nil
        isConnecting = true

        Task {
            await connectDirectPlaid()
        }
    }

    private func scheduleSearch() {
        searchTask?.cancel()

        let currentQuery = trimmedQuery
        guard currentQuery.count >= 2 else {
            searchResults = []
            isSearching = false
            return
        }

        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }

            isSearching = true
            defer { isSearching = false }

            do {
                let results = try await service.searchInstitutions(query: currentQuery, limit: 10)
                guard !Task.isCancelled, trimmedQuery == currentQuery else { return }
                searchResults = results
            } catch {
                guard !Task.isCancelled, trimmedQuery == currentQuery else { return }
                searchResults = []
                errorMessage = error.localizedDescription
            }
        }
    }

    private func resolvePopularInstitution(named name: String) async {
        isConnecting = true
        defer {
            isConnecting = false
            resolvingPopularName = nil
        }

        do {
            let results = try await service.searchInstitutions(query: name, limit: 5)
            guard let institution = results.first else {
                errorMessage = "No matching institutions found."
                return
            }

            selectedInstitutionId = institution.canonicalInstitutionId
            await connect(to: institution)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func connect(to institution: InstitutionSearchResult) async {
        isConnecting = true
        errorMessage = nil
        successMessage = nil

        defer { isConnecting = false }

        do {
            let session = try await service.createLinkSession(
                canonicalInstitutionId: institution.canonicalInstitutionId
            )

            let outcome = try await launchCoordinator.launch(
                session: session,
                institution: institution,
                onPlaidAuthorized: {
                    self.overlayPhase = .importing(institutionName: institution.displayName)
                }
            )
            handleLaunchOutcome(outcome)
        } catch {
            overlayPhase = .none

            if error as? PlaidLinkError == .cancelled {
                selectedInstitutionId = nil
                return
            }

            if case PlaidLinkError.linkExited(let message) = error {
                errorMessage = "Bank connection closed. \(message)"
                selectedInstitutionId = nil
                return
            }

            errorMessage = error.localizedDescription
            selectedInstitutionId = nil
        }
    }

    private func connectDirectPlaid() async {
        isConnecting = true
        errorMessage = nil
        successMessage = nil

        defer { isConnecting = false }

        do {
            let token = try await accountsService.createLinkToken()
            let routing = FinancialConnectionRouting(
                provider: .plaid,
                reason: "Direct Plaid launch from financial profile add-account.",
                confidence: "high",
                availableProviders: [.plaid]
            )
            let session = FinancialConnectionLinkSession.plaid(
                linkToken: token.linkToken,
                expiration: token.expiration,
                routing: routing
            )

            let outcome = try await launchCoordinator.launch(
                session: session,
                institution: nil,
                onPlaidAuthorized: {
                    self.overlayPhase = .importing(institutionName: nil)
                }
            )
            handleLaunchOutcome(outcome)
        } catch {
            overlayPhase = .none

            if error as? PlaidLinkError == .cancelled {
                shouldDismissDirectConnect = true
                return
            }

            if case PlaidLinkError.linkExited(let message) = error {
                errorMessage = "Bank connection closed. \(message)"
                return
            }

            errorMessage = error.localizedDescription
        }
    }

    private func handleLaunchOutcome(_ outcome: ProviderLaunchOutcome) {
        switch outcome {
        case .plaidConnected(let institutionName, let accountCount, let plaidItemDbId):
            overlayPhase = .succeeded(
                institutionName: institutionName,
                accountCount: accountCount,
                plaidItemDbId: plaidItemDbId
            )
            PostConnectTransactionPolling.shared.start(plaidItemDbId: plaidItemDbId)

        case .externalConnectOpened(let provider, let url):
            overlayPhase = .none
            externalConnectURL = IdentifiableURL(url: url)
            successMessage = "\(provider.displayName) Connect opened in your browser. Return to Moat when you finish signing in."
        }
    }
}

struct IdentifiableURL: Identifiable, Equatable {
    let id: String
    let url: URL

    init(url: URL) {
        self.url = url
        self.id = url.absoluteString
    }
}
