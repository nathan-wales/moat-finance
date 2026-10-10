import Foundation

@MainActor
final class FinancialProfileViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case saving
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var profileData: FinancialProfileData = .loadingPlaceholder
    @Published private(set) var institutions: [PlaidInstitution] = []
    @Published private(set) var realEstateProperties: [RealEstateProperty] = []
    @Published private(set) var actionMessage: FinancialProfileActionMessage?
    @Published private(set) var isSaving = false

    private let service: FinancialProfileService
    private let realEstateService: RealEstateService
    private let investmentsService: InvestmentsService
    private let linkCoordinator: PlaidLinkCoordinator

    init(
        service: FinancialProfileService = FinancialProfileService(),
        realEstateService: RealEstateService = RealEstateService(),
        investmentsService: InvestmentsService = InvestmentsService(),
        linkCoordinator: PlaidLinkCoordinator? = nil
    ) {
        self.service = service
        self.realEstateService = realEstateService
        self.investmentsService = investmentsService
        self.linkCoordinator = linkCoordinator ?? PlaidLinkCoordinator()
    }

    var isDemoMode: Bool {
        let sessionKey = UserDefaults.standard.string(forKey: DemoModeDefaults.sessionKey)
        return sessionKey?.isEmpty == false
    }

    var totalVisibleAccountBalance: Double {
        visibleAccounts.reduce(0) { $0 + $1.balance }
    }

    var reconnectCount: Int {
        institutions.filter(\.requiresReconnect).count
    }

    var visibleAccounts: [ProfileAccount] {
        profileData.accounts.filter { $0.hidden != true }
    }

    var hiddenAccounts: [ProfileAccount] {
        profileData.accounts.filter { $0.hidden == true }
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func saveProfile(_ data: FinancialProfileData) async {
        let previous = profileData
        profileData = data
        isSaving = true
        state = .saving

        do {
            let saved = try await service.saveProfile(data)
            profileData = saved
            isSaving = false
            state = .loaded
            MoatDataRefresh.notifySetupGuideChanged()
        } catch {
            profileData = previous
            isSaving = false
            actionMessage = FinancialProfileActionMessage(
                title: "Save failed",
                message: error.localizedDescription
            )
            await reload(showLoading: false)
        }
    }

    func updateProfileRecord(_ record: FinancialProfileRecord) async {
        var data = profileData
        data.profile = record
        await saveProfile(data)
    }

    func upsertAccount(_ account: ProfileAccount) async {
        var data = profileData
        data.accounts = upsert(account, in: data.accounts)
        await saveProfile(data)
    }

    func upsertManualAccount(
        _ account: ProfileAccount,
        linkedInvestment: ProfileInvestment?
    ) async {
        if let linkedInvestment {
            await upsertCanonicalManualInvestment(account: account, linkedInvestment: linkedInvestment)
            return
        }

        if let existingInvestmentId = investmentIdFromAccountId(account.id) {
            do {
                try await investmentsService.deleteInvestment(id: existingInvestmentId)
            } catch {
                actionMessage = FinancialProfileActionMessage(
                    title: "Save failed",
                    message: error.localizedDescription
                )
                return
            }

            var data = profileData
            data.accounts = data.accounts.filter {
                $0.id != account.id && $0.id != "investment-acct-\(existingInvestmentId)"
            }
            data.investments = data.investments.filter {
                $0.id != existingInvestmentId && $0.accountLink != account.id
            }
            let plainAccount = ProfileAccount(
                id: account.id.hasPrefix("investment-acct-") ? newId("account") : account.id,
                name: account.name,
                institution: account.institution,
                type: account.type,
                balance: account.balance,
                connectionStatus: account.connectionStatus,
                lastSynced: account.lastSynced,
                syncIsStale: account.syncIsStale,
                includedInNetWorth: account.includedInNetWorth,
                hidden: account.hidden,
                plaidItemId: account.plaidItemId,
                notes: account.notes
            )
            data.accounts = upsert(plainAccount, in: data.accounts)
            await saveProfile(data)
            return
        }

        var data = profileData
        data.accounts = upsert(account, in: data.accounts)
        data.investments = data.investments.filter { $0.accountLink != account.id }
        await saveProfile(data)
    }

    func upsertSyncedAccountPreferences(
        _ account: ProfileAccount,
        linkedInvestment: ProfileInvestment?
    ) async {
        var data = profileData
        data.accounts = upsert(account, in: data.accounts)
        if let linkedInvestment {
            data.investments = upsert(linkedInvestment, in: data.investments)
        } else if let existingIndex = data.investments.firstIndex(where: {
            $0.accountLink == account.id
        }) {
            var updatedInvestment = data.investments[existingIndex]
            updatedInvestment.notes = account.notes
            data.investments[existingIndex] = updatedInvestment
        }
        await saveProfile(data)
    }

    func deleteAccount(accountId: String) async {
        let target = profileData.accounts.first { $0.id == accountId }
        let isSynced = target?.connectionStatus == "Synced" || target?.plaidItemId != nil
        if isSynced {
            do {
                try await service.setAccountSyncEnabled(accountId: accountId, syncEnabled: false)
            } catch {
                actionMessage = FinancialProfileActionMessage(
                    title: "Disconnect failed",
                    message: error.localizedDescription
                )
                return
            }
        }
        if let investmentId = investmentIdFromAccountId(accountId) {
            do {
                try await investmentsService.deleteInvestment(id: investmentId)
            } catch {
                actionMessage = FinancialProfileActionMessage(
                    title: "Delete failed",
                    message: error.localizedDescription
                )
                return
            }
        }
        var data = profileData
        data.accounts = data.accounts.filter { $0.id != accountId }
        data.investments = data.investments.filter { $0.accountLink != accountId }
        await saveProfile(data)
    }

    func hideAccount(accountId: String) async {
        var data = profileData
        data.accounts = data.accounts.map { account in
            guard account.id == accountId else { return account }
            var updated = account
            updated.hidden = true
            return updated
        }
        await saveProfile(data)
    }

    func unhideAccount(accountId: String) async {
        var data = profileData
        data.accounts = data.accounts.map { account in
            guard account.id == accountId else { return account }
            var updated = account
            updated.hidden = false
            return updated
        }
        await saveProfile(data)
    }

    func upsertAsset(_ asset: ProfileAsset) async {
        var data = profileData
        data.assets = upsert(asset, in: data.assets)
        await saveProfile(data)
    }

    func deleteAsset(assetId: String) async {
        var data = profileData
        data.assets = data.assets.filter { $0.id != assetId }
        await saveProfile(data)
    }

    func removeLegacyRealEstateAssets() async {
        var data = profileData
        data.assets = data.assets.filter { !RealEstateAssetSync.isLegacyAsset($0) }
        await saveProfile(data)
    }

    func realEstateProperty(for asset: ProfileAsset) -> RealEstateProperty? {
        guard RealEstateAssetSync.isSyncedAssetId(asset.id) else { return nil }
        let propertyId = RealEstateAssetSync.propertyId(fromAssetId: asset.id)
        return realEstateProperties.first { $0.id == propertyId }
    }

    func refreshRealEstateProperties() async {
        await reload(showLoading: false)
    }

    func saveRealEstate(property: RealEstateProperty? = nil, values: RealEstateFormValues) async throws {
        isSaving = true
        state = .saving
        defer { isSaving = false }

        if let property {
            try await realEstateService.update(id: property.id, values: values)
        } else {
            try await realEstateService.create(values: values)
        }
        await reload(showLoading: false)
    }

    func deleteRealEstate(propertyId: String) async {
        isSaving = true
        state = .saving

        do {
            try await realEstateService.delete(id: propertyId)
            isSaving = false
            actionMessage = FinancialProfileActionMessage(
                title: "Property removed",
                message: "The property was removed from your profile."
            )
            await reload(showLoading: false)
        } catch {
            isSaving = false
            actionMessage = FinancialProfileActionMessage(
                title: "Delete failed",
                message: error.localizedDescription
            )
            state = .loaded
        }
    }

    var linkedAccounts: [LinkedPlaidAccountSummary] {
        institutions.flatMap { institution in
            institution.accounts
                .filter { $0.isActive }
                .map { LinkedPlaidAccountSummary(account: $0, institutionName: institution.institutionName) }
        }
    }

    var mortgageAccountCandidates: [LinkedPlaidAccountSummary] {
        linkedAccounts.sorted { lhs, rhs in
            if lhs.isMortgageCandidate != rhs.isMortgageCandidate {
                return lhs.isMortgageCandidate && !rhs.isMortgageCandidate
            }
            return lhs.displayName < rhs.displayName
        }
    }

    func upsertLiability(_ liability: ProfileLiability) async {
        var data = profileData
        data.liabilities = upsert(liability, in: data.liabilities)
        await saveProfile(data)
    }

    func deleteLiability(liabilityId: String) async {
        var data = profileData
        data.liabilities = data.liabilities.filter { $0.id != liabilityId }
        await saveProfile(data)
    }

    func upsertInvestment(
        _ investment: ProfileInvestment,
        linkedAccount: ProfileAccount? = nil
    ) async {
        let account = linkedAccount ?? ProfileAccount(
            id: investment.accountLink ?? "investment-acct-\(investment.id)",
            name: investment.name,
            institution: "Manual",
            type: investment.type,
            balance: investment.currentValue,
            connectionStatus: "Manual",
            lastSynced: "Manual",
            syncIsStale: nil,
            includedInNetWorth: true,
            hidden: nil,
            plaidItemId: nil,
            notes: investment.notes
        )
        await upsertCanonicalManualInvestment(account: account, linkedInvestment: investment)
    }

    func deleteInvestment(investmentId: String) async {
        do {
            if !investmentId.hasPrefix("plaid-"), !investmentId.hasPrefix("plaid_") {
                try await investmentsService.deleteInvestment(id: investmentId)
            }
            var data = profileData
            data.investments = data.investments.filter { $0.id != investmentId }
            data.accounts = data.accounts.filter { $0.id != "investment-acct-\(investmentId)" }
            await saveProfile(data)
        } catch {
            actionMessage = FinancialProfileActionMessage(
                title: "Delete failed",
                message: error.localizedDescription
            )
        }
    }

    func upsertInsurancePolicy(_ policy: InsurancePolicy) async {
        let blockedReasons = getInsuranceBlockedCloudReasons(policy: policy)
        if let first = blockedReasons.first {
            actionMessage = FinancialProfileActionMessage(
                title: "Cannot save to Moat Cloud",
                message: first.userFacingMessage
            )
            return
        }

        var data = profileData
        data.insurancePolicies = upsert(policy, in: data.insurancePolicies)
        await saveProfile(data)
    }

    func deleteInsurancePolicy(policyId: String) async {
        var data = profileData
        data.insurancePolicies = data.insurancePolicies.filter { $0.id != policyId }
        await saveProfile(data)
    }

    func updateTaxProfile(_ taxProfile: TaxProfile) async {
        var data = profileData
        data.taxProfile = taxProfile
        await saveProfile(data)
    }

    func updateForecastAssumptions(_ assumptions: ForecastAssumptions) async {
        var data = profileData
        data.forecastAssumptions = assumptions
        await saveProfile(data)
    }

    func upsertPlanningNote(_ note: PlanningNote) async {
        var data = profileData
        data.planningNotes = upsert(note, in: data.planningNotes)
        await saveProfile(data)
    }

    func deletePlanningNote(noteId: String) async {
        var data = profileData
        data.planningNotes = data.planningNotes.filter { $0.id != noteId }
        await saveProfile(data)
    }

    /// Opens native Plaid Link for a new connection.
    ///
    /// Do not present `ConnectInstitutionSheet` here. Restore that multi-provider
    /// interstitial when MX and Finicity integration is ready.
    func connectWithLink() async {
        if isDemoMode {
            actionMessage = FinancialProfileActionMessage(
                title: "Demo connection",
                message: "Sample institutions cannot run a Plaid connect flow. Exit demo mode to connect a real institution."
            )
            return
        }

        await performPlaidAction(title: "Bank connected") {
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
            actionMessage = FinancialProfileActionMessage(
                title: "Demo connection",
                message: "Sample institutions cannot run a Plaid reconnect flow. Exit demo mode to reconnect a real institution."
            )
            return
        }

        await performPlaidAction(title: "Institution reconnected") {
            let linkToken = try await service.createReconnectToken(itemId: institution.id)
            _ = try await linkCoordinator.open(linkToken: linkToken.linkToken)
            try await service.reconnectItem(itemId: institution.id)

            return "\(institution.institutionName) is reconnected and syncing."
        }
        await refresh()
    }

    func syncAll() async {
        await performPlaidAction(title: "Sync started") {
            try await service.syncAll()
            MoatDataRefresh.notifyTransactionsChanged()
            return "All connected institutions are syncing."
        }
        await refresh()
    }

    func sync(_ institution: PlaidInstitution) async {
        await performPlaidAction(title: "Sync started") {
            try await service.syncItem(itemId: institution.id)
            MoatDataRefresh.notifyTransactionsChanged()
            return institution.institutionName
        }
        await refresh()
    }

    func reconnect(_ institution: PlaidInstitution) async {
        await performPlaidAction(title: "Reconnect started") {
            try await service.reconnectItem(itemId: institution.id)
            return institution.institutionName
        }
        await refresh()
    }

    func disconnect(_ institution: PlaidInstitution) async {
        await performPlaidAction(title: "Connection removed") {
            try await service.disconnectItem(itemId: institution.id)
            MoatDataRefresh.notifyTransactionsChanged()
            return "\(institution.institutionName) has been disconnected and its synced data removed."
        }
        await refresh()
    }

    func syncAppleWallet() async {
        if isDemoMode {
            actionMessage = FinancialProfileActionMessage(
                title: "Demo mode",
                message: "Apple Wallet sync is unavailable in demo mode."
            )
            return
        }

        guard AppleFinanceKitAvailability.isSupportedOSVersion else {
            actionMessage = FinancialProfileActionMessage(
                title: "Unsupported device",
                message: "Apple Wallet sync requires iOS 17.4 or later."
            )
            return
        }

        state = .refreshing

        do {
            let syncService = AppleFinanceKitSyncService()
            let result = try await syncService.resyncConnectedAccounts()
            MoatDataRefresh.notifyTransactionsChanged()
            actionMessage = FinancialProfileActionMessage(
                title: "Apple Wallet synced",
                message: result.failedAccounts.isEmpty
                    ? AppleWalletConnectViewModel.syncSummary(for: result)
                    : "Partial sync completed. Failed accounts: \(result.failedAccounts.joined(separator: ", "))."
            )
            state = .loaded
            await refresh()
        } catch {
            actionMessage = FinancialProfileActionMessage(
                title: "Apple Wallet sync failed",
                message: error.localizedDescription
            )
            state = .loaded
        }
    }

    func disconnectAppleWallet() async {
        state = .refreshing

        do {
            try await service.disconnectAppleWallet()
            AppleFinanceKitBackgroundDelivery.disable()
            actionMessage = FinancialProfileActionMessage(
                title: "Apple Wallet disconnected",
                message: "Future syncs are stopped. Previously imported transactions remain in Moat Finance."
            )
            state = .loaded
            await refresh()
        } catch {
            actionMessage = FinancialProfileActionMessage(
                title: "Disconnect failed",
                message: error.localizedDescription
            )
            state = .loaded
        }
    }

    func setHidden(_ account: PlaidAccount, hidden: Bool) async {
        await performPlaidAction(title: hidden ? "Account hidden" : "Account shown") {
            try await service.setAccountHidden(accountId: account.id, hidden: hidden)
            return account.displayName
        }
        await refresh()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    func setActionMessage(title: String, message: String) {
        actionMessage = FinancialProfileActionMessage(title: title, message: message)
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            async let profileTask = service.loadProfile()
            async let institutionsTask = service.loadInstitutions()
            async let propertiesTask = realEstateService.list()

            let (profile, loadedInstitutions, properties) = try await (profileTask, institutionsTask, propertiesTask)
            profileData = profile
            institutions = loadedInstitutions
            realEstateProperties = properties
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

    private func performPlaidAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = FinancialProfileActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            if error as? PlaidLinkError == .cancelled {
                state = .loaded
                return
            }

            if case PlaidLinkError.linkExited(let message) = error {
                actionMessage = FinancialProfileActionMessage(
                    title: "Bank connection closed",
                    message: "Plaid Link did not complete. If your bank opened an OAuth page, return to Moat from the browser or banking app to finish the connection. \(message)"
                )
                state = .loaded
                return
            }

            actionMessage = FinancialProfileActionMessage(title: title, message: error.localizedDescription)
            state = .loaded
        }
    }

    private func upsertCanonicalManualInvestment(
        account: ProfileAccount,
        linkedInvestment: ProfileInvestment
    ) async {
        let existingInvestmentId =
            investmentIdFromAccountId(account.id)
            ?? (isPlaidInvestmentId(linkedInvestment.id) ? nil : linkedInvestment.id)

        let type = InvestmentType(profileType: linkedInvestment.type)
        let annualReturnRate = linkedInvestment.expectedReturn / 100
        let autoUpdate = linkedInvestment.autoUpdateBalance ?? true

        isSaving = true
        state = .saving

        do {
            let investmentId: String
            if let existingInvestmentId,
               profileData.investments.contains(where: { $0.id == existingInvestmentId })
                || account.id.hasPrefix("investment-acct-")
            {
                _ = try await investmentsService.saveInvestment(
                    id: existingInvestmentId,
                    type: type,
                    name: linkedInvestment.name,
                    startingBalance: linkedInvestment.currentValue,
                    monthlyContribution: linkedInvestment.monthlyContribution,
                    annualReturnRate: annualReturnRate,
                    notes: linkedInvestment.notes,
                    autoUpdateBalance: autoUpdate
                )
                investmentId = existingInvestmentId
            } else if !isPlaidInvestmentId(linkedInvestment.id) {
                do {
                    investmentId = try await investmentsService.createInvestment(
                        id: linkedInvestment.id,
                        type: type,
                        name: linkedInvestment.name,
                        startingBalance: linkedInvestment.currentValue,
                        monthlyContribution: linkedInvestment.monthlyContribution,
                        annualReturnRate: annualReturnRate,
                        notes: linkedInvestment.notes,
                        autoUpdateBalance: autoUpdate
                    )
                } catch {
                    _ = try await investmentsService.saveInvestment(
                        id: linkedInvestment.id,
                        type: type,
                        name: linkedInvestment.name,
                        startingBalance: linkedInvestment.currentValue,
                        monthlyContribution: linkedInvestment.monthlyContribution,
                        annualReturnRate: annualReturnRate,
                        notes: linkedInvestment.notes,
                        autoUpdateBalance: autoUpdate
                    )
                    investmentId = linkedInvestment.id
                }
            } else {
                investmentId = try await investmentsService.createInvestment(
                    id: nil,
                    type: type,
                    name: linkedInvestment.name,
                    startingBalance: linkedInvestment.currentValue,
                    monthlyContribution: linkedInvestment.monthlyContribution,
                    annualReturnRate: annualReturnRate,
                    notes: linkedInvestment.notes,
                    autoUpdateBalance: autoUpdate
                )
            }

            let accountId = "investment-acct-\(investmentId)"
            let prefsAccount = ProfileAccount(
                id: accountId,
                name: linkedInvestment.name,
                institution: account.institution,
                type: account.type,
                balance: linkedInvestment.currentValue,
                connectionStatus: "Manual",
                lastSynced: "Manual",
                syncIsStale: nil,
                includedInNetWorth: account.includedInNetWorth,
                hidden: account.hidden,
                plaidItemId: nil,
                notes: linkedInvestment.notes ?? account.notes
            )
            let prefsInvestment = ProfileInvestment(
                id: investmentId,
                name: linkedInvestment.name,
                type: linkedInvestment.type,
                currentValue: linkedInvestment.currentValue,
                monthlyContribution: linkedInvestment.monthlyContribution,
                expectedReturn: linkedInvestment.expectedReturn,
                accountLink: accountId,
                includeInForecast: linkedInvestment.includeInForecast,
                autoUpdateBalance: autoUpdate,
                notes: linkedInvestment.notes
            )

            var data = profileData
            data.accounts = data.accounts.filter {
                $0.id != account.id && $0.id != accountId
            }
            data.accounts.append(prefsAccount)
            data.investments = data.investments.filter {
                $0.id != linkedInvestment.id
                    && $0.id != investmentId
                    && $0.accountLink != account.id
                    && $0.accountLink != accountId
            }
            data.investments.append(prefsInvestment)

            let saved = try await service.saveProfile(data)
            profileData = saved
            isSaving = false
            state = .loaded
            MoatDataRefresh.notifySetupGuideChanged()
            await reload(showLoading: false)
        } catch {
            isSaving = false
            actionMessage = FinancialProfileActionMessage(
                title: "Save failed",
                message: error.localizedDescription
            )
            await reload(showLoading: false)
        }
    }

    private func investmentIdFromAccountId(_ accountId: String) -> String? {
        let prefix = "investment-acct-"
        guard accountId.hasPrefix(prefix) else { return nil }
        return String(accountId.dropFirst(prefix.count))
    }

    private func isPlaidInvestmentId(_ id: String) -> Bool {
        id.hasPrefix("plaid-") || id.hasPrefix("plaid_")
    }

    private func upsert<T: Identifiable>(_ item: T, in array: [T]) -> [T] where T.ID == String {
        if array.contains(where: { $0.id == item.id }) {
            return array.map { $0.id == item.id ? item : $0 }
        }

        return array + [item]
    }
}
