import SwiftUI

struct FinancialProfileEditProfileSheet: View {
    let profile: FinancialProfileRecord
    let onSave: (FinancialProfileRecord) -> Void
    let onCancel: () -> Void

    @State private var householdType: String
    @State private var location: String
    @State private var lifeStage: String
    @State private var employmentType: String
    @State private var planningHorizon: String
    @State private var riskTolerance: String
    @State private var dependentsCount: Int
    @State private var housingStatus: String

    init(
        profile: FinancialProfileRecord,
        onSave: @escaping (FinancialProfileRecord) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.profile = profile
        self.onSave = onSave
        self.onCancel = onCancel
        _householdType = State(initialValue: profile.householdType)
        _location = State(initialValue: profile.location)
        _lifeStage = State(initialValue: profile.lifeStage)
        _employmentType = State(initialValue: profile.employmentType)
        _planningHorizon = State(initialValue: profile.planningHorizon)
        _riskTolerance = State(initialValue: profile.riskTolerance)
        _dependentsCount = State(initialValue: profile.dependentsCount)
        _housingStatus = State(initialValue: profile.housingStatus)
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Household type", selection: $householdType) {
                    ForEach(FinancialProfileFieldOptions.householdTypes, id: \.self) { Text($0).tag($0) }
                }
                Picker("State / country", selection: $location) {
                    Text("Not set").tag("")
                    ForEach(FinancialProfileFieldOptions.usStates, id: \.self) { Text($0).tag($0) }
                }
                Picker("Life stage", selection: $lifeStage) {
                    ForEach(FinancialProfileFieldOptions.lifeStages, id: \.self) { Text($0).tag($0) }
                }
                Picker("Employment type", selection: $employmentType) {
                    ForEach(FinancialProfileFieldOptions.employmentTypes, id: \.self) { Text($0).tag($0) }
                }
                Picker("Planning horizon", selection: $planningHorizon) {
                    ForEach(FinancialProfileFieldOptions.planningHorizons, id: \.self) { Text($0).tag($0) }
                }
                Picker("Risk tolerance", selection: $riskTolerance) {
                    ForEach(FinancialProfileFieldOptions.riskTolerances, id: \.self) { Text($0).tag($0) }
                }
                Stepper("Dependents: \(dependentsCount)", value: $dependentsCount, in: 0...20)
                Picker("Housing status", selection: $housingStatus) {
                    ForEach(FinancialProfileFieldOptions.housingStatuses, id: \.self) { Text($0).tag($0) }
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        onSave(
                            FinancialProfileRecord(
                                id: profile.id,
                                householdType: householdType,
                                location: location,
                                lifeStage: lifeStage,
                                employmentType: employmentType,
                                planningHorizon: planningHorizon,
                                riskTolerance: riskTolerance,
                                dependentsCount: dependentsCount,
                                housingStatus: housingStatus,
                                lastUpdated: currentDateString(),
                                source: profile.source
                            )
                        )
                    }
                }
            }
        }
        .presentationDetents([.large])
    }
}

struct FinancialProfileEditTaxesSheet: View {
    let taxProfile: TaxProfile
    let onSave: (TaxProfile) -> Void
    let onCancel: () -> Void

    @State private var filingStatus: String
    @State private var taxYear: Int
    @State private var estimatedFederalTaxBracket: String
    @State private var estimatedStateTaxRate: String
    @State private var totalAnnualIncome: String
    @State private var taxableIncomeEstimate: String
    @State private var deductionStrategy: String
    @State private var selfEmployedIncome: Bool
    @State private var rentalIncome: Bool

