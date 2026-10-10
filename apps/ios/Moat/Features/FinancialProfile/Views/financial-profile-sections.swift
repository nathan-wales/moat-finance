import SwiftUI

extension FinancialProfileViewModel {
    func investment(for accountId: String) -> ProfileInvestment? {
        profileData.investments.first { $0.accountLink == accountId }
    }

    func institution(for account: ProfileAccount) -> PlaidInstitution? {
        if let itemId = account.plaidItemId {
            return institutions.first { $0.id == itemId }
        }
        return institutions.first { institution in
            institution.institutionName == account.institution
                || institution.accounts.contains { $0.id == account.id }
        }
    }

    func plaidAccount(for account: ProfileAccount) -> PlaidAccount? {
        guard let institution = institution(for: account) else { return nil }
        return institution.accounts.first { $0.id == account.id }
            ?? institution.accounts.first { $0.plaidAccountId == account.id }
    }

    func investmentItem(for account: ProfileAccount) -> InvestmentItem {
        InvestmentItem.fromProfile(
            account: account,
            investment: investment(for: account.id),
            plaidAccount: plaidAccount(for: account)
        )
    }

    func syncedAccounts(for institution: PlaidInstitution) -> [ProfileAccount] {
        visibleAccounts.filter { account in
            if let itemId = account.plaidItemId {
                return itemId == institution.id
            }
            return account.connectionStatus == "Synced"
                && account.institution == institution.institutionName
        }
    }

    var manualVisibleAccounts: [ProfileAccount] {
        visibleAccounts.filter { $0.connectionStatus != "Synced" }
    }

    var appleWalletAccounts: [ProfileAccount] {
        visibleAccounts.filter { account in
            account.connectionStatus == "Synced" && account.institution == "Apple Wallet"
        }
    }

    func isAppleWalletAccount(_ account: ProfileAccount) -> Bool {
        account.connectionStatus == "Synced" && account.institution == "Apple Wallet"
    }

    func isSyncedAccount(_ account: ProfileAccount) -> Bool {
        account.connectionStatus == "Synced" || account.plaidItemId != nil
    }
}

struct FinancialProfileSectionsStack: View {
    @ObservedObject var viewModel: FinancialProfileViewModel
    let isLoading: Bool
    let onEditProfile: () -> Void
    let onConnectAccount: () -> Void
    let onSyncAppleWallet: () -> Void
    let onManageAppleWallet: () -> Void
    let onDisconnectAppleWallet: () -> Void
    let onAddManualAccount: () -> Void
    let onManageHiddenAccounts: () -> Void
    let onInstitutionDetail: (PlaidInstitution) -> Void
    let onInstitutionSync: (PlaidInstitution) -> Void
    let onInstitutionReconnect: (PlaidInstitution) -> Void
    let onInstitutionDisconnect: (PlaidInstitution) -> Void
    let onSelectAccount: (ProfileAccount) -> Void
    let onEditManualAccount: (ProfileAccount) -> Void
    let onAddRealEstate: () -> Void
    let onAddOtherAsset: () -> Void
    let onEditAsset: (ProfileAsset) -> Void
    let onRemoveLegacyRealEstate: () -> Void
    let onConnectLiability: () -> Void
    let onAddManualLiability: () -> Void
    let onEditLiability: (ProfileLiability) -> Void
    let onAddInsurance: () -> Void
    let onEditInsurance: (InsurancePolicy) -> Void
    let onEditTaxes: () -> Void
    var onOpenTaxes: () -> Void = {}
    let onEditAssumptions: () -> Void
    let onAddPlanningNote: () -> Void
    let onEditPlanningNote: (PlanningNote) -> Void

