import SwiftUI

struct AccountsView: View {
    @StateObject private var viewModel = AccountsViewModel()
    @State private var selectedInstitution: PlaidInstitution?
    @State private var selectedAccount: PlaidAccount?
    @State private var disconnectCandidate: PlaidInstitution?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading accounts...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Accounts")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        Task { await viewModel.connectWithLink() }
                    } label: {
                        Label("Connect account", systemImage: "link.badge.plus")
                    }

                    Button {
                        Task { await viewModel.syncAll() }
                    } label: {
                        Label("Sync all", systemImage: "arrow.triangle.2.circlepath")
                    }

                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                } label: {
                    MoatMoreMenuIcon()
                }
            }
        }
        .sheet(item: actionMessageBinding) { message in
            MoatActionResultSheet(
                title: message.title,
                message: message.message
            ) {
                viewModel.clearActionMessage()
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private var actionMessageBinding: Binding<AccountsActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                AccountsSummaryCard(
                    totalBalance: viewModel.totalBalance,
                    institutionCount: viewModel.institutions.count,
                    accountCount: viewModel.accountCount,
                    reconnectCount: viewModel.reconnectCount,
                    isDemoMode: viewModel.isDemoMode
                )

                if viewModel.institutions.isEmpty {
                    emptyAccounts
                } else {
                    VStack(spacing: MoatTheme.Spacing.medium) {
                        ForEach(viewModel.institutions) { institution in
                            InstitutionCard(
                                institution: institution,
                                onShowDetails: { selectedInstitution = institution },
                                onSync: { Task { await viewModel.sync(institution) } },
                                onReconnect: { Task { await viewModel.reconnectWithLink(for: institution) } },
                                onMarkReconnected: { Task { await viewModel.reconnect(institution) } },
                                onDisconnect: { disconnectCandidate = institution },
                                onShowAccountDetails: { selectedAccount = $0 },
                                onToggleAccountHidden: { account, hidden in
                                    Task { await viewModel.setHidden(account, hidden: hidden) }
                                },
                                onResumeAccountSync: { account in
                                    Task { await viewModel.setSyncEnabled(account, syncEnabled: true) }
                                }
                            )
                        }
                    }
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
        .sheet(item: $selectedInstitution) { institution in
            InstitutionDetailSheet(institution: institution)
        }
        .sheet(item: $selectedAccount) { account in
            AccountDetailSheet(account: account)
        }
        .sheet(item: $disconnectCandidate) { institution in
            DisconnectInstitutionSheet(
                institution: institution,
                onCancel: { disconnectCandidate = nil },
                onDisconnect: {
                    await viewModel.disconnect(institution)
                    disconnectCandidate = nil
                }
            )
        }
    }

    private var emptyAccounts: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "building.columns")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No connected institutions")
                .font(.headline)
            Text("Connect your bank to start syncing balances, transactions, and investment accounts.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.connectWithLink() }
            } label: {
                Label("Connect account", systemImage: "link.badge.plus")
            }
            .buttonStyle(.moatPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xxLarge)
    }
}

private struct AccountsSummaryCard: View {
    let totalBalance: Double
    let institutionCount: Int
    let accountCount: Int
    let reconnectCount: Int
    let isDemoMode: Bool

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                if isDemoMode {
                    Label("Demo data", systemImage: "sparkles")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.accent)
                }

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Connected balance")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.formatCompact(totalBalance))
                        .font(.largeTitle.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                HStack {
                    AccountsMetric(title: "Institutions", value: "\(institutionCount)", systemImage: "building.columns.fill")
                    AccountsMetric(title: "Accounts", value: "\(accountCount)", systemImage: "creditcard.fill")
                    AccountsMetric(title: "Reconnect", value: "\(reconnectCount)", systemImage: "exclamationmark.arrow.triangle.2.circlepath")
                }
            }
        }
    }
}

