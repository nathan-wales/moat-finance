import SwiftUI

enum PropertyIntakeMode: Identifiable {
    case create
    case edit(RealEstateProperty)

    var id: String {
        switch self {
        case .create: "create-property"
        case .edit(let property): property.id
        }
    }

    var property: RealEstateProperty? {
        if case .edit(let property) = self { return property }
        return nil
    }
}

struct PropertyIntakeSheet: View {
    let mode: PropertyIntakeMode
    let mortgageAccounts: [LinkedPlaidAccountSummary]
    let onSave: (RealEstateFormValues) async throws -> Void
    let onCancel: () -> Void
    let onDelete: (() -> Void)?
    let onAccountsRefresh: (() async -> Void)?

    @State private var step: RealEstateIntakeStep
    @State private var values: RealEstateFormValues
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var accountIdsBeforeConnect: Set<String> = []
    @State private var isAwaitingConnectedAccounts = false
    @State private var isConnectingAccount = false

    init(
        mode: PropertyIntakeMode,
        mortgageAccounts: [LinkedPlaidAccountSummary],
        onSave: @escaping (RealEstateFormValues) async throws -> Void,
        onCancel: @escaping () -> Void,
        onDelete: (() -> Void)? = nil,
        onAccountsRefresh: (() async -> Void)? = nil
    ) {
        self.mode = mode
        self.mortgageAccounts = mortgageAccounts
        self.onSave = onSave
        self.onCancel = onCancel
        self.onDelete = onDelete
        self.onAccountsRefresh = onAccountsRefresh
        _values = State(
            initialValue: mode.property.map(realEstateFormValues(from:)) ?? createEmptyRealEstateFormValues()
        )
        _step = State(initialValue: .property)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ProgressView(value: Double(step.rawValue + 1), total: Double(RealEstateIntakeStep.allCases.count))
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.vertical, MoatTheme.Spacing.medium)
                    .background(MoatTheme.ColorToken.appBackground)

