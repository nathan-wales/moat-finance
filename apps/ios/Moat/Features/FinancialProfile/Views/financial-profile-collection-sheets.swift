import SwiftUI

struct FinancialProfileOtherAssetSheet: View {
    let asset: ProfileAsset?
    let existingAssets: [ProfileAsset]
    let onSave: (ProfileAsset) -> Void
    let onCancel: () -> Void
    let onUpsertLiability: (ProfileLiability) async -> Void
    let onUpsertInsurance: (InsurancePolicy) async -> Void
    let onDelete: (() -> Void)?
    let onAccountsRefresh: (() async -> Void)?

    @State private var availableLiabilities: [ProfileLiability]
    @State private var availablePolicies: [InsurancePolicy]
    @State private var name: String
    @State private var type: String
    @State private var estimatedValue: String
    @State private var linkedLiability: String
    @State private var linkedInsurance: String
    @State private var includeInNetWorth: Bool
    @State private var includeInForecast: Bool
    @State private var showCreateLiabilitySheet = false
    @State private var showCreateInsuranceSheet = false
    @State private var connectErrorMessage: String?

    private var isDemoMode: Bool {
        UserDefaults.standard.string(forKey: DemoModeDefaults.sessionKey)?.isEmpty == false
    }

    private var liabilityOptions: [String] {
        filterLiabilitiesForAssetType(availableLiabilities, assetType: type).map(\.name)
    }

    private var insuranceOptions: [String] {
        filterPoliciesForAssetType(availablePolicies, assetType: type).map(\.displayName)
    }

    private var draftAsset: ProfileAsset {
        ProfileAsset(
            id: asset?.id ?? "draft-asset",
            name: name,
            type: type,
            estimatedValue: AmountInputFormatter.parse(estimatedValue) ?? 0,
            linkedLiability: linkedLiability.isEmpty ? nil : linkedLiability,
            linkedInsurance: linkedInsurance.isEmpty ? nil : linkedInsurance,
            includeInNetWorth: includeInNetWorth,
            includeInForecast: includeInForecast
        )
    }

    private var assetsForLinking: [ProfileAsset] {
        let draft = draftAsset
        if existingAssets.contains(where: { $0.id == draft.id || $0.name == draft.name }) {
            return existingAssets
        }
        return existingAssets + [draft]
    }

    private var prefilledInsuranceFormValues: InsurancePolicyFormValues {
        var values = createEmptyInsuranceFormValues()
        values.type = suggestedInsurancePolicyType(forAssetType: type)
        values.linkedAssetLabel = name
        return values
    }