    init(
        taxProfile: TaxProfile,
        onSave: @escaping (TaxProfile) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.taxProfile = taxProfile
        self.onSave = onSave
        self.onCancel = onCancel
        _filingStatus = State(initialValue: taxProfile.filingStatus)
        _taxYear = State(initialValue: taxProfile.taxYear)
        _estimatedFederalTaxBracket = State(initialValue: taxProfile.estimatedFederalTaxBracket)
        _estimatedStateTaxRate = State(initialValue: taxProfile.estimatedStateTaxRate)
        _totalAnnualIncome = State(initialValue: AmountInputFormatter.format(taxProfile.totalAnnualIncome))
        _taxableIncomeEstimate = State(initialValue: AmountInputFormatter.format(taxProfile.taxableIncomeEstimate))
        _deductionStrategy = State(initialValue: taxProfile.deductionStrategy)
        _selfEmployedIncome = State(initialValue: taxProfile.selfEmployedIncome)
        _rentalIncome = State(initialValue: taxProfile.rentalIncome)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Filing") {
                    Picker("Filing status", selection: $filingStatus) {
                        ForEach(FinancialProfileFieldOptions.taxFilingStatuses, id: \.self) { Text($0).tag($0) }
                    }
                    Stepper(value: $taxYear, in: 2020...2100) {
                        Text("Tax year: \(taxYear, format: .number.grouping(.never))")
                    }
                    Picker("Deduction strategy", selection: $deductionStrategy) {
                        ForEach(FinancialProfileFieldOptions.deductionStrategies, id: \.self) { Text($0).tag($0) }
                    }
                }
                Section("Income") {
                    FinancialProfileLabeledTextField(
                        title: "Total annual income",
                        helpMessage: "Your total income before taxes for the year. Moat uses this for tax and forecast context.",
                        placeholder: "0",
                        text: $totalAnnualIncome,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLabeledTextField(
                        title: "Taxable income estimate",
                        helpMessage: "The portion of your income expected to be taxed after deductions and adjustments.",
                        placeholder: "0",
                        text: $taxableIncomeEstimate,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                }
                Section("Rates") {
                    FinancialProfileLabeledTextField(
                        title: "Federal bracket",
                        helpMessage: "Your estimated federal marginal tax bracket, such as 24%.",
                        placeholder: "24%",
                        text: $estimatedFederalTaxBracket
                    )
                    FinancialProfileLabeledTextField(
                        title: "State tax rate",
                        helpMessage: "Your estimated state income tax rate, if applicable.",
                        placeholder: "5%",
                        text: $estimatedStateTaxRate
                    )
                }
                Section("Other") {
                    Toggle("Self-employed income", isOn: $selfEmployedIncome)
                        .moatToggleStyle()
                    Toggle("Rental income", isOn: $rentalIncome)
                        .moatToggleStyle()
                }
            }
            .navigationTitle("Edit Taxes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        onSave(
                            TaxProfile(
                                filingStatus: filingStatus,
                                taxYear: taxYear,
                                estimatedFederalTaxBracket: estimatedFederalTaxBracket,
                                estimatedStateTaxRate: estimatedStateTaxRate,
                                totalAnnualIncome: AmountInputFormatter.parse(totalAnnualIncome) ?? 0,
                                taxableIncomeEstimate: AmountInputFormatter.parse(taxableIncomeEstimate) ?? 0,
                                deductionStrategy: deductionStrategy,
                                selfEmployedIncome: selfEmployedIncome,
                                rentalIncome: rentalIncome,
                                lastUpdated: currentDateString()
                            )
                        )
                    }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
    }
}

struct FinancialProfileEditAssumptionsSheet: View {
    let assumptions: ForecastAssumptions
    let onSave: (ForecastAssumptions) -> Void
    let onCancel: () -> Void

    @State private var inflationRate: String
    @State private var incomeGrowthRate: String
    @State private var expenseGrowthRate: String
    @State private var investmentReturnRate: String
    @State private var realEstateAppreciationRate: String
    @State private var defaultCashYield: String
    @State private var retirementAge: String
    @State private var forecastStyle: String

