import Foundation

@MainActor
final class ProviderLaunchCoordinator {
    private let accountsService: AccountsService
    private let plaidCoordinator: PlaidLinkCoordinator

    init(
        accountsService: AccountsService = AccountsService(),
        plaidCoordinator: PlaidLinkCoordinator? = nil
    ) {
        self.accountsService = accountsService
        self.plaidCoordinator = plaidCoordinator ?? PlaidLinkCoordinator()
    }

    /// Opens native Plaid Link without the multi-provider `ConnectInstitutionSheet`.
    ///
    /// Keep `ConnectInstitutionSheet` in the project, but do not present it until we
    /// integrate MX and Finicity and need institution-search / provider routing again.
    func launchDirectPlaid(onPlaidAuthorized: (() -> Void)? = nil) async throws -> ProviderLaunchOutcome {
        let token = try await accountsService.createLinkToken()
        let routing = FinancialConnectionRouting(
            provider: .plaid,
            reason: "Direct Plaid launch. Restore ConnectInstitutionSheet when MX / Finicity routing is needed.",
            confidence: "high",
            availableProviders: [.plaid]
        )
        let session = FinancialConnectionLinkSession.plaid(
            linkToken: token.linkToken,
            expiration: token.expiration,
            routing: routing
        )

        let outcome = try await launch(
            session: session,
            institution: nil,
            onPlaidAuthorized: onPlaidAuthorized
        )

        if case .plaidConnected(_, _, let plaidItemDbId) = outcome {
            PostConnectTransactionPolling.shared.start(plaidItemDbId: plaidItemDbId)
        }

        return outcome
    }

    func launch(
        session: FinancialConnectionLinkSession,
        institution: InstitutionSearchResult?,
        onPlaidAuthorized: (() -> Void)? = nil
    ) async throws -> ProviderLaunchOutcome {
        switch session {
        case .plaid(let linkToken, _, _):
            let completion = try await plaidCoordinator.open(linkToken: linkToken)
            onPlaidAuthorized?()
            let result = try await accountsService.exchangePublicToken(
                publicToken: completion.publicToken,
                metadata: completion.metadata,
                institutionName: institution?.displayName
            )

            return .plaidConnected(
                institutionName: result.institutionName,
                accountCount: result.accountCount,
                plaidItemDbId: result.plaidItemDbId
            )

        case .mx(let connectWidgetUrl, _, _):
            return .externalConnectOpened(provider: .mx, url: connectWidgetUrl)

        case .finicity(let connectUrl, _, _):
            return .externalConnectOpened(provider: .finicity, url: connectUrl)
        }
    }
}