    init(
        asset: ProfileAsset?,
        assets: [ProfileAsset] = [],
        liabilities: [ProfileLiability],
        policies: [InsurancePolicy],
        onSave: @escaping (ProfileAsset) -> Void,
        onCancel: @escaping () -> Void,
        onUpsertLiability: @escaping (ProfileLiability) async -> Void,
        onUpsertInsurance: @escaping (InsurancePolicy) async -> Void,
        onDelete: (() -> Void)? = nil,
        onAccountsRefresh: (() async -> Void)? = nil
    ) {
        self.asset = asset
        self.existingAssets = assets
        self.onSave = onSave
        self.onCancel = onCancel
        self.onUpsertLiability = onUpsertLiability
        self.onUpsertInsurance = onUpsertInsurance
        self.onDelete = onDelete
        self.onAccountsRefresh = onAccountsRefresh
        _availableLiabilities = State(initialValue: liabilities)
        _availablePolicies = State(initialValue: policies)
        _name = State(initialValue: asset?.name ?? "New asset")
        _type = State(initialValue: asset?.type ?? "Other")
        _estimatedValue = State(initialValue: asset.map { AmountInputFormatter.format($0.estimatedValue) } ?? "0")
        _linkedLiability = State(initialValue: asset?.linkedLiability ?? "")
        _linkedInsurance = State(initialValue: asset?.linkedInsurance ?? "")
        _includeInNetWorth = State(initialValue: asset?.includeInNetWorth ?? true)
        _includeInForecast = State(initialValue: asset?.includeInForecast ?? true)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Asset details") {
                    FinancialProfileLabeledTextField(
                        title: "Name",
                        helpMessage: "The display name for this asset in your profile.",
                        placeholder: "Asset name",
                        text: $name
                    )
                    FinancialProfileLabeledPicker(
                        title: "Type",
                        helpMessage: "The category of asset, such as vehicle, business, or collectible.",
                        selection: $type,
                        selectionTitle: type,
                        selectionSystemImage: assetTypeSystemImage(for: type)
                    ) {
                        ForEach(FinancialProfileFieldOptions.otherAssetTypes, id: \.self) { assetType in
                            Label(assetType, systemImage: assetTypeSystemImage(for: assetType))
                                .tag(assetType)
                        }
                    }
                    FinancialProfileLabeledTextField(
                        title: "Estimated value",
                        helpMessage: "Your best estimate of what this asset is worth today. Moat uses it for net worth and forecasts.",
                        placeholder: "0",
                        text: $estimatedValue,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLinkMenuPicker(
                        title: "Linked liability",
                        helpMessage: "Connect a loan or debt tied to this asset, like an auto loan.",
                        selection: $linkedLiability,
                        options: liabilityOptions,
                        onCreateNew: { showCreateLiabilitySheet = true },
                        onConnectNew: {
                            Task {
                                connectErrorMessage = await connectSyncedAccountFromProfileSheet(
                                    isDemoMode: isDemoMode,
                                    onAccountsRefresh: onAccountsRefresh
                                )
                            }
                        }
                    )
                    FinancialProfileLinkMenuPicker(
                        title: "Linked insurance",
                        helpMessage: "Connect an insurance policy that covers this asset.",
                        selection: $linkedInsurance,
                        options: insuranceOptions,
                        onCreateNew: { showCreateInsuranceSheet = true }
                    )
                    FinancialProfileLabeledToggle(
                        title: "Included in net worth",
                        helpMessage: "When enabled, this asset's value is counted in your total net worth.",
                        isOn: $includeInNetWorth
                    )
                    FinancialProfileLabeledToggle(
                        title: "Included in forecast",
                        helpMessage: "When enabled, this asset is included in your financial forecast projections.",
                        isOn: $includeInForecast
                    )
                    if let connectErrorMessage {
                        Text(connectErrorMessage)
                            .font(.footnote)
                            .foregroundStyle(MoatTheme.ColorToken.warning)
                    }
                }

                if let onDelete {
                    FinancialProfileSheetDeleteSection(action: onDelete)
                }
            }
            .navigationTitle(asset == nil ? "Add Other Asset" : "Edit Asset")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        onSave(
                            ProfileAsset(
                                id: asset?.id ?? newId("asset"),
                                name: name,
                                type: type,
                                estimatedValue: AmountInputFormatter.parse(estimatedValue) ?? 0,
                                linkedLiability: linkedLiability.isEmpty ? nil : linkedLiability,
                                linkedInsurance: linkedInsurance.isEmpty ? nil : linkedInsurance,
                                includeInNetWorth: includeInNetWorth,
                                includeInForecast: includeInForecast
                            )
                        )
                    }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
        .sheet(isPresented: $showCreateLiabilitySheet) {
            FinancialProfileLiabilitySheet(
                liability: nil,
                assets: assetsForLinking,
                prefilledType: suggestedLiabilityType(forAssetType: type),
                prefilledLinkedAsset: name,
                onSave: { liability in
                    Task {
                        await onUpsertLiability(liability)
                        availableLiabilities = upsertItem(liability, in: availableLiabilities)
                        linkedLiability = liability.name
                        showCreateLiabilitySheet = false
                    }
                },
                onCancel: { showCreateLiabilitySheet = false }
            )
        }
        .sheet(isPresented: $showCreateInsuranceSheet) {
            FinancialProfileInsuranceIntakeSheet(
                existingPolicy: nil,
                assets: assetsForLinking,
                prefilledFormValues: prefilledInsuranceFormValues,
                initialStep: .type,
                onSave: { policy in
                    Task {
                        await onUpsertInsurance(policy)
                        availablePolicies = upsertItem(policy, in: availablePolicies)
                        linkedInsurance = policy.displayName
                        showCreateInsuranceSheet = false
                    }
                },
                onCancel: { showCreateInsuranceSheet = false }
            )
        }
    }

    private func upsertItem<T: Identifiable>(_ item: T, in array: [T]) -> [T] where T.ID == String {
        if array.contains(where: { $0.id == item.id }) {
            return array.map { $0.id == item.id ? item : $0 }
        }
        return array + [item]
    }
}