    var body: some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            FinancialProfileAccountsSection(
                viewModel: viewModel,
                isLoading: isLoading,
                onConnectAccount: onConnectAccount,
                onSyncAppleWallet: onSyncAppleWallet,
                onManageAppleWallet: onManageAppleWallet,
                onDisconnectAppleWallet: onDisconnectAppleWallet,
                onAddManualAccount: onAddManualAccount,
                onManageHiddenAccounts: onManageHiddenAccounts,
                onInstitutionDetail: onInstitutionDetail,
                onInstitutionSync: onInstitutionSync,
                onInstitutionReconnect: onInstitutionReconnect,
                onInstitutionDisconnect: onInstitutionDisconnect,
                onSelectAccount: onSelectAccount,
                onEditManualAccount: onEditManualAccount
            )

            FinancialProfileAssetsSection(
                assets: viewModel.profileData.assets,
                liabilities: viewModel.profileData.liabilities,
                policies: viewModel.profileData.insurancePolicies,
                isLoading: isLoading,
                onAddRealEstate: onAddRealEstate,
                onAddOtherAsset: onAddOtherAsset,
                onEdit: onEditAsset,
                onRemoveLegacyRealEstate: onRemoveLegacyRealEstate
            )

            FinancialProfileLiabilitiesSection(
                liabilities: viewModel.profileData.liabilities,
                assets: viewModel.profileData.assets,
                isLoading: isLoading,
                onConnectLiability: onConnectLiability,
                onAddManualLiability: onAddManualLiability,
                onEdit: onEditLiability
            )

            FinancialProfileInsuranceSection(
                policies: viewModel.profileData.insurancePolicies,
                isLoading: isLoading,
                onAdd: onAddInsurance,
                onEdit: onEditInsurance
            )

            FinancialProfileProfileSection(
                profile: viewModel.profileData.profile,
                isLoading: isLoading,
                onEdit: onEditProfile
            )

            FinancialProfileTaxesSection(
                taxProfile: viewModel.profileData.taxProfile,
                isLoading: isLoading,
                onEdit: onEditTaxes,
                onOpenTaxes: onOpenTaxes
            )

            FinancialProfileAssumptionsSection(
                assumptions: viewModel.profileData.forecastAssumptions,
                isLoading: isLoading,
                onEdit: onEditAssumptions
            )

            FinancialProfilePlanningNotesSection(
                notes: viewModel.profileData.planningNotes,
                isLoading: isLoading,
                onAdd: onAddPlanningNote,
                onEdit: onEditPlanningNote
            )
        }
        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Profile

private struct FinancialProfileProfileSection: View {
    let profile: FinancialProfileRecord
    let isLoading: Bool
    let onEdit: () -> Void

    var body: some View {
        FinancialProfileSectionCard(
            icon: "person.text.rectangle",
            title: "Profile",
            description: "Basic household context used across planning, forecasts, and guidance.",
            isLoading: isLoading
        ) {
            FinancialProfileSectionActionButton(title: "Edit", systemImage: "pencil", action: onEdit)
        } content: {
            financialProfileDetailGrid {
                FinancialProfileDetailRow(title: "Household type", value: profile.householdType)
                FinancialProfileDetailRow(title: "State / country", value: profile.location.isEmpty ? "Not set" : profile.location)
                FinancialProfileDetailRow(title: "Life stage", value: profile.lifeStage)
                FinancialProfileDetailRow(title: "Employment type", value: profile.employmentType)
                FinancialProfileDetailRow(title: "Planning horizon", value: profile.planningHorizon)
                FinancialProfileDetailRow(title: "Risk tolerance", value: profile.riskTolerance)
                FinancialProfileDetailRow(title: "Dependents", value: "\(profile.dependentsCount)")
                FinancialProfileDetailRow(title: "Housing status", value: profile.housingStatus)
                FinancialProfileDetailRow(title: "Last updated", value: formatDateString(profile.lastUpdated))
            }
        }
    }
}

// MARK: - Accounts