    init(
        assumptions: ForecastAssumptions,
        onSave: @escaping (ForecastAssumptions) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.assumptions = assumptions
        self.onSave = onSave
        self.onCancel = onCancel
        _inflationRate = State(initialValue: formatPercentInput(assumptions.inflationRate))
        _incomeGrowthRate = State(initialValue: formatPercentInput(assumptions.incomeGrowthRate))
        _expenseGrowthRate = State(initialValue: formatPercentInput(assumptions.expenseGrowthRate))
        _investmentReturnRate = State(initialValue: formatPercentInput(assumptions.investmentReturnRate))
        _realEstateAppreciationRate = State(initialValue: formatPercentInput(assumptions.realEstateAppreciationRate))
        _defaultCashYield = State(initialValue: formatPercentInput(assumptions.defaultCashYield))
        _retirementAge = State(initialValue: assumptions.retirementAge.map(String.init) ?? "")
        _forecastStyle = State(initialValue: assumptions.forecastStyle)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Forecast defaults") {
                    FinancialProfileLabeledTextField(
                        title: "Inflation rate (%)",
                        helpMessage: "The annual rate you expect prices and living costs to rise. Moat uses this to project future expenses.",
                        placeholder: "3",
                        text: $inflationRate,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true,
                        fractionDigits: 2
                    )
                    FinancialProfileLabeledTextField(
                        title: "Income growth rate (%)",
                        helpMessage: "How much you expect your total income to grow each year, on top of inflation.",
                        placeholder: "3",
                        text: $incomeGrowthRate,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true,
                        fractionDigits: 2
                    )
                    FinancialProfileLabeledTextField(
                        title: "Expense growth rate (%)",
                        helpMessage: "How much you expect your spending to grow each year, separate from inflation adjustments.",
                        placeholder: "3",
                        text: $expenseGrowthRate,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true,
                        fractionDigits: 2
                    )
                    FinancialProfileLabeledTextField(
                        title: "Investment return rate (%)",
                        helpMessage: "The default annual return Moat assumes for investments that do not have their own expected return set.",
                        placeholder: "7",
                        text: $investmentReturnRate,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true,
                        fractionDigits: 2
                    )
                    FinancialProfileLabeledTextField(
                        title: "Real estate appreciation (%)",
                        helpMessage: "The annual rate you expect property values to increase across your real estate holdings.",
                        placeholder: "3",
                        text: $realEstateAppreciationRate,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true,
                        fractionDigits: 2
                    )
                    FinancialProfileLabeledTextField(
                        title: "Default cash yield (%)",
                        helpMessage: "The annual return Moat assumes for cash and savings accounts without a specific rate.",
                        placeholder: "4",
                        text: $defaultCashYield,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true,
                        fractionDigits: 2
                    )
                    FinancialProfileLabeledTextField(
                        title: "Retirement age",
                        helpMessage: "The age you plan to retire. Moat uses this to shape long-term income and contribution projections. Leave blank if not applicable.",
                        placeholder: "65",
                        text: $retirementAge,
                        keyboardType: .numberPad
                    )
                    FinancialProfileLabeledPicker(
                        title: "Forecast style",
                        helpMessage: "Sets preset growth and return assumptions. Conservative uses lower growth, Aggressive uses higher growth, and Balanced is a middle ground.",
                        selection: $forecastStyle,
                        selectionTitle: forecastStyle
                    ) {
                        ForEach(FinancialProfileFieldOptions.forecastStyles, id: \.self) { Text($0).tag($0) }
                    }
                }
            }
            .navigationTitle("Edit Assumptions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        onSave(
                            ForecastAssumptions(
                                inflationRate: AmountInputFormatter.parse(inflationRate) ?? assumptions.inflationRate,
                                incomeGrowthRate: AmountInputFormatter.parse(incomeGrowthRate) ?? assumptions.incomeGrowthRate,
                                expenseGrowthRate: AmountInputFormatter.parse(expenseGrowthRate) ?? assumptions.expenseGrowthRate,
                                investmentReturnRate: AmountInputFormatter.parse(investmentReturnRate) ?? assumptions.investmentReturnRate,
                                realEstateAppreciationRate: AmountInputFormatter.parse(realEstateAppreciationRate) ?? assumptions.realEstateAppreciationRate,
                                defaultCashYield: AmountInputFormatter.parse(defaultCashYield) ?? assumptions.defaultCashYield,
                                retirementAge: Int(retirementAge),
                                forecastStyle: forecastStyle,
                                lastUpdated: currentDateString()
                            )
                        )
                    }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.large])
    }
}

struct FinancialProfilePlanningNoteSheet: View {
    let note: PlanningNote?
    let onSave: (PlanningNote) -> Void
    let onCancel: () -> Void
    let onDelete: (() -> Void)?

    @State private var title: String
    @State private var bodyText: String
    @State private var tag: String

    init(
        note: PlanningNote?,
        onSave: @escaping (PlanningNote) -> Void,
        onCancel: @escaping () -> Void,
        onDelete: (() -> Void)? = nil
    ) {
        self.note = note
        self.onSave = onSave
        self.onCancel = onCancel
        self.onDelete = onDelete
        _title = State(initialValue: note?.title ?? "")
        _bodyText = State(initialValue: note?.body ?? "")
        _tag = State(initialValue: note?.tag ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: MoatTheme.Spacing.xLarge) {
                    MoatCard {
                        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                            FinancialProfileLabeledTextField(
                                title: "Title",
                                helpMessage: "A short label for this note so you can find it later.",
                                placeholder: "e.g. House down payment goal",
                                text: $title
                            )
                            FinancialProfileLabeledTextField(
                                title: "Tag",
                                helpMessage: "An optional tag to group related notes, like Goals or Taxes.",
                                placeholder: "Optional",
                                text: $tag
                            )
                            FinancialProfileLabeledTextEditor(
                                title: "Note",
                                helpMessage: "Goals, preferences, or context Moat should remember for personalized assistance.",
                                text: $bodyText,
                                minHeight: 240
                            )
                        }
                    }

                    if let onDelete {
                        Button(role: .destructive, action: onDelete) {
                            Text("Delete")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.moatDestructive)
                    }
                }
                .padding(MoatTheme.Spacing.large)
            }
            .moatPageBackground()
            .navigationTitle(note == nil ? "Add Note" : "Edit Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        HapticFeedback.saveOrSubmit()
                        onSave(
                            PlanningNote(
                                id: note?.id ?? newId("note"),
                                title: title,
                                body: bodyText,
                                tag: tag.isEmpty ? nil : tag,
                                lastUpdated: currentDateString()
                            )
                        )
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