struct FinancialProfileAssetSheet: View {
    let asset: ProfileAsset?
    let existingAssets: [ProfileAsset]
    let onSave: (ProfileAsset) -> Void
    let onCancel: () -> Void
    let onUpsertLiability: (ProfileLiability) async -> Void
    let onUpsertInsurance: (InsurancePolicy) async -> Void
    let onDelete: (() -> Void)?
    let onAccountsRefresh: (() async -> Void)?

    @State private var availableLiabilities: [ProfileLiability]
    @State private var availablePolicies: [InsurancePolicy]
    @State private var name: String
    @State private var type: String
    @State private var estimatedValue: String
    @State private var linkedLiability: String
    @State private var linkedInsurance: String
    @State private var includeInNetWorth: Bool
    @State private var includeInForecast: Bool
    @State private var showCreateLiabilitySheet = false
    @State private var showCreateInsuranceSheet = false
    @State private var connectErrorMessage: String?

    private var isDemoMode: Bool {
        UserDefaults.standard.string(forKey: DemoModeDefaults.sessionKey)?.isEmpty == false
    }

    private var liabilityOptions: [String] {
        filterLiabilitiesForAssetType(availableLiabilities, assetType: type).map(\.name)
    }

    private var insuranceOptions: [String] {
        filterPoliciesForAssetType(availablePolicies, assetType: type).map(\.displayName)
    }

    private var draftAsset: ProfileAsset {
        ProfileAsset(
            id: asset?.id ?? "draft-asset",
            name: name,
            type: type,
            estimatedValue: AmountInputFormatter.parse(estimatedValue) ?? 0,
            linkedLiability: linkedLiability.isEmpty ? nil : linkedLiability,
            linkedInsurance: linkedInsurance.isEmpty ? nil : linkedInsurance,
            includeInNetWorth: includeInNetWorth,
            includeInForecast: includeInForecast
        )
    }

    private var assetsForLinking: [ProfileAsset] {
        let draft = draftAsset
        if existingAssets.contains(where: { $0.id == draft.id || $0.name == draft.name }) {
            return existingAssets
        }
        return existingAssets + [draft]
    }

    private var prefilledInsuranceFormValues: InsurancePolicyFormValues {
        var values = createEmptyInsuranceFormValues()
        values.type = suggestedInsurancePolicyType(forAssetType: type)
        values.linkedAssetLabel = name
        return values
    }