private struct FinancialProfileAccountsSection: View {
    @ObservedObject var viewModel: FinancialProfileViewModel
    let isLoading: Bool
    let onConnectAccount: () -> Void
    let onSyncAppleWallet: () -> Void
    let onManageAppleWallet: () -> Void
    let onDisconnectAppleWallet: () -> Void
    let onAddManualAccount: () -> Void
    let onManageHiddenAccounts: () -> Void
    let onInstitutionDetail: (PlaidInstitution) -> Void
    let onInstitutionSync: (PlaidInstitution) -> Void
    let onInstitutionReconnect: (PlaidInstitution) -> Void
    let onInstitutionDisconnect: (PlaidInstitution) -> Void
    let onSelectAccount: (ProfileAccount) -> Void
    let onEditManualAccount: (ProfileAccount) -> Void

    var body: some View {
        FinancialProfileSectionCard(
            icon: "building.columns.fill",
            title: "Accounts",
            description: "Connected, manual, and investment accounts that define where money is held, owed, synced, and forecasted.",
            isLoading: isLoading
        ) {
            Menu {
                // Opens native Plaid Link. Restore ConnectInstitutionSheet when
                // MX / Finicity multi-provider routing is ready — do not delete it.
                Button(action: onConnectAccount) {
                    Label("Connect account", systemImage: "link.badge.plus")
                }
                if showConnectAppleAccountOption {
                    Button(action: onManageAppleWallet) {
                        Label("Connect Apple account", systemImage: "wallet.pass.fill")
                    }
                }
                Button(action: onAddManualAccount) {
                    Label("Add manual account", systemImage: "square.and.pencil")
                }
                if !viewModel.hiddenAccounts.isEmpty {
                    Button(action: onManageHiddenAccounts) {
                        Label("Hidden accounts", systemImage: "eye.slash")
                    }
                }
            } label: {
                FinancialProfileSectionActionLabel(title: "Add")
            }
            .buttonStyle(FinancialProfileSectionActionButtonStyle())
        } content: {
            VStack(spacing: MoatTheme.Spacing.medium) {
                HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
                    FinancialProfileDetailRow(title: "Total balance", value: CurrencyFormatter.formatCompact(viewModel.totalVisibleAccountBalance))
                    FinancialProfileDetailRow(title: "Reconnect needed", value: "\(viewModel.reconnectCount)")
                }

                if viewModel.institutions.isEmpty && viewModel.manualVisibleAccounts.isEmpty && viewModel.appleWalletAccounts.isEmpty {
                    FinancialProfileEmptyState(
                        icon: "building.columns",
                        title: "No accounts yet",
                        message: "Connect a bank or add a manual account to start building your profile."
                    )
                }

                VStack(spacing: MoatTheme.Spacing.xLarge) {
                    if !viewModel.appleWalletAccounts.isEmpty {
                        financialProfileItemCard {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                                        Text("Apple Wallet")
                                            .font(.headline)
                                            .lineLimit(1)
                                        Text(appleWalletSyncSubtitle(for: viewModel.appleWalletAccounts))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(2)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                                    if isAppleWalletSyncStale(viewModel.appleWalletAccounts) {
                                        Text("Stale")
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(MoatTheme.ColorToken.warning)
                                            .padding(.horizontal, MoatTheme.Spacing.small)
                                            .padding(.vertical, MoatTheme.Spacing.xSmall)
                                            .background(MoatTheme.ColorToken.warning.opacity(0.12))
                                            .clipShape(Capsule())
                                    }
                                    Menu {
                                        Button(action: onSyncAppleWallet) {
                                            Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                                        }
                                        Button(action: onManageAppleWallet) {
                                            Label("Manage", systemImage: "wallet.pass")
                                        }
                                        Button(role: .destructive, action: onDisconnectAppleWallet) {
                                            Label("Disconnect", systemImage: "link.badge.minus")
                                                .labelStyle(.titleAndIcon)
                                        }
                                    } label: {
                                        MoatMoreMenuIcon(orientation: .horizontal)
                                    }
                                    .fixedSize()
                                }

                                VStack(spacing: MoatTheme.Spacing.small) {
                                    ForEach(viewModel.appleWalletAccounts) { account in
                                        FinancialProfileAccountRow(
                                            account: account,
                                            investment: viewModel.investment(for: account.id),
                                            onTap: { onSelectAccount(account) }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    ForEach(viewModel.institutions) { institution in
                        financialProfileItemCard {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                                        Text(institution.institutionName)
                                            .font(.headline)
                                            .lineLimit(1)
                                        Text(institutionSyncSubtitle(institution))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(2)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                                    if institution.requiresReconnect {
                                        Text("Reconnect")
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(MoatTheme.ColorToken.warning)
                                            .padding(.horizontal, MoatTheme.Spacing.small)
                                            .padding(.vertical, MoatTheme.Spacing.xSmall)
                                            .background(MoatTheme.ColorToken.warning.opacity(0.12))
                                            .clipShape(Capsule())
                                    }
                                    Menu {
                                        Button { onInstitutionDetail(institution) } label: {
                                            Label("Details", systemImage: "info.circle")
                                        }
                                        Button { onInstitutionSync(institution) } label: {
                                            Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                                        }
                                        Button { onInstitutionReconnect(institution) } label: {
                                            Label("Reconnect", systemImage: "link")
                                        }
                                        Divider()
                                        Button(role: .destructive) { onInstitutionDisconnect(institution) } label: {
                                            Label("Remove connection", systemImage: "link.badge.minus")
                                                .labelStyle(.titleAndIcon)
                                        }
                                    } label: {
                                        MoatMoreMenuIcon(orientation: .horizontal)
                                    }
                                    .fixedSize()
                                }

                                let accounts = viewModel.syncedAccounts(for: institution)
                                if accounts.isEmpty {
                                    Text("No synced profile accounts")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .padding(.leading, MoatTheme.Spacing.small)
                                } else {
                                    VStack(spacing: MoatTheme.Spacing.small) {
                                        ForEach(accounts) { account in
                                            FinancialProfileAccountRow(
                                                account: account,
                                                investment: viewModel.investment(for: account.id),
                                                onTap: { onSelectAccount(account) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.top, MoatTheme.Spacing.medium)

                if !viewModel.manualVisibleAccounts.isEmpty {
                    Text("Manual accounts")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: MoatTheme.Spacing.small) {
                        ForEach(viewModel.manualVisibleAccounts) { account in
                            FinancialProfileAccountRow(
                                account: account,
                                investment: viewModel.investment(for: account.id),
                                onTap: {
                                    if isInvestmentAccount(type: account.type) {
                                        onSelectAccount(account)
                                    } else {
                                        onEditManualAccount(account)
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    private var showConnectAppleAccountOption: Bool {
        AppleFinanceKitAvailability.isSupportedOSVersion && !viewModel.isDemoMode
    }

    private func institutionSyncSubtitle(_ institution: PlaidInstitution) -> String {
        if let message = institution.lastErrorMessage, !message.isEmpty {
            return message
        }
        if let lastSync = institution.lastSuccessfulSyncAt {
            return "Last synced \(DateFormatterProvider.fullDate(lastSync))"
        }
        return "\(institution.accounts.count) connected accounts"
    }

    private func isAppleWalletSyncStale(_ accounts: [ProfileAccount]) -> Bool {
        accounts.contains { $0.syncIsStale == true }
    }

    private func appleWalletSyncSubtitle(for accounts: [ProfileAccount]) -> String {
        let labels = accounts.compactMap(\.lastSynced).filter { !$0.isEmpty }
        if let latest = labels.first {
            return latest
        }
        return "\(accounts.count) connected accounts"
    }
}

private struct FinancialProfileAccountRow: View {
    let account: ProfileAccount
    let investment: ProfileInvestment?
    let onTap: (() -> Void)?

    var body: some View {
        Group {
            if let onTap {
                Button(action: onTap) {
                    accountRowContent
                }
                .buttonStyle(.plain)
            } else {
                accountRowContent
            }
        }
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
        }
    }

    private var accountRowContent: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HStack(alignment: .top, spacing: MoatTheme.Spacing.small) {
                Image(systemName: accountIconName)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.accent)
                    .frame(width: 28, height: 28)
                    .background(MoatTheme.ColorToken.elevatedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text(account.name)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                    Text(account.type)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

                Text(CurrencyFormatter.formatCompact(account.balance))
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .layoutPriority(1)
            }

            HStack(spacing: MoatTheme.Spacing.small) {
                if !account.lastSynced.isEmpty {
                    Text(formatDateString(account.lastSynced))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .frame(minWidth: 0, alignment: .leading)
                }

                Spacer(minLength: 0)

                FinancialProfileStatusBadge(
                    active: account.includedInNetWorth,
                    activeLabel: "Net worth",
                    inactiveLabel: "Excluded"
                )
                .layoutPriority(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 36)

            if let investment {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Investment context")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("Value \(CurrencyFormatter.formatCompact(investment.currentValue)) · Contrib \(CurrencyFormatter.formatCompact(investment.monthlyContribution))/mo · Return \(formatPercent(investment.expectedReturn))")
                        .font(.caption)
                        .fixedSize(horizontal: false, vertical: true)
                    FinancialProfileStatusBadge(
                        active: investment.includeInForecast,
                        activeLabel: "In forecast",
                        inactiveLabel: "Forecast off"
                    )
                }
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 36)
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private var accountIconName: String {
        switch account.type.lowercased() {
        case "depository", "checking", "savings": "banknote.fill"
        case "investment", "brokerage", "401k", "ira", "roth": "chart.line.uptrend.xyaxis"
        case "credit": "creditcard.trianglebadge.exclamationmark"
        case "loan": "building.columns.fill"
        default: "wallet.pass.fill"
        }
    }
}

// MARK: - Assets

private struct FinancialProfileAssetsSection: View {
    let assets: [ProfileAsset]
    let liabilities: [ProfileLiability]
    let policies: [InsurancePolicy]
    let isLoading: Bool
    let onAddRealEstate: () -> Void
    let onAddOtherAsset: () -> Void
    let onEdit: (ProfileAsset) -> Void
    let onRemoveLegacyRealEstate: () -> Void

    @AppStorage("moat:legacy-real-estate-banner-dismissed") private var legacyBannerDismissed = false

    private var legacyAssets: [ProfileAsset] {
        assets.filter(RealEstateAssetSync.isLegacyAsset)
    }

    private var visibleAssets: [ProfileAsset] {
        assets.filter { !RealEstateAssetSync.isLegacyAsset($0) }
    }

    private var showLegacyBanner: Bool {
        !legacyAssets.isEmpty && !legacyBannerDismissed && !isLoading
    }

    var body: some View {
        FinancialProfileSectionCard(
            icon: "house.fill",
            title: "Assets",
            description: "Things you own, including property, vehicles, businesses, and other valuables.",
            isLoading: isLoading
        ) {
            Menu {
                Button(action: onAddRealEstate) {
                    Label("Real estate", systemImage: "house.fill")
                }
                Button(action: onAddOtherAsset) {
                    Label("Other asset", systemImage: "car.fill")
                }
            } label: {
                FinancialProfileSectionActionLabel(title: "Add")
            }
            .buttonStyle(FinancialProfileSectionActionButtonStyle())
        } content: {
            if showLegacyBanner {
                LegacyRealEstateBanner(
                    onRemoveLegacy: onRemoveLegacyRealEstate,
                    onDismiss: { legacyBannerDismissed = true }
                )
            }

            if visibleAssets.isEmpty {
                FinancialProfileEmptyState(
                    icon: "house",
                    title: "No assets",
                    message: "Add property, vehicles, businesses, or other valuables you own."
                )
            } else {
                VStack(spacing: MoatTheme.Spacing.small) {
                    ForEach(visibleAssets) { asset in
                        FinancialProfileClickableItemCard(onTap: { onEdit(asset) }) {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                                HStack(alignment: .top, spacing: MoatTheme.Spacing.small) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(asset.name)
                                            .font(.subheadline.weight(.semibold))
                                            .lineLimit(1)
                                        FinancialProfileAssetTypeLabel(type: asset.type)
                                    }
                                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                                    Text(CurrencyFormatter.formatCompact(asset.estimatedValue))
                                        .font(.subheadline.weight(.semibold))
                                        .lineLimit(1)
                                        .layoutPriority(1)
                                }
                                if let linked = asset.linkedLiability {
                                    Text("Liability: \(linked)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                if let linked = asset.linkedInsurance {
                                    Text("Insurance: \(linked)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                HStack(spacing: MoatTheme.Spacing.small) {
                                    FinancialProfileStatusBadge(active: asset.includeInNetWorth, activeLabel: "Net worth", inactiveLabel: "Excluded")
                                    FinancialProfileStatusBadge(active: asset.includeInForecast, activeLabel: "In forecast", inactiveLabel: "Forecast off")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct LegacyRealEstateBanner: View {
    let onRemoveLegacy: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Real estate added here previously isn't synced with Investments. Re-add using Real estate to get full tracking.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

            HStack(spacing: MoatTheme.Spacing.small) {
                Button("Remove legacy entries", action: onRemoveLegacy)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.warning.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

// MARK: - Liabilities

private struct FinancialProfileLiabilitiesSection: View {
    let liabilities: [ProfileLiability]
    let assets: [ProfileAsset]
    let isLoading: Bool
    let onConnectLiability: () -> Void
    let onAddManualLiability: () -> Void
    let onEdit: (ProfileLiability) -> Void

    var body: some View {
        FinancialProfileSectionCard(
            icon: "creditcard.fill",
            title: "Liabilities",
            description: "Debts and obligations Moat should account for in payoff and forecast modeling.",
            isLoading: isLoading
        ) {
            Menu {
                Button(action: onConnectLiability) {
                    Label("Connect liability", systemImage: "link.badge.plus")
                }
                Button(action: onAddManualLiability) {
                    Label("Add manual liability", systemImage: "square.and.pencil")
                }
            } label: {
                FinancialProfileSectionActionLabel(title: "Add")
            }
            .buttonStyle(FinancialProfileSectionActionButtonStyle())
        } content: {
            if liabilities.isEmpty {
                FinancialProfileEmptyState(
                    icon: "creditcard",
                    title: "No liabilities",
                    message: "Add mortgages, loans, credit cards, and other debts."
                )
            } else {
                VStack(spacing: MoatTheme.Spacing.small) {
                    ForEach(liabilities) { liability in
                        FinancialProfileClickableItemCard(onTap: { onEdit(liability) }) {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                                HStack(alignment: .top, spacing: MoatTheme.Spacing.small) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(liability.name)
                                            .font(.subheadline.weight(.semibold))
                                            .lineLimit(1)
                                        Text(liability.type)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                                    Text(CurrencyFormatter.formatCompact(liability.balance))
                                        .font(.subheadline.weight(.semibold))
                                        .lineLimit(1)
                                        .layoutPriority(1)
                                }
                                Text("Rate \(formatPercent(liability.interestRate)) · Payment \(CurrencyFormatter.formatCompact(liability.monthlyPayment))/mo")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                                if let asset = liability.linkedAsset {
                                    Text("Linked asset: \(asset)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                if let term = liability.loanTermYears {
                                    Text("Term \(term) years")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                } else if let payoff = liability.payoffDate, !payoff.isEmpty {
                                    Text("Payoff \(formatDateString(payoff))")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                HStack(spacing: MoatTheme.Spacing.small) {
                                    FinancialProfileStatusBadge(active: liability.includeInNetWorth, activeLabel: "Net worth", inactiveLabel: "Excluded")
                                    FinancialProfileStatusBadge(active: liability.includeInForecast, activeLabel: "In forecast", inactiveLabel: "Forecast off")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Insurance

private struct FinancialProfileInsuranceSection: View {
    let policies: [InsurancePolicy]
    let isLoading: Bool
    let onAdd: () -> Void
    let onEdit: (InsurancePolicy) -> Void

    var body: some View {
        FinancialProfileSectionCard(
            icon: "shield.checkered",
            title: "Insurance",
            description: "Coverage policies and premiums for property, life, health, and liability. Sensitive claims and full documents belong in Moat Private Desktop.",
            isLoading: isLoading
        ) {
            FinancialProfileSectionActionButton(title: "Add", action: onAdd)
        } content: {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                Label {
                    Text("Store planning-friendly policy details in Moat Cloud. Claims, EOBs, prescriptions, and medical records belong in Moat Private Desktop.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "lock.shield")
                        .foregroundStyle(MoatTheme.ColorToken.warning)
                }
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                .padding(MoatTheme.Spacing.medium)
                .background(MoatTheme.ColorToken.warning.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))

                if policies.isEmpty {
                    FinancialProfileEmptyState(
                        icon: "shield",
                        title: "No insurance policies",
                        message: "Add auto, home, life, or other coverage policies."
                    )
                } else {
                    VStack(spacing: MoatTheme.Spacing.small) {
                        ForEach(policies) { policy in
                            FinancialProfileClickableItemCard(onTap: { onEdit(policy) }) {
                                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                                    HStack(alignment: .top) {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(policy.displayName)
                                                .font(.subheadline.weight(.semibold))
                                            Text("\(policy.typeLabel) · \(policy.provider)")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if let premium = policy.premium {
                                            Text(CurrencyFormatter.formatCompact(premium))
                                                .font(.subheadline.weight(.semibold))
                                                .lineLimit(1)
                                        }
                                    }
                                    if let coverage = policy.primaryCoverage {
                                        Text("Coverage \(CurrencyFormatter.formatCompact(coverage))")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Taxes

private struct FinancialProfileTaxesSection: View {
    let taxProfile: TaxProfile
    let isLoading: Bool
    let onEdit: () -> Void
    let onOpenTaxes: () -> Void

    var body: some View {
        FinancialProfileSectionCard(
            icon: "doc.text.fill",
            title: "Taxes",
            description: ProductFlags.taxesEnabled
                ? "Planning assumptions for forecasts and retirement. Filing status, self-employment, and rental flags also seed the Taxes workspace."
                : "Planning assumptions for forecasts and retirement.",
            isLoading: isLoading
        ) {
            HStack(spacing: MoatTheme.Spacing.small) {
                if ProductFlags.taxesEnabled {
                    FinancialProfileSectionActionButton(title: "Open Taxes", systemImage: "doc.text", action: onOpenTaxes)
                }
                FinancialProfileSectionActionButton(title: "Edit", systemImage: "pencil", action: onEdit)
            }
        } content: {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
                    FinancialProfileDetailRow(title: "Filing status", value: taxProfile.filingStatus)
                    FinancialProfileDetailRow(title: "Tax year", value: "\(taxProfile.taxYear)")
                    FinancialProfileDetailRow(title: "Deduction strategy", value: taxProfile.deductionStrategy)
                    FinancialProfileDetailRow(title: "Total annual income", value: CurrencyFormatter.formatCompact(taxProfile.totalAnnualIncome))
                    FinancialProfileDetailRow(title: "Taxable income estimate", value: CurrencyFormatter.formatCompact(taxProfile.taxableIncomeEstimate))
                    FinancialProfileDetailRow(title: "Federal bracket", value: taxProfile.estimatedFederalTaxBracket.isEmpty ? "Not set" : taxProfile.estimatedFederalTaxBracket)
                    FinancialProfileDetailRow(title: "State tax rate", value: taxProfile.estimatedStateTaxRate.isEmpty ? "Not set" : taxProfile.estimatedStateTaxRate)
                }

                HStack(spacing: MoatTheme.Spacing.small) {
                    FinancialProfileStatusBadge(active: taxProfile.selfEmployedIncome, activeLabel: "Self-employed", inactiveLabel: "No self-employment")
                    FinancialProfileStatusBadge(active: taxProfile.rentalIncome, activeLabel: "Rental income", inactiveLabel: "No rental income")
                }

                Text("Last updated \(formatDateString(taxProfile.lastUpdated))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Assumptions

private struct FinancialProfileAssumptionsSection: View {
    let assumptions: ForecastAssumptions
    let isLoading: Bool
    let onEdit: () -> Void

    var body: some View {
        FinancialProfileSectionCard(
            icon: "sparkles",
            title: "Assumptions",
            description: "Global forecast behavior that affects projections throughout Moat.",
            isLoading: isLoading
        ) {
            FinancialProfileSectionActionButton(title: "Edit", systemImage: "pencil", action: onEdit)
        } content: {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                Text("These are editable forecast defaults. Scenario-specific overrides can adjust them later.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                financialProfileDetailGrid {
                    FinancialProfileDetailRow(title: "Inflation", value: formatPercent(assumptions.inflationRate))
                    FinancialProfileDetailRow(title: "Income growth", value: formatPercent(assumptions.incomeGrowthRate))
                    FinancialProfileDetailRow(title: "Expense growth", value: formatPercent(assumptions.expenseGrowthRate))
                    FinancialProfileDetailRow(title: "Investment return", value: formatPercent(assumptions.investmentReturnRate))
                    FinancialProfileDetailRow(title: "Real estate appreciation", value: formatPercent(assumptions.realEstateAppreciationRate))
                    FinancialProfileDetailRow(title: "Default cash yield", value: formatPercent(assumptions.defaultCashYield))
                    FinancialProfileDetailRow(title: "Retirement age", value: assumptions.retirementAge.map(String.init) ?? "Not set")
                    FinancialProfileDetailRow(title: "Forecast style", value: assumptions.forecastStyle)
                }

                Text("Last updated \(formatDateString(assumptions.lastUpdated))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Planning Notes

private struct FinancialProfilePlanningNotesSection: View {
    let notes: [PlanningNote]
    let isLoading: Bool
    let onAdd: () -> Void
    let onEdit: (PlanningNote) -> Void

    var body: some View {
        FinancialProfileSectionCard(
            icon: "note.text",
            title: "Planning Notes",
            description: "Unstructured context and preferences Moat can use for personalized assistance.",
            isLoading: isLoading
        ) {
            FinancialProfileSectionActionButton(title: "Add", action: onAdd)
        } content: {
            if notes.isEmpty {
                FinancialProfileEmptyState(
                    icon: "note.text",
                    title: "No planning notes",
                    message: "Add goals, preferences, or context Moat should remember."
                )
            } else {
                VStack(spacing: MoatTheme.Spacing.small) {
                    ForEach(notes) { note in
                        FinancialProfileClickableItemCard(onTap: { onEdit(note) }) {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                                HStack(alignment: .top) {
                                    Text(note.title)
                                        .font(.subheadline.weight(.semibold))
                                    Spacer()
                                    if let tag = note.tag, !tag.isEmpty {
                                        Text(tag)
                                            .font(.caption2.weight(.semibold))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(MoatTheme.ColorToken.accent.opacity(0.12))
                                            .clipShape(Capsule())
                                    }
                                }
                                Text(note.body)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(4)
                                Text("Updated \(formatDateString(note.lastUpdated))")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
    }
}