private struct AccountsMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Image(systemName: systemImage)
                .foregroundStyle(MoatTheme.ColorToken.accent)
            Text(value)
                .font(.headline)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct InstitutionCard: View {
    let institution: PlaidInstitution
    let onShowDetails: () -> Void
    let onSync: () -> Void
    let onReconnect: () -> Void
    let onMarkReconnected: () -> Void
    let onDisconnect: () -> Void
    let onShowAccountDetails: (PlaidAccount) -> Void
    let onToggleAccountHidden: (PlaidAccount, Bool) -> Void
    let onResumeAccountSync: (PlaidAccount) -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        Text(institution.institutionName)
                            .font(.headline)
                        Text(syncSubtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    if institution.requiresReconnect {
                        Text("Reconnect")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MoatTheme.ColorToken.warning)
                            .padding(.horizontal, MoatTheme.Spacing.small)
                            .padding(.vertical, MoatTheme.Spacing.xSmall)
                            .background(MoatTheme.ColorToken.warning.opacity(0.12))
                            .clipShape(Capsule())
                    }

                    Menu {
                        Button(action: onShowDetails) {
                            Label("Details", systemImage: "info.circle")
                        }
                        Button(action: onSync) {
                            Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                        }
                        Button(action: onReconnect) {
                            Label("Reconnect", systemImage: "link")
                        }
                        Button(action: onMarkReconnected) {
                            Label("Mark reconnected", systemImage: "arrow.triangle.2.circlepath")
                        }
                        Divider()
                        Button(role: .destructive, action: onDisconnect) {
                            Label("Disconnect", systemImage: "xmark")
                        }
                    } label: {
                        MoatMoreMenuIcon()
                    }
                }

                VStack(spacing: MoatTheme.Spacing.small) {
                    ForEach(institution.accounts) { account in
                        AccountRow(
                            account: account,
                            onShowDetails: { onShowAccountDetails(account) },
                            onToggleHidden: { onToggleAccountHidden(account, !(account.accountHidden ?? false)) },
                            onResumeSync: { onResumeAccountSync(account) }
                        )
                    }
                }
            }
        }
    }

    private var syncSubtitle: String {
        if let message = institution.lastErrorMessage, !message.isEmpty {
            return message
        }

        if let lastSuccessfulSyncAt = institution.lastSuccessfulSyncAt {
            return "Last synced \(DateFormatterProvider.fullDate(lastSuccessfulSyncAt))"
        }

        return "\(institution.accounts.count) accounts"
    }
}

private struct AccountRow: View {
    let account: PlaidAccount
    let onShowDetails: () -> Void
    let onToggleHidden: () -> Void
    let onResumeSync: () -> Void

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: iconName)
                .foregroundStyle(account.accountHidden == true ? MoatTheme.ColorToken.textSecondary : MoatTheme.ColorToken.accent)
                .frame(width: 34, height: 34)
                .background(MoatTheme.ColorToken.elevatedSurface)
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(account.displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    if !account.isSyncEnabled {
                        Text("Sync off")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(MoatTheme.ColorToken.elevatedSurface)
                            .clipShape(Capsule())
                    }
                }
                Text([account.displayType, account.mask.map { "••\($0)" }].compactMap { $0 }.joined(separator: " - "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(CurrencyFormatter.formatCompact(account.currentBalance ?? account.availableBalance ?? 0))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                HStack(spacing: 6) {
                    Button(action: onShowDetails) {
                        Image(systemName: "info.circle")
                            .font(.caption)
                    }

                    Button(action: onToggleHidden) {
                        Image(systemName: account.accountHidden == true ? "eye.slash" : "eye")
                            .font(.caption)
                    }

                    if !account.isSyncEnabled {
                        Button("Resume", action: onResumeSync)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.mini)
            }
        }
        .opacity(account.accountHidden == true ? 0.55 : 1)
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }

    private var iconName: String {
        switch account.type.lowercased() {
        case "depository": "creditcard.fill"
        case "investment": "chart.line.uptrend.xyaxis"
        case "credit": "creditcard.trianglebadge.exclamationmark"
        case "loan": "building.columns.fill"
        default: "wallet.pass.fill"
        }
    }
}