    init(
        asset: ProfileAsset?,
        assets: [ProfileAsset] = [],
        liabilities: [ProfileLiability],
        policies: [InsurancePolicy],
        onSave: @escaping (ProfileAsset) -> Void,
        onCancel: @escaping () -> Void,
        onUpsertLiability: @escaping (ProfileLiability) async -> Void,
        onUpsertInsurance: @escaping (InsurancePolicy) async -> Void,
        onDelete: (() -> Void)? = nil,
        onAccountsRefresh: (() async -> Void)? = nil
    ) {
        self.asset = asset
        self.existingAssets = assets
        self.onSave = onSave
        self.onCancel = onCancel
        self.onUpsertLiability = onUpsertLiability
        self.onUpsertInsurance = onUpsertInsurance
        self.onDelete = onDelete
        self.onAccountsRefresh = onAccountsRefresh
        _availableLiabilities = State(initialValue: liabilities)
        _availablePolicies = State(initialValue: policies)
        _name = State(initialValue: asset?.name ?? "New asset")
        _type = State(initialValue: asset?.type ?? "Real estate")
        _estimatedValue = State(initialValue: asset.map { AmountInputFormatter.format($0.estimatedValue) } ?? "0")
        _linkedLiability = State(initialValue: asset?.linkedLiability ?? "")
        _linkedInsurance = State(initialValue: asset?.linkedInsurance ?? "")
        _includeInNetWorth = State(initialValue: asset?.includeInNetWorth ?? true)
        _includeInForecast = State(initialValue: asset?.includeInForecast ?? true)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Asset details") {
                    FinancialProfileLabeledTextField(
                        title: "Name",
                        helpMessage: "The display name for this asset in your profile.",
                        placeholder: "Asset name",
                        text: $name
                    )
                    FinancialProfileLabeledPicker(
                        title: "Type",
                        helpMessage: "The category of asset, such as real estate, vehicle, or business.",
                        selection: $type,
                        selectionTitle: type,
                        selectionSystemImage: assetTypeSystemImage(for: type)
                    ) {
                        ForEach(FinancialProfileFieldOptions.assetTypes, id: \.self) { assetType in
                            Label(assetType, systemImage: assetTypeSystemImage(for: assetType))
                                .tag(assetType)
                        }
                    }
                    FinancialProfileLabeledTextField(
                        title: "Estimated value",
                        helpMessage: "Your best estimate of what this asset is worth today. Moat uses it for net worth and forecasts.",
                        placeholder: "0",
                        text: $estimatedValue,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLinkMenuPicker(
                        title: "Linked liability",
                        helpMessage: "Connect a loan or debt tied to this asset, like a mortgage or auto loan.",
                        selection: $linkedLiability,
                        options: liabilityOptions,
                        onCreateNew: { showCreateLiabilitySheet = true },
                        onConnectNew: {
                            Task {
                                connectErrorMessage = await connectSyncedAccountFromProfileSheet(
                                    isDemoMode: isDemoMode,
                                    onAccountsRefresh: onAccountsRefresh
                                )
                            }
                        }
                    )
                    FinancialProfileLinkMenuPicker(
                        title: "Linked insurance",
                        helpMessage: "Connect an insurance policy that covers this asset.",
                        selection: $linkedInsurance,
                        options: insuranceOptions,
                        onCreateNew: { showCreateInsuranceSheet = true }
                    )
                    FinancialProfileLabeledToggle(
                        title: "Included in net worth",
                        helpMessage: "When enabled, this asset's value is counted in your total net worth.",
                        isOn: $includeInNetWorth
                    )
                    FinancialProfileLabeledToggle(
                        title: "Included in forecast",
                        helpMessage: "When enabled, this asset is included in your financial forecast projections.",
                        isOn: $includeInForecast
                    )
                    if let connectErrorMessage {
                        Text(connectErrorMessage)
                            .font(.footnote)
                            .foregroundStyle(MoatTheme.ColorToken.warning)
                    }
                }

                if let onDelete {
                    FinancialProfileSheetDeleteSection(action: onDelete)
                }
            }
            .navigationTitle(asset == nil ? "Add Asset" : "Edit Asset")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        onSave(
                            ProfileAsset(
                                id: asset?.id ?? newId("asset"),
                                name: name,
                                type: type,
                                estimatedValue: AmountInputFormatter.parse(estimatedValue) ?? 0,
                                linkedLiability: linkedLiability.isEmpty ? nil : linkedLiability,
                                linkedInsurance: linkedInsurance.isEmpty ? nil : linkedInsurance,
                                includeInNetWorth: includeInNetWorth,
                                includeInForecast: includeInForecast
                            )
                        )
                    }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
        .sheet(isPresented: $showCreateLiabilitySheet) {
            FinancialProfileLiabilitySheet(
                liability: nil,
                assets: assetsForLinking,
                prefilledType: suggestedLiabilityType(forAssetType: type),
                prefilledLinkedAsset: name,
                onSave: { liability in
                    Task {
                        await onUpsertLiability(liability)
                        availableLiabilities = upsertItem(liability, in: availableLiabilities)
                        linkedLiability = liability.name
                        showCreateLiabilitySheet = false
                    }
                },
                onCancel: { showCreateLiabilitySheet = false }
            )
        }
        .sheet(isPresented: $showCreateInsuranceSheet) {
            FinancialProfileInsuranceIntakeSheet(
                existingPolicy: nil,
                assets: assetsForLinking,
                prefilledFormValues: prefilledInsuranceFormValues,
                initialStep: .type,
                onSave: { policy in
                    Task {
                        await onUpsertInsurance(policy)
                        availablePolicies = upsertItem(policy, in: availablePolicies)
                        linkedInsurance = policy.displayName
                        showCreateInsuranceSheet = false
                    }
                },
                onCancel: { showCreateInsuranceSheet = false }
            )
        }
    }

    private func upsertItem<T: Identifiable>(_ item: T, in array: [T]) -> [T] where T.ID == String {
        if array.contains(where: { $0.id == item.id }) {
            return array.map { $0.id == item.id ? item : $0 }
        }
        return array + [item]
    }
}

