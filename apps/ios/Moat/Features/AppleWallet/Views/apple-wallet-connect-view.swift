import SwiftUI

struct AppleWalletConnectView: View {
    @SwiftUI.Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = AppleWalletConnectViewModel()
    var onConnected: (() -> Void)?

    init(onConnected: (() -> Void)? = nil) {
        self.onConnected = onConnected
    }

    var body: some View {
        MoatGlassSheet(
            title: "Apple Wallet",
            showsCloseButton: true,
            includesFooter: hasFooter,
            verticallyCentersContent: centersProgressContent
        ) {
            if centersProgressContent {
                content
            } else {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    content
                }
            }
        } footer: {
            footerContent
        }
        .task {
            FinanceKitDiagnostics.logSnapshot(operation: "apple_wallet_connect_view_appeared")
            await viewModel.prepare()
        }
    }

    private var hasFooter: Bool {
        switch viewModel.phase {
        case .notStarted, .explaining, .permissionDenied, .permissionRevoked, .selectingAccounts,
             .partialFailure, .success, .failure:
            return true
        case .unsupported, .notAvailable, .requestingPermission, .noEligibleAccounts, .syncing:
            return false
        }
    }

    private var centersProgressContent: Bool {
        switch viewModel.phase {
        case .requestingPermission, .syncing:
            return true
        default:
            return false
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .unsupported:
            statusCard(
                icon: "exclamationmark.triangle.fill",
                title: "Unsupported device",
                message: "Apple Wallet sync requires iOS 17.4 or later on a supported device."
            )
        case .notAvailable:
            statusCard(
                icon: "wallet.pass",
                title: "Apple Wallet unavailable",
                message: "FinanceKit is not available on this device right now."
            )
        case .notStarted, .explaining:
            explanationSection
        case .requestingPermission:
            progressCard(title: "Requesting access", message: "Waiting for Apple Wallet permission…")
        case .permissionDenied:
            statusCard(
                icon: "hand.raised.fill",
                title: "Permission denied",
                message: "Moat Finance cannot import Apple Wallet data without your permission. You can retry from Settings if you change your mind."
            )
        case .permissionRevoked:
            statusCard(
                icon: "arrow.clockwise",
                title: "Permission revoked",
                message: "Apple Wallet access was revoked. Reconnect to resume syncing."
            )
        case .noEligibleAccounts:
            statusCard(
                icon: "tray",
                title: "No eligible accounts",
                message: "Apple Wallet did not return any supported accounts for import."
            )
        case .selectingAccounts:
            accountSelectionSection
        case .syncing:
            progressCard(title: "Syncing Apple Wallet", message: "Importing selected accounts, balances, and transactions…")
        case .partialFailure(let details):
            statusCard(
                icon: "exclamationmark",
                title: "Partial sync",
                message: "Some data imported, but parts of the sync failed: \(details)."
            )
        case .success:
            statusCard(
                icon: "checkmark",
                title: "Apple Wallet connected",
                message: "Your selected Apple Wallet accounts are now available in Moat Finance."
            )
        case .failure(let message):
            statusCard(
                icon: "xmark",
                title: "Sync failed",
                message: message
            )
        }
    }

    @ViewBuilder
    private var footerContent: some View {
        switch viewModel.phase {
        case .notStarted, .explaining:
            Button {
                Task { await viewModel.requestPermissionAndLoadAccounts() }
            } label: {
                Label("Connect Apple Wallet", systemImage: "link.badge.plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
            .disabled(viewModel.isBusy)
        case .permissionDenied:
            Button("Try again") {
                Task { await viewModel.requestPermissionAndLoadAccounts() }
            }
            .buttonStyle(.moatPrimary)
            .frame(maxWidth: .infinity)
        case .permissionRevoked:
            Button("Reconnect") {
                viewModel.beginConnectFlow()
            }
            .buttonStyle(.moatPrimary)
            .frame(maxWidth: .infinity)
        case .selectingAccounts:
            Button {
                Task { await viewModel.runInitialSync() }
            } label: {
                Label("Import selected accounts", systemImage: "arrow.down")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
            .disabled(viewModel.isBusy || viewModel.selectedAccountIds.isEmpty)
        case .partialFailure:
            Button("Retry") {
                Task { await viewModel.runInitialSync() }
            }
            .buttonStyle(.moatPrimary)
            .frame(maxWidth: .infinity)
        case .success:
            Button("Done") {
                onConnected?()
                dismiss()
            }
            .buttonStyle(.moatPrimary)
            .frame(maxWidth: .infinity)
        case .failure:
            Button("Retry") {
                Task { await viewModel.runInitialSync() }
            }
            .buttonStyle(.moatPrimary)
            .frame(maxWidth: .infinity)
        default:
            EmptyView()
        }
    }

    private var explanationSection: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Label("Connect Apple Wallet", systemImage: "wallet.pass.fill")
                .font(.title2.weight(.semibold))

            Text("Moat Finance can import supported Wallet financial accounts such as Apple Card, Apple Cash, and Savings with Apple.")
            Text("Data may include account names, balances, and transactions. Access requires your explicit permission, and you can revoke access later.")
            Text("Imported data is used only to power your personal finance dashboard and related financial management features.")

            if let status = viewModel.connectedStatus, status.connected {
                connectedAccountsSection(status)
            }
        }
    }

    private var accountSelectionSection: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Select accounts to import")
                .font(.headline)

            ForEach(viewModel.eligibleAccounts) { account in
                Button {
                    viewModel.toggleAccountSelection(account.externalAccountId)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                            Text(account.displayName)
                                .font(.body.weight(.semibold))
                            Text(account.accountSubtype?.replacingOccurrences(of: "_", with: " ").capitalized ?? account.accountType.capitalized)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: viewModel.selectedAccountIds.contains(account.externalAccountId) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(viewModel.selectedAccountIds.contains(account.externalAccountId) ? MoatTheme.ColorToken.accent : .secondary)
                    }
                    .padding(MoatTheme.Spacing.medium)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: MoatTheme.Radius.medium))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func connectedAccountsSection(_ status: AppleWalletStatusResponse) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            Text("Connected accounts")
                .font(.headline)

            ForEach(status.accounts.filter { $0.status == "ACTIVE" }) { account in
                HStack {
                    VStack(alignment: .leading) {
                        Text(account.displayName)
                        if let lastSyncedAt = account.lastSyncedAt {
                            Text("Last synced \(DateFormatterProvider.fullDate(lastSyncedAt))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                }
            }

            HStack {
                Button("Sync now") {
                    Task { await viewModel.resyncConnectedAccounts() }
                }
                .buttonStyle(.moatSecondary)

                Button("Disconnect", role: .destructive) {
                    Task { await viewModel.disconnect(deleteImportedTransactions: false) }
                }
                .buttonStyle(.moatDestructive)
            }
        }
        .padding(.top, MoatTheme.Spacing.small)
    }

    @ViewBuilder
    private func statusCard(
        icon: String,
        title: String,
        message: String
    ) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Label(title, systemImage: icon)
                .font(.title3.weight(.semibold))
            Text(message)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func progressCard(title: String, message: String) -> some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            ProgressView()
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }
}

#Preview {
    AppleWalletConnectView()
}