                ZStack(alignment: .bottom) {
                    ScrollView {
                        VStack(spacing: MoatTheme.Spacing.xLarge) {
                            Text(step.instruction)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)

                            stepContent

                            if let errorMessage {
                                Text(errorMessage)
                                    .font(.footnote)
                                    .foregroundStyle(MoatTheme.ColorToken.destructive)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            if step == .review, let onDelete {
                                Button(role: .destructive, action: onDelete) {
                                    Text("Delete")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.moatSecondary)
                            }
                        }
                        .padding(MoatTheme.Spacing.large)
                        .padding(.bottom, bottomBarScrollInset)
                    }
                    .moatPageBackground()

                    bottomChrome
                }
            }
            .navigationTitle(mode.property == nil ? "Add Property" : "Edit Property")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
        .onChange(of: mortgageAccounts) { _ in
            resolveAutoLinkedMortgageAccountIfNeeded()
        }
    }

    private var isDemoMode: Bool {
        UserDefaults.standard.string(forKey: DemoModeDefaults.sessionKey)?.isEmpty == false
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case .property:
            propertyStep
        case .mortgage:
            mortgageStep
        case .income:
            incomeStep
        case .expenses:
            expensesStep
        case .forecast:
            forecastStep
        case .review:
            reviewStep
        }
    }

    private var propertyStep: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                FinancialProfileLabeledTextField(
                    title: "Property name",
                    helpMessage: "A recognizable name for this property.",
                    placeholder: "e.g. 123 Main St",
                    text: $values.name
                )
                FinancialProfileLabeledPicker(
                    title: "Property type",
                    helpMessage: "The physical type of property.",
                    selection: $values.propertyType,
                    selectionTitle: values.propertyType.title,
                    selectionSystemImage: values.propertyType.systemImage
                ) {
                    ForEach(RealEstatePropertyType.allCases) { type in
                        Label(type.title, systemImage: type.systemImage)
                            .tag(type)
                    }
                }
                FinancialProfileLabeledPicker(
                    title: "Usage type",
                    helpMessage: "How you use this property.",
                    selection: $values.usageType,
                    selectionTitle: values.usageType.title,
                    selectionSystemImage: values.usageType.systemImage
                ) {
                    ForEach(RealEstateUsageType.allCases) { type in
                        Label(type.title, systemImage: type.systemImage)
                            .tag(type)
                    }
                }
                FinancialProfileLabeledTextField(
                    title: "Current estimated value",
                    helpMessage: "Your best estimate of market value today.",
                    placeholder: "400,000",
                    text: $values.currentEstimatedValue,
                    keyboardType: .decimalPad,
                    formatsGroupedNumber: true
                )
            }
        }
    }

    private var mortgageStep: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                FinancialProfileLabeledToggle(
                    title: "I have a mortgage",
                    helpMessage: "Turn off if you own this property outright.",
                    isOn: $values.hasMortgage
                )
                .onChange(of: values.hasMortgage) { hasMortgage in
                    if !hasMortgage {
                        values.currentLoanBalance = "0"
                        values.linkedPlaidAccountId = ""
                    }
                }

                if values.hasMortgage {
                    FinancialProfileLabeledDateField(
                        title: "Date purchased",
                        helpMessage: "The date you purchased this property.",
                        dateString: $values.purchaseDate
                    )
                    FinancialProfileLabeledTextField(
                        title: "Loan term (years)",
                        helpMessage: "Original loan term in years.",
                        placeholder: "30",
                        text: $values.loanTermYears,
                        keyboardType: .numberPad
                    )
                    FinancialProfileLabeledTextField(
                        title: "Interest rate (%)",
                        helpMessage: "Annual mortgage interest rate.",
                        placeholder: "6.5",
                        text: $values.interestRate,
                        keyboardType: .decimalPad
                    )

                    RealEstateMortgageLinkPicker(
                        accounts: mortgageAccounts,
                        selectedAccountId: Binding(
                            get: {
                                values.linkedPlaidAccountId.isEmpty ? nil : values.linkedPlaidAccountId
                            },
                            set: { values.linkedPlaidAccountId = $0 ?? "" }
                        ),
                        onLink: { account in
                            values.currentLoanBalance = AmountInputFormatter.format(abs(account.balance))
                        },
                        onConnectNew: {
                            accountIdsBeforeConnect = Set(mortgageAccounts.map(\.id))
                            Task { await connectSyncedAccount() }
                        }
                    )

                    FinancialProfileLabeledTextField(
                        title: "Current loan balance",
                        helpMessage: values.linkedPlaidAccountId.isEmpty
                            ? "Outstanding mortgage balance."
                            : "Synced from linked account and updated when Plaid syncs.",
                        placeholder: "300,000",
                        text: $values.currentLoanBalance,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    .disabled(!values.linkedPlaidAccountId.isEmpty)

                    DisclosureGroup("Advanced mortgage details") {
                        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                            FinancialProfileLabeledTextField(
                                title: "Purchase price",
                                helpMessage: "Original purchase price.",
                                placeholder: "380,000",
                                text: $values.purchasePrice,
                                keyboardType: .decimalPad,
                                formatsGroupedNumber: true
                            )
                            FinancialProfileLabeledTextField(
                                title: "Down payment",
                                helpMessage: "Cash down payment at purchase.",
                                placeholder: "80,000",
                                text: $values.downPayment,
                                keyboardType: .decimalPad,
                                formatsGroupedNumber: true
                            )
                            FinancialProfileLabeledTextField(
                                title: "Closing costs",
                                helpMessage: "Closing costs paid at purchase.",
                                placeholder: "5,000",
                                text: $values.closingCosts,
                                keyboardType: .decimalPad,
                                formatsGroupedNumber: true
                            )
                            FinancialProfileLabeledTextField(
                                title: "Initial rehab",
                                helpMessage: "Renovation or rehab costs at purchase.",
                                placeholder: "0",
                                text: $values.rehabCosts,
                                keyboardType: .decimalPad,
                                formatsGroupedNumber: true
                            )
                            FinancialProfileLabeledTextField(
                                title: "Remaining term (months)",
                                helpMessage: "Months remaining on the loan.",
                                placeholder: "300",
                                text: $values.remainingTermMonths,
                                keyboardType: .numberPad
                            )
                            FinancialProfileLabeledTextField(
                                title: "Monthly mortgage payment",
                                helpMessage: "Principal and interest payment.",
                                placeholder: "1,900",
                                text: $values.monthlyMortgagePayment,
                                keyboardType: .decimalPad,
                                formatsGroupedNumber: true
                            )
                        }
                        .padding(.top, MoatTheme.Spacing.medium)
                    }
                } else {
                    Text("No mortgage? You can skip ahead to income and expenses.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var incomeStep: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                FinancialProfileLabeledToggle(
                    title: "This property is rented",
                    helpMessage: "Enable for rental or mixed-use income.",
                    isOn: $values.isRented
                )

                if values.isRented {
                    FinancialProfileLabeledTextField(
                        title: "Monthly rent",
                        helpMessage: "Expected gross monthly rent.",
                        placeholder: "2,000",
                        text: $values.monthlyRent,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )

                    DisclosureGroup("Advanced income details") {
                        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                            FinancialProfileLabeledTextField(
                                title: "Other monthly income",
                                helpMessage: "Parking, laundry, or other recurring income.",
                                placeholder: "0",
                                text: $values.otherMonthlyIncome,
                                keyboardType: .decimalPad,
                                formatsGroupedNumber: true
                            )
                            FinancialProfileLabeledTextField(
                                title: "Vacancy rate (%)",
                                helpMessage: "Expected vacancy allowance.",
                                placeholder: "5",
                                text: $values.vacancyRate,
                                keyboardType: .decimalPad
                            )
                        }
                        .padding(.top, MoatTheme.Spacing.medium)
                    }
                } else {
                    Text("Primary residences and vacation homes can skip rental income.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var expensesStep: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                FinancialProfileLabeledTextField(
                    title: "Total monthly expenses",
                    helpMessage: "Quick estimate — overridden by itemized expenses below.",
                    placeholder: "1,500",
                    text: $values.totalMonthlyExpenses,
                    keyboardType: .decimalPad,
                    formatsGroupedNumber: true
                )

                DisclosureGroup("Itemized expense breakdown") {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                        FinancialProfileLabeledTextField(title: "Property tax ($/mo)", helpMessage: "Monthly property tax.", placeholder: "400", text: $values.monthlyPropertyTax, keyboardType: .decimalPad, formatsGroupedNumber: true)
                        FinancialProfileLabeledTextField(title: "Insurance ($/mo)", helpMessage: "Property insurance.", placeholder: "120", text: $values.monthlyInsurance, keyboardType: .decimalPad, formatsGroupedNumber: true)
                        FinancialProfileLabeledTextField(title: "HOA ($/mo)", helpMessage: "HOA or condo fees.", placeholder: "0", text: $values.monthlyHOA, keyboardType: .decimalPad, formatsGroupedNumber: true)
                        FinancialProfileLabeledTextField(title: "Utilities ($/mo)", helpMessage: "Utilities paid by owner.", placeholder: "0", text: $values.monthlyUtilities, keyboardType: .decimalPad, formatsGroupedNumber: true)
                        FinancialProfileLabeledTextField(title: "Maintenance ($/mo)", helpMessage: "Repairs and upkeep.", placeholder: "200", text: $values.monthlyMaintenance, keyboardType: .decimalPad, formatsGroupedNumber: true)
                        FinancialProfileLabeledTextField(title: "Property mgmt ($/mo)", helpMessage: "Property management fees.", placeholder: "0", text: $values.monthlyManagement, keyboardType: .decimalPad, formatsGroupedNumber: true)
                        FinancialProfileLabeledTextField(title: "Other expenses ($/mo)", helpMessage: "Any other recurring costs.", placeholder: "0", text: $values.monthlyOtherExpenses, keyboardType: .decimalPad, formatsGroupedNumber: true)
                    }
                    .padding(.top, MoatTheme.Spacing.medium)
                }
            }
        }
    }

    private var forecastStep: some View {
        let preview = realEstatePreview(from: values)

        return MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                FinancialProfileLabeledPicker(
                    title: "Forecast scenario",
                    helpMessage: "Rent growth assumption for projections.",
                    selection: $values.forecastScenario,
                    selectionTitle: values.forecastScenario.title
                ) {
                    ForEach(RealEstateForecastScenario.allCases) { scenario in
                        Text(scenario.title).tag(scenario)
                    }
                }

                DisclosureGroup("Advanced forecast assumptions") {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                        FinancialProfileLabeledTextField(
                            title: "Annual appreciation rate (%)",
                            helpMessage: "Expected annual property appreciation.",
                            placeholder: "3",
                            text: $values.appreciationRate,
                            keyboardType: .decimalPad
                        )
                        FinancialProfileLabeledTextField(
                            title: "Annual expense growth rate (%)",
                            helpMessage: "Expected annual expense inflation.",
                            placeholder: "2",
                            text: $values.expenseGrowthRate,
                            keyboardType: .decimalPad
                        )
                    }
                    .padding(.top, MoatTheme.Spacing.medium)
                }

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    Text("Preview")
                        .font(.subheadline.weight(.semibold))
                    FinancialProfileDetailRow(title: "Current equity", value: CurrencyFormatter.formatCompact(preview.equity))
                    FinancialProfileDetailRow(
                        title: "Monthly cash flow",
                        value: CurrencyFormatter.formatCompact(preview.monthlyCashFlow)
                    )
                }
                .padding(MoatTheme.Spacing.medium)
                .background(MoatTheme.ColorToken.elevatedSurface.opacity(0.7))
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
            }
        }
    }

    private var reviewStep: some View {
        let preview = realEstatePreview(from: values)

        return MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                FinancialProfileDetailRow(title: "Property", value: values.name.isEmpty ? "Not set" : values.name)
                FinancialProfileDetailRow(title: "Type", value: values.propertyType.title)
                FinancialProfileDetailRow(title: "Usage", value: values.usageType.title)
                FinancialProfileDetailRow(
                    title: "Estimated value",
                    value: CurrencyFormatter.formatCompact(parseRealEstateFormNumber(values.currentEstimatedValue) ?? 0)
                )
                FinancialProfileDetailRow(
                    title: "Loan balance",
                    value: values.hasMortgage
                        ? CurrencyFormatter.formatCompact(parseRealEstateFormNumber(values.currentLoanBalance) ?? 0)
                        : "$0"
                )
                FinancialProfileDetailRow(title: "Scenario", value: values.forecastScenario.title)
                FinancialProfileDetailRow(title: "Equity", value: CurrencyFormatter.formatCompact(preview.equity))
                FinancialProfileDetailRow(title: "Monthly cash flow", value: CurrencyFormatter.formatCompact(preview.monthlyCashFlow))
            }
        }
    }

    private var bottomChrome: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [
                    MoatTheme.ColorToken.appBackground.opacity(0),
                    MoatTheme.ColorToken.appBackground,
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 56)
            .allowsHitTesting(false)

            navigationBar
        }
    }

    private var bottomBarScrollInset: CGFloat {
        56 + MoatTheme.Size.buttonHeight + MoatTheme.Spacing.large * 2
    }

    private var navigationBar: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            if step != .property {
                Button("Back") {
                    step = RealEstateIntakeStep(rawValue: step.rawValue - 1) ?? .property
                }
                .buttonStyle(.moatSecondary)
            }

            Group {
                if step == .review {
                    Button {
                        HapticFeedback.saveOrSubmit()
                        Task { await performSave() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Save").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isWorking)
                } else {
                    Button("Next") {
                        step = RealEstateIntakeStep(rawValue: step.rawValue + 1) ?? .review
                    }
                    .disabled(!canContinueRealEstateStep(step, form: values))
                }
            }
            .frame(maxWidth: .infinity)
            .buttonStyle(.moatPrimary)
        }
        .padding(MoatTheme.Spacing.large)
        .background(MoatTheme.ColorToken.appBackground)
    }

    /// Opens native Plaid Link. Restore `ConnectInstitutionSheet` when MX / Finicity
    /// multi-provider routing is ready — do not delete that sheet.
    private func connectSyncedAccount() async {
        if isDemoMode {
            errorMessage = "Sample data cannot run a Plaid connect flow. Exit demo mode to connect a real institution."
            return
        }

        guard !isConnectingAccount else { return }

        isConnectingAccount = true
        errorMessage = nil
        defer { isConnectingAccount = false }

        do {
            let coordinator = ProviderLaunchCoordinator()
            _ = try await coordinator.launchDirectPlaid()
            isAwaitingConnectedAccounts = true
            await onAccountsRefresh?()
        } catch {
            if error as? PlaidLinkError == .cancelled {
                return
            }
            errorMessage = error.localizedDescription
        }
    }

    private func performSave() async {
        guard canSubmitRealEstateForm(values) else {
            errorMessage = "Complete the required property details."
            return
        }

        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onSave(values)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func resolveAutoLinkedMortgageAccountIfNeeded() {
        guard isAwaitingConnectedAccounts else { return }

        let addedAccounts = mortgageAccounts.filter { !accountIdsBeforeConnect.contains($0.id) }
        guard !addedAccounts.isEmpty else { return }

        isAwaitingConnectedAccounts = false
        guard values.linkedPlaidAccountId.isEmpty else { return }

        let mortgageCandidates = addedAccounts.filter(\.isMortgageCandidate)
        let accountToLink: LinkedPlaidAccountSummary?
        if mortgageCandidates.count == 1 {
            accountToLink = mortgageCandidates.first
        } else if addedAccounts.count == 1 {
            accountToLink = addedAccounts.first
        } else {
            accountToLink = nil
        }

        guard let accountToLink else { return }

        values.linkedPlaidAccountId = accountToLink.id
        let balance = abs(accountToLink.balance)
        guard balance > 0 else { return }
        values.currentLoanBalance = AmountInputFormatter.format(balance)
    }
}