struct FinancialProfileLiabilitySheet: View {
    private static let typeOptions = [
        "Mortgage",
        "Auto loan",
        "Student loan",
        "Personal loan",
        "Credit card",
        "HELOC",
        "Other",
    ]
    private static let termOptions = [3, 5, 7, 10, 15, 20, 25, 30]

    let liability: ProfileLiability?
    let assets: [ProfileAsset]
    let onSave: (ProfileLiability) -> Void
    let onCancel: () -> Void
    let onDelete: (() -> Void)?

    @State private var name: String
    @State private var type: String
    @State private var balance: String
    @State private var interestRate: String
    @State private var monthlyPayment: String
    @State private var linkedAsset: String
    @State private var loanStartDate: String
    @State private var loanTermYears: Int?
    @State private var includeInNetWorth: Bool
    @State private var includeInForecast: Bool
    @State private var autoUpdateBalance: Bool

    private var assetOptions: [String] {
        filterAssetsForLiabilityType(assets, liabilityType: type).map(\.name)
    }

    private var typePickerOptions: [String] {
        var options = Self.typeOptions
        if !type.isEmpty, !options.contains(type) {
            options.append(type)
        }
        return options
    }

    init(
        liability: ProfileLiability?,
        assets: [ProfileAsset],
        prefilledType: String? = nil,
        prefilledLinkedAsset: String? = nil,
        onSave: @escaping (ProfileLiability) -> Void,
        onCancel: @escaping () -> Void,
        onDelete: (() -> Void)? = nil
    ) {
        self.liability = liability
        self.assets = assets
        self.onSave = onSave
        self.onCancel = onCancel
        self.onDelete = onDelete
        _name = State(initialValue: liability?.name ?? "New liability")
        _type = State(initialValue: liability?.type ?? prefilledType ?? "Mortgage")
        _balance = State(initialValue: liability.map { AmountInputFormatter.format($0.balance) } ?? "0")
        _interestRate = State(initialValue: liability.map { formatPercentInput($0.interestRate) } ?? "0")
        _monthlyPayment = State(initialValue: liability.map { AmountInputFormatter.format($0.monthlyPayment) } ?? "0")
        _linkedAsset = State(initialValue: liability?.linkedAsset ?? prefilledLinkedAsset ?? "")
        _loanStartDate = State(initialValue: liability?.loanStartDate ?? "")
        _loanTermYears = State(initialValue: liability?.loanTermYears)
        _includeInNetWorth = State(initialValue: liability?.includeInNetWorth ?? false)
        _includeInForecast = State(initialValue: liability?.includeInForecast ?? true)
        _autoUpdateBalance = State(initialValue: liability?.autoUpdateBalance ?? true)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Liability details") {
                    FinancialProfileLabeledTextField(
                        title: "Name",
                        helpMessage: "The display name for this liability in your profile.",
                        placeholder: "Liability name",
                        text: $name
                    )
                    FinancialProfileLabeledPicker(
                        title: "Type",
                        helpMessage: "The liability category used to filter linked assets and model payoff.",
                        selection: $type,
                        selectionTitle: type
                    ) {
                        ForEach(typePickerOptions, id: \.self) { Text($0).tag($0) }
                    }
                    FinancialProfileLabeledTextField(
                        title: "Current Balance",
                        helpMessage: "The current amount you still owe on this liability.",
                        placeholder: "0",
                        text: $balance,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLabeledTextField(
                        title: "Interest Rate (%)",
                        helpMessage: "The annual interest rate on this debt, as a percentage.",
                        placeholder: "0",
                        text: $interestRate,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true,
                        fractionDigits: 2
                    )
                    FinancialProfileLabeledTextField(
                        title: "Monthly Payment",
                        helpMessage: "Your typical monthly payment toward this liability. Set to 0 if unknown.",
                        placeholder: "0",
                        text: $monthlyPayment,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLabeledDateField(
                        title: "Loan Start Date",
                        helpMessage: "When this loan originated. Used for remaining term and monthly balance updates.",
                        dateString: $loanStartDate,
                        isOptional: true
                    )
                    FinancialProfileLabeledPicker(
                        title: "Loan Term",
                        helpMessage: "Original loan term. Leave blank for revolving debt like credit cards.",
                        selection: Binding(
                            get: { loanTermYears ?? 0 },
                            set: { loanTermYears = $0 == 0 ? nil : $0 }
                        ),
                        selectionTitle: loanTermYears.map { "\($0) years" } ?? "None"
                    ) {
                        Text("None").tag(0)
                        ForEach(Self.termOptions, id: \.self) { years in
                            Text("\(years) years").tag(years)
                        }
                    }
                    FinancialProfileLabeledPicker(
                        title: "Linked Asset (optional)",
                        helpMessage: "Connect an asset this debt is tied to, like a house or vehicle.",
                        selection: $linkedAsset,
                        selectionTitle: linkedAsset.isEmpty ? "None" : linkedAsset
                    ) {
                        Text("None").tag("")
                        ForEach(assetOptions, id: \.self) { Text($0).tag($0) }
                    }
                }

                Section("Options") {
                    FinancialProfileLabeledToggle(
                        title: "Include in net worth",
                        helpMessage: "Count this debt against your total net worth.",
                        isOn: $includeInNetWorth
                    )
                    FinancialProfileLabeledToggle(
                        title: "Include in forecast",
                        helpMessage: "Include this debt in payoff and forecast modeling.",
                        isOn: $includeInForecast
                    )
                    FinancialProfileLabeledToggle(
                        title: "Auto-update loan balance",
                        helpMessage: "On the monthly anniversary, Moat applies interest and your payment to the remaining balance. Turn off to keep the balance fixed until you edit it.",
                        isOn: $autoUpdateBalance
                    )
                }

                if let onDelete {
                    FinancialProfileSheetDeleteSection(action: onDelete)
                }
            }
            .navigationTitle(liability == nil ? "Add Liability" : "Edit Liability")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        onSave(buildLiability())
                    }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
    }

    private func buildLiability() -> ProfileLiability {
        let parsedBalance = AmountInputFormatter.parse(balance) ?? 0
        let schedule = resolveLiabilityAmortizationSchedule(
            autoUpdateBalance: autoUpdateBalance,
            loanStartDate: loanStartDate.isEmpty ? nil : loanStartDate,
            previous: liability,
            balance: parsedBalance
        )
        return ProfileLiability(
            id: liability?.id ?? newId("liability"),
            name: name,
            type: type.isEmpty ? "Other" : type,
            balance: parsedBalance,
            interestRate: AmountInputFormatter.parse(interestRate) ?? 0,
            monthlyPayment: AmountInputFormatter.parse(monthlyPayment) ?? 0,
            linkedAsset: linkedAsset.isEmpty ? nil : linkedAsset,
            payoffDate: liability?.payoffDate,
            loanStartDate: loanStartDate.isEmpty ? nil : loanStartDate,
            loanTermYears: loanTermYears,
            autoUpdateBalance: schedule.autoUpdateBalance,
            lastBalanceAmortizedAt: schedule.lastBalanceAmortizedAt,
            nextBalanceAmortizationDueAt: schedule.nextBalanceAmortizationDueAt,
            includeInNetWorth: includeInNetWorth,
            includeInForecast: includeInForecast
        )
    }
}

