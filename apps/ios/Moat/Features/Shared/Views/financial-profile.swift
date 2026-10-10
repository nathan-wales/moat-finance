import SwiftUI

enum FinancialProfileActiveSheet: Identifiable {
    case editProfile
    case editTaxes
    case editAssumptions
    case addPlanningNote
    case editPlanningNote(PlanningNote)
    case addAsset
    case editAsset(ProfileAsset)
    case addRealEstate
    case editRealEstate(RealEstateProperty)
    case addOtherAsset
    case editOtherAsset(ProfileAsset)
    case addLiability
    case editLiability(ProfileLiability)
    case addManualAccount
    case editManualAccount(ProfileAccount)
    case investmentDetail(ProfileAccount)
    case syncedAccountDetail(ProfileAccount)
    case editInvestment(ProfileAccount)
    case hiddenAccounts
    case institutionDetail(PlaidInstitution)
    case addInsurance
    case editInsurance(InsurancePolicy)
    case appleWalletConnect

    var id: String {
        switch self {
        case .editProfile: "edit-profile"
        case .editTaxes: "edit-taxes"
        case .editAssumptions: "edit-assumptions"
        case .addPlanningNote: "add-note"
        case .editPlanningNote(let note): "edit-note-\(note.id)"
        case .addAsset: "add-asset"
        case .editAsset(let asset): "edit-asset-\(asset.id)"
        case .addRealEstate: "add-real-estate"
        case .editRealEstate(let property): "edit-real-estate-\(property.id)"
        case .addOtherAsset: "add-other-asset"
        case .editOtherAsset(let asset): "edit-other-asset-\(asset.id)"
        case .addLiability: "add-liability"
        case .editLiability(let liability): "edit-liability-\(liability.id)"
        case .addManualAccount: "add-account"
        case .editManualAccount(let account): "edit-account-\(account.id)"
        case .investmentDetail(let account): "investment-detail-\(account.id)"
        case .syncedAccountDetail(let account): "synced-account-\(account.id)"
        case .editInvestment(let account): "edit-investment-\(account.id)"
        case .hiddenAccounts: "hidden-accounts"
        case .institutionDetail(let institution): "institution-\(institution.id)"
        case .addInsurance: "add-insurance"
        case .editInsurance(let policy): "edit-insurance-\(policy.id)"
        case .appleWalletConnect: "apple-wallet-connect"
        }
    }
}

struct FinancialProfileView: View {
    @StateObject private var viewModel = FinancialProfileViewModel()
    @State private var activeSheet: FinancialProfileActiveSheet?
    @State private var pendingInvestmentEdit: ProfileAccount?
    @State private var pendingDisconnect: PlaidInstitution?
    @State private var deleteTarget: FinancialProfileDeleteTarget?
    @State private var disconnectCandidate: PlaidInstitution?