struct RealEstateMortgageLinkPicker: View {
    let accounts: [LinkedPlaidAccountSummary]
    @Binding var selectedAccountId: String?
    let onLink: (LinkedPlaidAccountSummary) -> Void
    let onConnectNew: () -> Void

    private let maxVisibleRows = 6
    private let rowHeight: CGFloat = 36

    private var selectedAccount: LinkedPlaidAccountSummary? {
        guard let selectedAccountId else { return nil }
        return accounts.first { $0.id == selectedAccountId }
    }

    private var valueLabel: String {
        if let selectedAccount { return selectedAccount.maskedName }
        return selectedAccountId == nil ? "None" : "Linked account"
    }

    var body: some View {
        FinancialProfileLabeledMenuField(
            title: "Linked mortgage account",
            helpMessage: "Link a loan or mortgage account to sync the loan balance.",
            valueLabel: valueLabel,
            valueSystemImage: selectedAccountId == nil ? nil : "link",
            isPlaceholder: selectedAccountId == nil,
            footnote: selectedAccountId == nil
                ? "Link a loan or mortgage account to sync the loan balance."
                : "Loan balance is seeded from the linked account and updates when Plaid syncs."
        ) {
            Button("None") { selectedAccountId = nil }
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if accounts.isEmpty {
                        Button("No connected accounts") {}
                            .disabled(true)
                    } else {
                        ForEach(accounts) { account in
                            Button {
                                selectedAccountId = account.id
                                onLink(account)
                            } label: {
                                Label(
                                    account.maskedName,
                                    systemImage: account.isMortgageCandidate
                                        ? "building.columns.fill"
                                        : "creditcard.fill"
                                )
                            }
                        }
                    }
                }
            }
            .frame(maxHeight: rowHeight * CGFloat(maxVisibleRows))
            Divider()
            Button(action: onConnectNew) {
                Label("Connect new account", systemImage: "plus")
            }
        }
    }
}