private struct LiabilityAmortizationSchedule {
    let autoUpdateBalance: Bool?
    let lastBalanceAmortizedAt: String?
    let nextBalanceAmortizationDueAt: String?
}

private func resolveLiabilityAmortizationSchedule(
    autoUpdateBalance: Bool,
    loanStartDate: String?,
    previous: ProfileLiability?,
    balance: Double
) -> LiabilityAmortizationSchedule {
    guard autoUpdateBalance else {
        return LiabilityAmortizationSchedule(
            autoUpdateBalance: false,
            lastBalanceAmortizedAt: nil,
            nextBalanceAmortizationDueAt: nil
        )
    }

    let now = Date()
    let balanceChanged = previous.map { abs($0.balance - balance) > 0.000_1 } ?? false
    let wasOff = previous?.autoUpdateBalance != true
    let needsReset = previous == nil || wasOff || balanceChanged

    if needsReset {
        let anchor = parseISODateOnly(loanStartDate) ?? now
        return LiabilityAmortizationSchedule(
            autoUpdateBalance: true,
            lastBalanceAmortizedAt: balanceChanged ? isoTimestamp(now) : previous?.lastBalanceAmortizedAt,
            nextBalanceAmortizationDueAt: isoTimestamp(addOneCalendarMonth(to: anchor, preservingDayOf: anchor))
        )
    }

    return LiabilityAmortizationSchedule(
        autoUpdateBalance: true,
        lastBalanceAmortizedAt: previous?.lastBalanceAmortizedAt,
        nextBalanceAmortizationDueAt: previous?.nextBalanceAmortizationDueAt
    )
}