    var body: some View {
        ZStack {
            switch viewModel.state {
            case .idle, .loading:
                FinancialProfileLoadingSkeleton()
                    .transition(.opacity)
            case .loaded, .refreshing, .saving:
                loadedContent
                    .transition(.opacity)
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.4), value: profileContentKey)
        .navigationTitle("Financial Profile")
        .overlay {
            if viewModel.isSaving {
                ZStack {
                    Color.black.opacity(0.08).ignoresSafeArea()
                    ProgressView("Saving...")
                        .padding(MoatTheme.Spacing.large)
                        .moatGlass(cornerRadius: MoatTheme.Radius.large)
                }
            }
        }
        .sheet(item: $activeSheet, onDismiss: {
            if let pendingInvestmentEdit {
                self.pendingInvestmentEdit = nil
                activeSheet = .editInvestment(pendingInvestmentEdit)
            } else if let pendingDisconnect {
                self.pendingDisconnect = nil
                disconnectCandidate = pendingDisconnect
            } else {
                Task { await viewModel.refresh() }
            }
        }) { sheet in
            sheetContent(sheet)
        }
        .sheet(item: $disconnectCandidate) { institution in
            FinancialProfileDisconnectInstitutionSheet(
                institution: institution,
                onCancel: { disconnectCandidate = nil },
                onDisconnect: {
                    await viewModel.disconnect(institution)
                    disconnectCandidate = nil
                }
            )
        }
        .sheet(item: actionMessageBinding) { message in
            MoatActionResultSheet(
                title: message.title,
                message: message.message
            ) {
                viewModel.clearActionMessage()
            }
        }
        .confirmationDialog(
            deleteTarget?.message ?? "Delete item?",
            isPresented: Binding(
                get: { deleteTarget != nil },
                set: { if !$0 { deleteTarget = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button(deleteTarget?.confirmLabel ?? "Delete", role: .destructive) {
                if let target = deleteTarget {
                    Task { await confirmDelete(target) }
                }
                deleteTarget = nil
            }
            Button("Cancel", role: .cancel) {
                deleteTarget = nil
            }
        } message: {
            if let target = deleteTarget {
                Text(target.title)
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private var profileContentKey: String {
        switch viewModel.state {
        case .idle, .loading: return "loading"
        case .loaded, .refreshing, .saving: return "loaded"
        case .error: return "error"
        }
    }

    private var actionMessageBinding: Binding<FinancialProfileActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var isLoading: Bool {
        switch viewModel.state {
        case .idle, .loading: true
        default: false
        }
    }

    private var loadedContent: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                Text("Your entire financial profile in one place for easy agentic access.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, MoatTheme.Spacing.small)

                FinancialProfileSectionsStack(
                    viewModel: viewModel,
                    isLoading: isLoading,
                    onEditProfile: { activeSheet = .editProfile },
                    onConnectAccount: { Task { await viewModel.connectWithLink() } },
                    onSyncAppleWallet: { Task { await viewModel.syncAppleWallet() } },
                    onManageAppleWallet: { activeSheet = .appleWalletConnect },
                    onDisconnectAppleWallet: { Task { await viewModel.disconnectAppleWallet() } },
                    onAddManualAccount: { activeSheet = .addManualAccount },
                    onManageHiddenAccounts: { activeSheet = .hiddenAccounts },
                    onInstitutionDetail: { activeSheet = .institutionDetail($0) },
                    onInstitutionSync: { institution in Task { await viewModel.sync(institution) } },
                    onInstitutionReconnect: { institution in Task { await viewModel.reconnectWithLink(for: institution) } },
                    onInstitutionDisconnect: { disconnectCandidate = $0 },
                    onSelectAccount: { account in
                        if isInvestmentAccount(type: account.type) {
                            activeSheet = .investmentDetail(account)
                        } else if viewModel.isSyncedAccount(account) {
                            activeSheet = .syncedAccountDetail(account)
                        } else {
                            activeSheet = .editManualAccount(account)
                        }
                    },
                    onEditManualAccount: { activeSheet = .editManualAccount($0) },
                    onAddRealEstate: { activeSheet = .addRealEstate },
                    onAddOtherAsset: { activeSheet = .addOtherAsset },
                    onEditAsset: { asset in
                        if RealEstateAssetSync.isSyncedAssetId(asset.id) {
                            if let property = viewModel.realEstateProperty(for: asset) {
                                activeSheet = .editRealEstate(property)
                            } else {
                                Task { await viewModel.refreshRealEstateProperties() }
                            }
                            return
                        }
                        activeSheet = .editOtherAsset(asset)
                    },
                    onRemoveLegacyRealEstate: {
                        Task { await viewModel.removeLegacyRealEstateAssets() }
                    },
                    onConnectLiability: { Task { await viewModel.connectWithLink() } },
                    onAddManualLiability: { activeSheet = .addLiability },
                    onEditLiability: { activeSheet = .editLiability($0) },
                    onAddInsurance: { activeSheet = .addInsurance },
                    onEditInsurance: { activeSheet = .editInsurance($0) },
                    onEditTaxes: { activeSheet = .editTaxes },
                    onOpenTaxes: { AppNavigationCoordinator.shared.openTaxes() },
                    onEditAssumptions: { activeSheet = .editAssumptions },
                    onAddPlanningNote: { activeSheet = .addPlanningNote },
                    onEditPlanningNote: { activeSheet = .editPlanningNote($0) }
                )
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.medium)
            .padding(.bottom, 112)
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        }
        .scrollBounceBehaviorIfAvailable()
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }

    @ViewBuilder
    private func sheetContent(_ sheet: FinancialProfileActiveSheet) -> some View {
        switch sheet {
        case .editProfile:
            FinancialProfileEditProfileSheet(
                profile: viewModel.profileData.profile,
                onSave: { record in
                    activeSheet = nil
                    Task { await viewModel.updateProfileRecord(record) }
                },
                onCancel: { activeSheet = nil }
            )
        case .editTaxes:
            FinancialProfileEditTaxesSheet(
                taxProfile: viewModel.profileData.taxProfile,
                onSave: { tax in
                    activeSheet = nil
                    Task { await viewModel.updateTaxProfile(tax) }
                },
                onCancel: { activeSheet = nil }
            )
        case .editAssumptions:
            FinancialProfileEditAssumptionsSheet(
                assumptions: viewModel.profileData.forecastAssumptions,
                onSave: { assumptions in
                    activeSheet = nil
                    Task { await viewModel.updateForecastAssumptions(assumptions) }
                },
                onCancel: { activeSheet = nil }
            )
        case .addPlanningNote:
            FinancialProfilePlanningNoteSheet(
                note: nil,
                onSave: { note in
                    activeSheet = nil
                    Task { await viewModel.upsertPlanningNote(note) }
                },
                onCancel: { activeSheet = nil }
            )
        case .editPlanningNote(let note):
            FinancialProfilePlanningNoteSheet(
                note: note,
                onSave: { updated in
                    activeSheet = nil
                    Task { await viewModel.upsertPlanningNote(updated) }
                },
                onCancel: { activeSheet = nil },
                onDelete: {
                    activeSheet = nil
                    deleteTarget = .note(note)
                }
            )
        case .addRealEstate:
            PropertyIntakeSheet(
                mode: .create,
                mortgageAccounts: viewModel.mortgageAccountCandidates,
                onSave: { values in
                    try await viewModel.saveRealEstate(values: values)
                    activeSheet = nil
                },
                onCancel: { activeSheet = nil },
                onAccountsRefresh: { await viewModel.refresh() }
            )
        case .editRealEstate(let property):
            PropertyIntakeSheet(
                mode: .edit(property),
                mortgageAccounts: viewModel.mortgageAccountCandidates,
                onSave: { values in
                    try await viewModel.saveRealEstate(property: property, values: values)
                    activeSheet = nil
                },
                onCancel: { activeSheet = nil },
                onDelete: {
                    deleteTarget = .realEstate(property)
                },
                onAccountsRefresh: { await viewModel.refresh() }
            )
        case .addOtherAsset:
            FinancialProfileOtherAssetSheet(
                asset: nil,
                assets: viewModel.profileData.assets,
                liabilities: viewModel.profileData.liabilities,
                policies: viewModel.profileData.insurancePolicies,
                onSave: { asset in
                    activeSheet = nil
                    Task { await viewModel.upsertAsset(asset) }
                },
                onCancel: { activeSheet = nil },
                onUpsertLiability: { liability in await viewModel.upsertLiability(liability) },
                onUpsertInsurance: { policy in await viewModel.upsertInsurancePolicy(policy) },
                onAccountsRefresh: { await viewModel.refresh() }
            )
        case .editOtherAsset(let asset):
            FinancialProfileOtherAssetSheet(
                asset: asset,
                assets: viewModel.profileData.assets,
                liabilities: viewModel.profileData.liabilities,
                policies: viewModel.profileData.insurancePolicies,
                onSave: { updated in
                    activeSheet = nil
                    Task { await viewModel.upsertAsset(updated) }
                },
                onCancel: { activeSheet = nil },
                onUpsertLiability: { liability in await viewModel.upsertLiability(liability) },
                onUpsertInsurance: { policy in await viewModel.upsertInsurancePolicy(policy) },
                onDelete: {
                    activeSheet = nil
                    deleteTarget = .asset(asset)
                },
                onAccountsRefresh: { await viewModel.refresh() }
            )
        case .addAsset:
            FinancialProfileAssetSheet(
                asset: nil,
                assets: viewModel.profileData.assets,
                liabilities: viewModel.profileData.liabilities,
                policies: viewModel.profileData.insurancePolicies,
                onSave: { asset in
                    activeSheet = nil
                    Task { await viewModel.upsertAsset(asset) }
                },
                onCancel: { activeSheet = nil },
                onUpsertLiability: { liability in await viewModel.upsertLiability(liability) },
                onUpsertInsurance: { policy in await viewModel.upsertInsurancePolicy(policy) },
                onAccountsRefresh: { await viewModel.refresh() }
            )
        case .editAsset(let asset):
            FinancialProfileAssetSheet(
                asset: asset,
                assets: viewModel.profileData.assets,
                liabilities: viewModel.profileData.liabilities,
                policies: viewModel.profileData.insurancePolicies,
                onSave: { updated in
                    activeSheet = nil
                    Task { await viewModel.upsertAsset(updated) }
                },
                onCancel: { activeSheet = nil },
                onUpsertLiability: { liability in await viewModel.upsertLiability(liability) },
                onUpsertInsurance: { policy in await viewModel.upsertInsurancePolicy(policy) },
                onDelete: {
                    activeSheet = nil
                    deleteTarget = .asset(asset)
                },
                onAccountsRefresh: { await viewModel.refresh() }
            )
        case .addLiability:
            FinancialProfileLiabilitySheet(
                liability: nil,
                assets: viewModel.profileData.assets,
                onSave: { liability in
                    activeSheet = nil
                    Task { await viewModel.upsertLiability(liability) }
                },
                onCancel: { activeSheet = nil }
            )
        case .editLiability(let liability):
            FinancialProfileLiabilitySheet(
                liability: liability,
                assets: viewModel.profileData.assets,
                onSave: { updated in
                    activeSheet = nil
                    Task { await viewModel.upsertLiability(updated) }
                },
                onCancel: { activeSheet = nil },
                onDelete: {
                    activeSheet = nil
                    deleteTarget = .liability(liability)
                }
            )
        case .addManualAccount:
            FinancialProfileManualAccountSheet(
                account: nil,
                onSave: { account, linkedInvestment in
                    activeSheet = nil
                    Task {
                        await viewModel.upsertManualAccount(
                            account,
                            linkedInvestment: linkedInvestment
                        )
                    }
                },
                onCancel: { activeSheet = nil }
            )
        case .editManualAccount(let account):
            FinancialProfileManualAccountSheet(
                account: account,
                linkedInvestment: viewModel.investment(for: account.id),
                onSave: { updated, linkedInvestment in
                    activeSheet = nil
                    Task {
                        await viewModel.upsertManualAccount(
                            updated,
                            linkedInvestment: linkedInvestment
                        )
                    }
                },
                onCancel: { activeSheet = nil },
                onDelete: {
                    activeSheet = nil
                    deleteTarget = .account(account)
                }
            )
        case .investmentDetail(let account):
            InvestmentDetailSheet(
                investment: viewModel.investmentItem(for: account),
                historyAccountId: account.id,
                showsHistory: shouldShowInvestmentHistory(for: account),
                onEdit: {
                    pendingInvestmentEdit = account
                    activeSheet = nil
                }
            )
        case .syncedAccountDetail(let account):
            FinancialProfileSyncedAccountDetailSheet(
                account: account,
                plaidAccount: viewModel.plaidAccount(for: account),
                linkedInvestment: viewModel.investment(for: account.id),
                onSave: { updated, linkedInvestment in
                    activeSheet = nil
                    Task {
                        await viewModel.upsertSyncedAccountPreferences(
                            updated,
                            linkedInvestment: linkedInvestment
                        )
                    }
                },
                onCancel: { activeSheet = nil },
                onSync: {
                    activeSheet = nil
                    if viewModel.isAppleWalletAccount(account) {
                        Task { await viewModel.syncAppleWallet() }
                    } else if let institution = viewModel.institution(for: account) {
                        Task { await viewModel.sync(institution) }
                    }
                },
                onDisconnect: {
                    if viewModel.isAppleWalletAccount(account) {
                        activeSheet = nil
                        Task { await viewModel.disconnectAppleWallet() }
                    } else if let institution = viewModel.institution(for: account) {
                        pendingDisconnect = institution
                        activeSheet = nil
                    } else {
                        activeSheet = nil
                    }
                }
            )
        case .editInvestment(let account):
            FinancialProfileInvestmentSheet(
                account: account,
                investment: viewModel.investment(for: account.id),
                onSave: { updatedAccount, investment in
                    activeSheet = nil
                    Task {
                        await viewModel.upsertInvestment(
                            investment,
                            linkedAccount: updatedAccount
                        )
                    }
                },
                onCancel: { activeSheet = nil }
            )
        case .hiddenAccounts:
            FinancialProfileHiddenAccountsSheet(viewModel: viewModel) {
                activeSheet = nil
            }
        case .institutionDetail(let institution):
            FinancialProfileInstitutionDetailSheet(
                institution: institution,
                onSync: {
                    activeSheet = nil
                    Task { await viewModel.sync(institution) }
                },
                onReconnect: {
                    activeSheet = nil
                    Task { await viewModel.reconnectWithLink(for: institution) }
                },
                onDismiss: { activeSheet = nil }
            )
        case .addInsurance:
            FinancialProfileInsuranceIntakeSheet(
                existingPolicy: nil,
                assets: viewModel.profileData.assets,
                onSave: { policy in
                    activeSheet = nil
                    Task { await viewModel.upsertInsurancePolicy(policy) }
                },
                onCancel: { activeSheet = nil }
            )
        case .editInsurance(let policy):
            FinancialProfileInsuranceIntakeSheet(
                existingPolicy: policy,
                assets: viewModel.profileData.assets,
                onSave: { updated in
                    activeSheet = nil
                    Task { await viewModel.upsertInsurancePolicy(updated) }
                },
                onCancel: { activeSheet = nil },
                onDelete: {
                    activeSheet = nil
                    deleteTarget = .insurance(policy)
                }
            )
        case .appleWalletConnect:
            AppleWalletConnectView()
        }
    }

    private func shouldShowInvestmentHistory(for account: ProfileAccount) -> Bool {
        if account.connectionStatus == "Synced" || account.plaidItemId != nil {
            return true
        }
        if let linked = viewModel.investment(for: account.id) {
            return linked.autoUpdateBalance ?? false
        }
        if account.id.hasPrefix("investment-acct-") {
            let investmentId = String(account.id.dropFirst("investment-acct-".count))
            let linked = viewModel.profileData.investments.first { $0.id == investmentId }
            return linked?.autoUpdateBalance ?? false
        }
        return false
    }

    private func confirmDelete(_ target: FinancialProfileDeleteTarget) async {
        switch target {
        case .asset(let item):
            await viewModel.deleteAsset(assetId: item.id)
        case .liability(let item):
            await viewModel.deleteLiability(liabilityId: item.id)
        case .note(let item):
            await viewModel.deletePlanningNote(noteId: item.id)
        case .account(let item):
            await viewModel.deleteAccount(accountId: item.id)
        case .insurance(let item):
            await viewModel.deleteInsurancePolicy(policyId: item.id)
        case .realEstate(let property):
            await viewModel.deleteRealEstate(propertyId: property.id)
        }
    }
}

#Preview {
    NavigationStack {
        FinancialProfileView()
    }
}