private struct InstitutionDetailSheet: View {
    let institution: PlaidInstitution

    var body: some View {
        MoatGlassSheet(title: "Institution details") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                detailHeader(title: institution.institutionName, subtitle: institution.institutionId ?? "Connected institution", systemImage: "building.columns.fill")

                detailGrid {
                    DetailRow(title: "Accounts", value: "\(institution.accounts.count)")
                    DetailRow(title: "Active accounts", value: "\(institution.activeAccounts.count)")
                    DetailRow(title: "Balance", value: CurrencyFormatter.format(institution.balance))
                    DetailRow(title: "Sync status", value: institution.syncAccessStatus ?? "ACTIVE")
                    DetailRow(title: "Last sync", value: institution.lastSuccessfulSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet")
                    DetailRow(title: "Connected", value: institution.createdAt.map(DateFormatterProvider.fullDate) ?? "Unknown")
                }

                if let error = institution.lastErrorMessage, !error.isEmpty {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.warning)
                }
            }
        }
    }
}

private struct AccountDetailSheet: View {
    let account: PlaidAccount

    var body: some View {
        MoatGlassSheet(title: "Account details") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                detailHeader(title: account.displayName, subtitle: account.displayType, systemImage: "creditcard.fill")

                detailGrid {
                    DetailRow(title: "Current balance", value: CurrencyFormatter.format(account.currentBalance ?? 0))
                    DetailRow(title: "Available", value: account.availableBalance.map(CurrencyFormatter.format) ?? "Not reported")
                    DetailRow(title: "Currency", value: account.currency ?? "USD")
                    DetailRow(title: "Mask", value: account.mask.map { "••\($0)" } ?? "Not reported")
                    DetailRow(title: "Hidden", value: account.accountHidden == true ? "Yes" : "No")
                    DetailRow(title: "Sync", value: account.isSyncEnabled ? "On" : "Off")
                    DetailRow(title: "Last balance sync", value: account.lastBalanceSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet")
                }

                if let notes = account.notes?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !notes.isEmpty {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        Text("Notes")
                            .font(.subheadline.weight(.semibold))
                        Text(notes)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(MoatTheme.Spacing.medium)
                    .background(MoatTheme.ColorToken.surface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                }
            }
        }
    }
}

private struct DisconnectInstitutionSheet: View {
    let institution: PlaidInstitution
    let onCancel: () -> Void
    let onDisconnect: () async -> Void

    @State private var isWorking = false

    var body: some View {
        MoatGlassSheet(title: "Disconnect institution") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                detailHeader(title: institution.institutionName, subtitle: "\(institution.accounts.count) linked accounts", systemImage: "xmark")
                Text("This removes the Plaid connection and stops future syncs. Existing transactions and balances stay in Moat unless you delete them separately.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        } footer: {
            MoatSheetActionBar {
                Button {
                    onCancel()
                } label: {
                    Text("Cancel").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
                .disabled(isWorking)

                Button(role: .destructive) {
                    Task { await disconnect() }
                } label: {
                    if isWorking {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Disconnect", systemImage: "xmark").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.moatDestructive)
                .disabled(isWorking)
            }
        }
    }

    private func disconnect() async {
        isWorking = true
        defer { isWorking = false }
        await onDisconnect()
    }
}

private struct DetailRow: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private func detailHeader(title: String, subtitle: String, systemImage: String) -> some View {
    HStack(spacing: MoatTheme.Spacing.medium) {
        Image(systemName: systemImage)
            .font(.title2)
            .foregroundStyle(MoatTheme.ColorToken.accent)
            .frame(width: 44, height: 44)
            .background(MoatTheme.ColorToken.accent.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))

        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.headline)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

private func detailGrid<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
        content()
    }
    .padding(MoatTheme.Spacing.medium)
    .background(MoatTheme.ColorToken.surface)
    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
}

#Preview {
    NavigationStack {
        AccountsView()
    }
}