private func parseISODateOnly(_ value: String?) -> Date? {
    guard let value, !value.isEmpty else { return nil }
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    return formatter.date(from: value)
}

private func isoTimestamp(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
}

private func addOneCalendarMonth(to from: Date, preservingDayOf anchor: Date) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    let day = calendar.component(.day, from: anchor)
    guard let advanced = calendar.date(byAdding: .month, value: 1, to: from) else {
        return from
    }
    var components = calendar.dateComponents([.year, .month], from: advanced)
    let range = calendar.range(of: .day, in: .month, for: advanced)
    let clampedDay = min(day, range?.count ?? day)
    components.day = clampedDay
    return calendar.date(from: components) ?? advanced
}

/// Opens native Plaid Link from financial-profile collection sheets.
/// Restore `ConnectInstitutionSheet` when MX / Finicity routing is ready — do not delete it.
@MainActor
private func connectSyncedAccountFromProfileSheet(
    isDemoMode: Bool,
    onAccountsRefresh: (() async -> Void)?
) async -> String? {
    if isDemoMode {
        return "Sample data cannot run a Plaid connect flow. Exit demo mode to connect a real institution."
    }

    do {
        let coordinator = ProviderLaunchCoordinator()
        _ = try await coordinator.launchDirectPlaid()
        await onAccountsRefresh?()
        return nil
    } catch {
        if error as? PlaidLinkError == .cancelled {
            return nil
        }
        return error.localizedDescription
    }
}
