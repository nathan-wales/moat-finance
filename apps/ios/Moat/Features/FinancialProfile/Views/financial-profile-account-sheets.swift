import SwiftUI

struct FinancialProfileManualAccountSheet: View {
    let account: ProfileAccount?
    let linkedInvestment: ProfileInvestment?
    let onSave: (ProfileAccount, ProfileInvestment?) -> Void
    let onCancel: () -> Void
    let onDelete: (() -> Void)?

    @State private var type: String
    @State private var name: String
    @State private var institution: String
    @State private var balance: String
    @State private var includedInNetWorth: Bool
    @State private var isInvestmentAccountEnabled: Bool
    @State private var monthlyContribution: String
    @State private var expectedReturn: String
    @State private var includeInForecast: Bool
    @State private var autoUpdateBalance: Bool
    @State private var notes: String

    private var isSynced: Bool {
        guard let account else { return false }
        return account.connectionStatus == "Synced" || account.plaidItemId != nil
    }

    private var accountTypeOptions: [String] {
        var options = FinancialProfileFieldOptions.accountTypes
        if !options.contains(type) {
            options.insert(type, at: 0)
        }
        return options
    }

    init(
        account: ProfileAccount?,
        linkedInvestment: ProfileInvestment? = nil,
        onSave: @escaping (ProfileAccount, ProfileInvestment?) -> Void,
        onCancel: @escaping () -> Void,
        onDelete: (() -> Void)? = nil
    ) {
        self.account = account
        self.linkedInvestment = linkedInvestment
        self.onSave = onSave
        self.onCancel = onCancel
        self.onDelete = onDelete
        let initialType = account?.type ?? "Checking"
        _type = State(initialValue: initialType)
        _name = State(initialValue: account?.name ?? "")
        _institution = State(initialValue: account?.institution ?? "")
        _balance = State(initialValue: account.map { AmountInputFormatter.format($0.balance) } ?? "")
        _includedInNetWorth = State(initialValue: account?.includedInNetWorth ?? true)
        _isInvestmentAccountEnabled = State(
            initialValue: linkedInvestment != nil || isInvestmentAccount(type: initialType)
        )
        _monthlyContribution = State(
            initialValue: linkedInvestment.map { AmountInputFormatter.format($0.monthlyContribution) } ?? ""
        )
        _expectedReturn = State(
            initialValue: linkedInvestment.map { formatPercentInput($0.expectedReturn) } ?? ""
        )
        _includeInForecast = State(initialValue: linkedInvestment?.includeInForecast ?? true)
        _autoUpdateBalance = State(initialValue: linkedInvestment?.autoUpdateBalance ?? true)
        _notes = State(initialValue: linkedInvestment?.notes ?? account?.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Account details") {
                    FinancialProfileLabeledPicker(
                        title: "Type",
                        helpMessage: "The category of account, such as checking, savings, or investment.",
                        selection: $type,
                        selectionTitle: type,
                        selectionSystemImage: accountTypeSystemImage(for: type)
                    ) {
                        ForEach(accountTypeOptions, id: \.self) { option in
                            Label(option, systemImage: accountTypeSystemImage(for: option))
                                .tag(option)
                        }
                    }
                    FinancialProfileLabeledTextField(
                        title: "Name",
                        helpMessage: "The display name for this account in your profile.",
                        placeholder: "New account",
                        text: $name
                    )
                    FinancialProfileLabeledTextField(
                        title: "Institution",
                        helpMessage: "The bank or financial institution that holds this account.",
                        placeholder: "Wells Fargo",
                        text: $institution
                    )
                    FinancialProfileLabeledTextField(
                        title: "Balance",
                        helpMessage: "The current balance of this account. Synced accounts update automatically from your institution.",
                        placeholder: "0",
                        text: $balance,
                        keyboardType: .decimalPad,
                        disabled: isSynced,
                        formatsGroupedNumber: true
                    )
                    if isSynced {
                        Text("Synced account balances stay updated from your connected institution.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    FinancialProfileLabeledToggle(
                        title: "Included in net worth",
                        helpMessage: "When enabled, this account's balance is counted in your total net worth.",
                        isOn: $includedInNetWorth
                    )
                    FinancialProfileLabeledToggle(
                        title: "Is investment account",
                        helpMessage: "When enabled, this account is treated as an investment for forecasts, with contribution and return assumptions.",
                        isOn: $isInvestmentAccountEnabled
                    )
                    if isInvestmentAccountEnabled {
                        FinancialProfileLabeledTextField(
                            title: "Monthly contribution",
                            helpMessage: "How much you add to this investment each month. Set to 0 if you are not regularly contributing.",
                            placeholder: "0",
                            text: $monthlyContribution,
                            keyboardType: .decimalPad,
                            formatsGroupedNumber: true
                        )
                        FinancialProfileLabeledTextField(
                            title: "Expected annual return (%)",
                            helpMessage: "The annual rate of return you expect from this investment. A diversified stock portfolio often uses around 7%.",
                            placeholder: "7",
                            text: $expectedReturn,
                            keyboardType: .decimalPad,
                            formatsGroupedNumber: true,
                            fractionDigits: 2
                        )
                        FinancialProfileLabeledToggle(
                            title: "Included in forecast",
                            helpMessage: "When enabled, this investment's growth and contributions are included in your financial forecast.",
                            isOn: $includeInForecast
                        )
                        if !isSynced {
                            FinancialProfileLabeledToggle(
                                title: "Auto-update my balance every month",
                                helpMessage: "Keeps this manual account up to date as if it were synced. On the monthly anniversary, Moat adds your contribution and expected return to the balance. Turn off to keep the balance fixed until you edit it.",
                                isOn: $autoUpdateBalance
                            )
                        }
                    }
                    FinancialProfileLabeledTextEditor(
                        title: "Notes",
                        helpMessage: "Optional freeform notes about this account.",
                        text: $notes,
                        minHeight: 96
                    )
                }

                if let onDelete {
                    FinancialProfileSheetDeleteSection(action: onDelete)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(account == nil ? "Add Account" : "Edit Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        save()
                    }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
        .onChange(of: isInvestmentAccountEnabled) { isOn in
            guard isOn, !isInvestmentAccount(type: type) else { return }
            type = "Investment"
        }
    }

    private func save() {
        let accountId = account?.id ?? newId("account")
        let resolvedBalance = isSynced
            ? (account?.balance ?? 0)
            : (AmountInputFormatter.parse(balance) ?? 0)
        var resolvedType = type
        if isInvestmentAccountEnabled, !isInvestmentAccount(type: resolvedType) {
            resolvedType = "Investment"
        }
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedNotes = trimmedNotes.isEmpty ? nil : trimmedNotes

        let savedAccount = ProfileAccount(
            id: accountId,
            name: name,
            institution: institution,
            type: resolvedType,
            balance: resolvedBalance,
            connectionStatus: account?.connectionStatus ?? "Manual",
            lastSynced: account?.lastSynced ?? "Manual",
            syncIsStale: account?.syncIsStale,
            includedInNetWorth: includedInNetWorth,
            hidden: account?.hidden,
            plaidItemId: account?.plaidItemId,
            notes: resolvedNotes
        )

        guard isInvestmentAccountEnabled else {
            onSave(savedAccount, nil)
            return
        }

        let investment = ProfileInvestment(
            id: linkedInvestment?.id ?? newId("investment"),
            name: name,
            type: resolvedType,
            currentValue: resolvedBalance,
            monthlyContribution: AmountInputFormatter.parse(monthlyContribution) ?? 0,
            expectedReturn: AmountInputFormatter.parse(expectedReturn) ?? 7,
            accountLink: accountId,
            includeInForecast: includeInForecast,
            autoUpdateBalance: isSynced ? false : autoUpdateBalance,
            notes: resolvedNotes
        )
        onSave(savedAccount, investment)
    }
}

struct FinancialProfileInvestmentSheet: View {
    let account: ProfileAccount
    let investment: ProfileInvestment?
    let onSave: (ProfileAccount, ProfileInvestment) -> Void
    let onCancel: () -> Void

    @State private var name: String
    @State private var type: String
    @State private var currentValue: String
    @State private var monthlyContribution: String
    @State private var expectedReturn: String
    @State private var includedInNetWorth: Bool
    @State private var includeInForecast: Bool
    @State private var autoUpdateBalance: Bool
    @State private var notes: String

    init(
        account: ProfileAccount,
        investment: ProfileInvestment?,
        onSave: @escaping (ProfileAccount, ProfileInvestment) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.account = account
        self.investment = investment
        self.onSave = onSave
        self.onCancel = onCancel
        _name = State(initialValue: investment?.name ?? account.name)
        _type = State(initialValue: investment?.type ?? account.type)
        _currentValue = State(initialValue: AmountInputFormatter.format(investment?.currentValue ?? account.balance))
        _monthlyContribution = State(initialValue: AmountInputFormatter.format(investment?.monthlyContribution ?? 0))
        _expectedReturn = State(initialValue: formatPercentInput(investment?.expectedReturn ?? 7))
        _includedInNetWorth = State(initialValue: account.includedInNetWorth)
        _includeInForecast = State(initialValue: investment?.includeInForecast ?? true)
        _autoUpdateBalance = State(initialValue: investment?.autoUpdateBalance ?? true)
        _notes = State(initialValue: investment?.notes ?? account.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    Text(account.name).foregroundStyle(.secondary)
                    Text(account.institution).foregroundStyle(.secondary)
                }
                Section("Investment details") {
                    FinancialProfileLabeledPicker(
                        title: "Type",
                        helpMessage: "The kind of investment account, such as brokerage, retirement, or education savings.",
                        selection: $type,
                        selectionTitle: type,
                        selectionSystemImage: accountTypeSystemImage(for: type)
                    ) {
                        ForEach(FinancialProfileFieldOptions.investmentTypes, id: \.self) { option in
                            Label(option, systemImage: accountTypeSystemImage(for: option))
                                .tag(option)
                        }
                    }
                    FinancialProfileLabeledTextField(
                        title: "Name",
                        helpMessage: "The display name for this investment in your profile and forecasts.",
                        placeholder: "Investment name",
                        text: $name
                    )
                    FinancialProfileLabeledTextField(
                        title: "Current value",
                        helpMessage: "The total balance of this investment today. Moat uses it as the starting point for growth projections.",
                        placeholder: "0",
                        text: $currentValue,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLabeledTextField(
                        title: "Monthly contribution",
                        helpMessage: "How much you add to this investment each month. Set to 0 if you are not regularly contributing.",
                        placeholder: "0",
                        text: $monthlyContribution,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLabeledTextField(
                        title: "Expected return (%)",
                        helpMessage: "The annual rate of return you expect from this investment. A diversified stock portfolio often uses around 7%.",
                        placeholder: "7",
                        text: $expectedReturn,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true,
                        fractionDigits: 2
                    )
                    FinancialProfileLabeledToggle(
                        title: "Included in net worth",
                        helpMessage: "When enabled, this account's balance is counted in your total net worth.",
                        isOn: $includedInNetWorth
                    )
                    FinancialProfileLabeledToggle(
                        title: "Included in forecast",
                        helpMessage: "When enabled, this investment's growth and contributions are included in your financial forecast.",
                        isOn: $includeInForecast
                    )
                    if !isSynced {
                        FinancialProfileLabeledToggle(
                            title: "Auto-update my balance every month",
                            helpMessage: "Keeps this manual account up to date as if it were synced. On the monthly anniversary, Moat adds your contribution and expected return to the balance. Turn off to keep the balance fixed until you edit it.",
                            isOn: $autoUpdateBalance
                        )
                    }
                    FinancialProfileLabeledTextEditor(
                        title: "Notes",
                        helpMessage: "Optional freeform notes about this investment.",
                        text: $notes,
                        minHeight: 96
                    )
                }
            }
            .navigationTitle("Edit Investment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        save()
                    }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
    }

    private var isSynced: Bool {
        account.connectionStatus == "Synced" || account.plaidItemId != nil
    }

    private func save() {
        let resolvedValue = AmountInputFormatter.parse(currentValue) ?? 0
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedNotes = trimmedNotes.isEmpty ? nil : trimmedNotes
        let savedAccount = ProfileAccount(
            id: account.id,
            name: name,
            institution: account.institution,
            type: type,
            balance: isSynced ? account.balance : resolvedValue,
            connectionStatus: account.connectionStatus,
            lastSynced: account.lastSynced,
            syncIsStale: account.syncIsStale,
            includedInNetWorth: includedInNetWorth,
            hidden: account.hidden,
            plaidItemId: account.plaidItemId,
            notes: resolvedNotes
        )
        let savedInvestment = ProfileInvestment(
            id: investment?.id ?? newId("investment"),
            name: name,
            type: type,
            currentValue: resolvedValue,
            monthlyContribution: AmountInputFormatter.parse(monthlyContribution) ?? 0,
            expectedReturn: AmountInputFormatter.parse(expectedReturn) ?? 0,
            accountLink: account.id,
            includeInForecast: includeInForecast,
            autoUpdateBalance: isSynced ? false : autoUpdateBalance,
            notes: resolvedNotes
        )
        onSave(savedAccount, savedInvestment)
    }
}

struct FinancialProfileHiddenAccountsSheet: View {
    @ObservedObject var viewModel: FinancialProfileViewModel
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            List {
                if viewModel.hiddenAccounts.isEmpty {
                    Text("No hidden accounts")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(viewModel.hiddenAccounts) { account in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(account.name).font(.subheadline.weight(.semibold))
                            Text("\(account.institution) · \(CurrencyFormatter.formatCompact(account.balance))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .swipeActions {
                            Button("Show") {
                                Task { await viewModel.unhideAccount(accountId: account.id) }
                            }
                            .tint(MoatTheme.ColorToken.accent)
                        }
                    }
                }
            }
            .navigationTitle("Hidden Accounts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onDismiss)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct FinancialProfileInstitutionDetailSheet: View {
    let institution: PlaidInstitution
    let onSync: () -> Void
    let onReconnect: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        MoatGlassSheet(title: "Institution details") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                HStack(spacing: MoatTheme.Spacing.medium) {
                    Image(systemName: "building.columns.fill")
                        .font(.title2)
                        .foregroundStyle(MoatTheme.ColorToken.accent)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(institution.institutionName).font(.headline)
                        Text("\(institution.accounts.count) linked accounts")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                financialProfileDetailGrid {
                    FinancialProfileDetailRow(title: "Balance", value: CurrencyFormatter.format(institution.balance))
                    FinancialProfileDetailRow(title: "Sync status", value: institution.syncAccessStatus ?? "ACTIVE")
                    FinancialProfileDetailRow(
                        title: "Last sync",
                        value: institution.lastSuccessfulSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet"
                    )
                    FinancialProfileDetailRow(
                        title: "Connected",
                        value: institution.createdAt.map(DateFormatterProvider.fullDate) ?? "Unknown"
                    )
                }

                if institution.requiresReconnect {
                    Label("This institution needs to be reconnected.", systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.warning)
                }
            }
        } footer: {
            VStack(spacing: MoatTheme.Spacing.medium) {
                MoatSheetActionBar {
                    Button(action: onSync) {
                        Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)

                    Button(action: onReconnect) {
                        Label("Reconnect", systemImage: "link")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)
                }

                Button("Done", action: onDismiss)
                    .buttonStyle(.moatSecondary)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

struct FinancialProfileDisconnectInstitutionSheet: View {
    let institution: PlaidInstitution
    let onCancel: () -> Void
    let onDisconnect: () async -> Void

    @State private var isWorking = false

    var body: some View {
        MoatGlassSheet(title: "Remove connection") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                HStack(spacing: MoatTheme.Spacing.medium) {
                    Image(systemName: "link.badge.minus")
                        .font(.title2)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(institution.institutionName).font(.headline)
                        Text("\(institution.accounts.count) linked accounts")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Text("This permanently disconnects \(institution.institutionName) from Moat, revokes Plaid access, and removes all synced accounts and data for this connection. This cannot be undone.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        } footer: {
            MoatSheetActionBar {
                Button(action: onCancel) {
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
                        Label("Remove", systemImage: "trash")
                            .frame(maxWidth: .infinity)
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

struct FinancialProfileSyncedAccountDetailSheet: View {
    let account: ProfileAccount
    let plaidAccount: PlaidAccount?
    let linkedInvestment: ProfileInvestment?
    let onSave: (ProfileAccount, ProfileInvestment?) -> Void
    let onCancel: () -> Void
    let onSync: () -> Void
    let onDisconnect: () -> Void

    @State private var includedInNetWorth: Bool
    @State private var notes: String

    init(
        account: ProfileAccount,
        plaidAccount: PlaidAccount?,
        linkedInvestment: ProfileInvestment?,
        onSave: @escaping (ProfileAccount, ProfileInvestment?) -> Void,
        onCancel: @escaping () -> Void,
        onSync: @escaping () -> Void,
        onDisconnect: @escaping () -> Void
    ) {
        self.account = account
        self.plaidAccount = plaidAccount
        self.linkedInvestment = linkedInvestment
        self.onSave = onSave
        self.onCancel = onCancel
        self.onSync = onSync
        self.onDisconnect = onDisconnect
        _includedInNetWorth = State(initialValue: account.includedInNetWorth)
        _notes = State(
            initialValue: linkedInvestment?.notes ?? account.notes ?? plaidAccount?.notes ?? ""
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    AccountHistoryChartView(
                        accountId: account.id,
                        fallbackBalance: account.balance
                    )

                    HStack(spacing: MoatTheme.Spacing.medium) {
                        Image(systemName: accountIconName)
                            .font(.title2)
                            .foregroundStyle(MoatTheme.ColorToken.accent)
                            .frame(width: 46, height: 46)
                            .background(MoatTheme.ColorToken.accent.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))

                        VStack(alignment: .leading, spacing: 3) {
                            Text(account.type)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(account.institution)
                                .font(.headline)
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }
                    }

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                        Text("Account details")
                            .font(.headline)
                        DetailLine(title: "Institution", value: account.institution)
                        DetailLine(title: "Type", value: plaidAccount?.displayType ?? account.type)
                        DetailLine(
                            title: "Mask",
                            value: plaidAccount?.mask.map { "...\($0)" } ?? "Not reported"
                        )
                        DetailLine(title: "Status", value: account.connectionStatus)
                        DetailLine(
                            title: "Last balance sync",
                            value: lastSyncLabel
                        )
                        FinancialProfileLabeledToggle(
                            title: "Included in net worth",
                            helpMessage: "When enabled, this account's balance is counted in your total net worth.",
                            isOn: $includedInNetWorth
                        )
                    }
                    .padding(MoatTheme.Spacing.medium)
                    .background(MoatTheme.ColorToken.surface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        Text("Notes")
                            .font(.subheadline.weight(.semibold))
                        MoatTextEditor(text: $notes, minHeight: 96)
                    }

                    MoatSheetActionBar {
                        Button(action: onSync) {
                            Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.moatSecondary)

                        Button(role: .destructive, action: onDisconnect) {
                            Label("Disconnect", systemImage: "link.badge.minus")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.moatDestructive)
                    }
                }
                .padding(.horizontal, MoatTheme.Spacing.large)
                .padding(.top, MoatTheme.Spacing.medium)
                .padding(.bottom, MoatTheme.Spacing.xLarge)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(MoatTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(account.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        save()
                    }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func save() {
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedNotes = trimmedNotes.isEmpty ? nil : trimmedNotes
        var savedAccount = account
        savedAccount.includedInNetWorth = includedInNetWorth
        savedAccount.notes = resolvedNotes

        guard var investment = linkedInvestment else {
            onSave(savedAccount, nil)
            return
        }
        investment.notes = resolvedNotes
        onSave(savedAccount, investment)
    }

    private var lastSyncLabel: String {
        if let date = plaidAccount?.lastBalanceSyncAt {
            return DateFormatterProvider.fullDate(date)
        }
        let trimmed = account.lastSynced.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return "Not synced yet"
        }
        return formatDateString(trimmed)
    }

    private var accountIconName: String {
        accountTypeSystemImage(for: account.type)
    }
}

struct FinancialProfileDeleteAccountConfirmation: View {
    let accountName: String
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        MoatGlassSheet(title: "Delete account") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Text("Delete \(accountName)? This removes it from your financial profile.")
                    .foregroundStyle(.secondary)
            }
        } footer: {
            MoatSheetActionBar {
                Button("Cancel", action: onCancel)
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                Button(role: .destructive, action: onConfirm) {
                    Label("Delete", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatDestructive)
            }
        }
    }
}

enum FinancialProfileDeleteTarget: Identifiable {
    case asset(ProfileAsset)
    case liability(ProfileLiability)
    case note(PlanningNote)
    case account(ProfileAccount)
    case insurance(InsurancePolicy)
    case realEstate(RealEstateProperty)

    var id: String {
        switch self {
        case .asset(let item): "asset-\(item.id)"
        case .liability(let item): "liability-\(item.id)"
        case .note(let item): "note-\(item.id)"
        case .account(let item): "account-\(item.id)"
        case .insurance(let item): "insurance-\(item.id)"
        case .realEstate(let item): "real-estate-\(item.id)"
        }
    }

    var title: String {
        switch self {
        case .asset(let item): item.name
        case .liability(let item): item.name
        case .note(let item): item.title
        case .account(let item): item.name
        case .insurance(let item): item.displayName
        case .realEstate(let item): item.name
        }
    }

    var confirmLabel: String {
        switch self {
        case .account(let item) where item.connectionStatus == "Synced" || item.plaidItemId != nil:
            return "Disconnect"
        default:
            return "Delete"
        }
    }

    var message: String {
        switch self {
        case .asset: "Delete this asset?"
        case .liability: "Delete this liability?"
        case .note: "Delete this planning note?"
        case .account(let item):
            if item.connectionStatus == "Synced" || item.plaidItemId != nil {
                "This stops sync for this account only. Other accounts at the same institution stay connected. Your current paid period does not drop."
            } else {
                "Delete this account from your profile?"
            }
        case .insurance: "Delete this insurance policy?"
        case .realEstate: "Delete this property?"
        }
    }
}
