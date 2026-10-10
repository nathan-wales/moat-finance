import SwiftUI

enum InsuranceIntakeStep: Int, CaseIterable, Identifiable {
    case type
    case assistance
    case basics
    case premium
    case peopleAssets
    case coverage
    case review

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .type: "Policy type"
        case .assistance: "Assisted intake"
        case .basics: "Policy basics"
        case .premium: "Premium and renewal"
        case .peopleAssets: "People and assets"
        case .coverage: "Coverage details"
        case .review: "Review and submit"
        }
    }

    var instruction: String {
        switch self {
        case .type: "Choose a policy type"
        case .assistance: "On iOS, use manual intake to enter planning-friendly policy details."
        case .basics: "Enter the provider and policy name."
        case .premium: "Add premium and renewal details."
        case .peopleAssets: "Link covered people and assets when relevant."
        case .coverage: "Add primary coverage and deductible amounts."
        case .review: "Review your policy before saving."
        }
    }
}

struct InsurancePolicyFormValues {
    var id: String
    var type: InsurancePolicyType
    var providerName: String
    var policyName: String
    var policyNickname: String
    var status: String
    var renewalDate: String
    var premiumAmount: String
    var premiumCadence: String
    var primaryCoverageLimit: String
    var deductibleAmount: String
    var linkedAssetLabel: String
    var coveredPersonLabel: String
    var useManualIntake: Bool
}

func createEmptyInsuranceFormValues(id: String = newId("policy")) -> InsurancePolicyFormValues {
    InsurancePolicyFormValues(
        id: id,
        type: .other,
        providerName: "",
        policyName: "New policy",
        policyNickname: "",
        status: "active",
        renewalDate: "",
        premiumAmount: "",
        premiumCadence: "monthly",
        primaryCoverageLimit: "",
        deductibleAmount: "",
        linkedAssetLabel: "",
        coveredPersonLabel: "",
        useManualIntake: true
    )
}

func insuranceFormValues(from policy: InsurancePolicy) -> InsurancePolicyFormValues {
    switch policy {
    case .legacy(let legacy):
        var values = createEmptyInsuranceFormValues(id: legacy.id)
        values.policyName = legacy.name
        values.providerName = legacy.provider
        values.premiumAmount = AmountInputFormatter.format(legacy.premium)
        values.premiumCadence = legacyPremiumCadenceToForm(legacy.frequency)
        if let coverage = legacy.coverageAmount {
            values.primaryCoverageLimit = AmountInputFormatter.format(coverage)
        }
        values.linkedAssetLabel = legacy.linkedAsset ?? ""
        values.renewalDate = legacy.renewalDate ?? ""
        values.type = legacyInsuranceTypeToForm(legacy.type)
        return values
    case .v2(let policy):
        var values = createEmptyInsuranceFormValues(id: policy.id)
        values.type = policy.type
        values.providerName = policy.providerName
        values.policyName = policy.policyName
        values.policyNickname = policy.policyNickname ?? ""
        values.status = policy.status
        values.renewalDate = policy.renewalDate ?? ""
        values.premiumAmount = policy.premiumAmount.map { AmountInputFormatter.format($0) } ?? ""
        values.premiumCadence = policy.premiumCadence ?? "monthly"
        if let limit = policy.coverages.first?.limitAmount {
            values.primaryCoverageLimit = AmountInputFormatter.format(limit)
        }
        if let deductible = policy.coverages.first?.deductibleAmount {
            values.deductibleAmount = AmountInputFormatter.format(deductible)
        }
        values.linkedAssetLabel = policy.assets.first?.label ?? ""
        values.coveredPersonLabel = policy.parties.first?.displayName ?? ""
        return values
    }
}

func formValuesToInsurancePolicy(_ values: InsurancePolicyFormValues) -> InsurancePolicy {
    let coverages: [InsuranceCoverage] = {
        var items: [InsuranceCoverage] = []
        if let limit = AmountInputFormatter.parse(values.primaryCoverageLimit), limit > 0 {
            items.append(
                InsuranceCoverage(
                    id: "\(values.id)-primary",
                    coverageType: "primary",
                    label: "Primary coverage",
                    limitAmount: limit,
                    deductibleAmount: AmountInputFormatter.parse(values.deductibleAmount),
                    sensitivityTier: .low
                )
            )
        }
        return items
    }()

    let parties: [InsuranceParty] = values.coveredPersonLabel.isEmpty ? [] : [
        InsuranceParty(
            id: "\(values.id)-party",
            role: "insured",
            displayName: values.coveredPersonLabel,
            sensitivityTier: "low"
        ),
    ]

    let assets: [InsuranceCoveredAsset] = values.linkedAssetLabel.isEmpty ? [] : [
        InsuranceCoveredAsset(
            id: "\(values.id)-asset",
            label: values.linkedAssetLabel,
            assetType: values.type == .auto ? "vehicle" : values.type == .boat ? "boat" : "other",
            sensitivityTier: "low"
        ),
    ]

    let policy = InsurancePolicyV2(
        schemaVersion: 2,
        id: values.id,
        type: values.type,
        providerName: values.providerName,
        policyName: values.policyName,
        policyNickname: values.policyNickname.isEmpty ? nil : values.policyNickname,
        status: values.status,
        renewalDate: values.renewalDate.isEmpty ? nil : values.renewalDate,
        premiumAmount: AmountInputFormatter.parse(values.premiumAmount),
        premiumCadence: values.premiumCadence,
        source: "manual",
        storageScope: .cloud,
        sensitivityTier: .low,
        coverages: coverages,
        parties: parties,
        assets: assets,
        details: InsuranceTypedDetails(type: values.type.rawValue),
        review: InsuranceReviewState(completeness: coverages.isEmpty ? "basic" : "partial", missingFields: [])
    )

    return .v2(policy)
}

struct FinancialProfileInsuranceIntakeSheet: View {
    let existingPolicy: InsurancePolicy?
    let assets: [ProfileAsset]
    let onSave: (InsurancePolicy) -> Void
    let onCancel: () -> Void
    let onDelete: (() -> Void)?

    @State private var step: InsuranceIntakeStep
    @State private var values: InsurancePolicyFormValues
    @State private var blockedReasons: [InsuranceCloudBlockReason] = []
    @State private var showBlockedSheet = false

    init(
        existingPolicy: InsurancePolicy?,
        assets: [ProfileAsset],
        prefilledFormValues: InsurancePolicyFormValues? = nil,
        initialStep: InsuranceIntakeStep? = nil,
        onSave: @escaping (InsurancePolicy) -> Void,
        onCancel: @escaping () -> Void,
        onDelete: (() -> Void)? = nil
    ) {
        self.existingPolicy = existingPolicy
        self.assets = assets
        self.onSave = onSave
        self.onCancel = onCancel
        self.onDelete = onDelete
        _values = State(
            initialValue: existingPolicy.map(insuranceFormValues(from:)) ?? prefilledFormValues ?? createEmptyInsuranceFormValues()
        )
        _step = State(initialValue: initialStep ?? .type)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ProgressView(value: Double(step.rawValue + 1), total: Double(InsuranceIntakeStep.allCases.count))
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
            .navigationTitle(existingPolicy == nil ? "Add Policy" : "Edit Policy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                MoatKeyboardDismissToolbar()
            }
            .sheet(isPresented: $showBlockedSheet) {
                FinancialProfileInsuranceCloudBlockedSheet(
                    reasons: blockedReasons,
                    onDismiss: { showBlockedSheet = false }
                )
            }
        }
        .presentationDetents([.large])
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case .type:
            insurancePolicyTypeStep
        case .assistance:
            MoatCard {
                Toggle("Enter details manually", isOn: $values.useManualIntake)
                    .moatToggleStyle()
            }
        case .basics:
            MoatCard {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    FinancialProfileLabeledTextField(
                        title: "Provider",
                        helpMessage: "The insurance company or carrier.",
                        placeholder: "Provider",
                        text: $values.providerName
                    )
                    FinancialProfileLabeledTextField(
                        title: "Policy name",
                        helpMessage: "The official name of this policy.",
                        placeholder: "Policy name",
                        text: $values.policyName
                    )
                    FinancialProfileLabeledTextField(
                        title: "Nickname",
                        helpMessage: "An optional short label for quick reference.",
                        placeholder: "Optional",
                        text: $values.policyNickname
                    )
                }
            }
        case .premium:
            MoatCard {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    FinancialProfileLabeledTextField(
                        title: "Premium amount",
                        helpMessage: "The recurring premium for this policy.",
                        placeholder: "0",
                        text: $values.premiumAmount,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLabeledPicker(
                        title: "Premium cadence",
                        helpMessage: "How often this premium is billed.",
                        selection: $values.premiumCadence,
                        selectionTitle: FinancialProfileFieldOptions.premiumCadenceLabel(for: values.premiumCadence)
                    ) {
                        ForEach(FinancialProfileFieldOptions.premiumCadenceOptions) { option in
                            Text(option.label).tag(option.value)
                        }
                    }
                    FinancialProfileLabeledDateField(
                        title: "Renewal date",
                        helpMessage: "When this policy renews. Leave blank if unknown.",
                        dateString: $values.renewalDate,
                        isOptional: true
                    )
                }
            }
        case .peopleAssets:
            MoatCard {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    FinancialProfileLabeledTextField(
                        title: "Covered person",
                        helpMessage: "A label for the person covered by this policy.",
                        placeholder: "Optional",
                        text: $values.coveredPersonLabel
                    )
                    FinancialProfileLabeledPicker(
                        title: "Linked asset",
                        helpMessage: "An asset this policy covers, when relevant.",
                        selection: $values.linkedAssetLabel,
                        selectionTitle: values.linkedAssetLabel.isEmpty ? "None" : values.linkedAssetLabel
                    ) {
                        Text("None").tag("")
                        ForEach(filterAssetsForInsuranceType(assets, insuranceType: values.type.rawValue), id: \.id) { asset in
                            Text(asset.name).tag(asset.name)
                        }
                    }
                }
            }
        case .coverage:
            MoatCard {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    FinancialProfileLabeledTextField(
                        title: "Primary coverage limit",
                        helpMessage: "The main coverage limit for this policy.",
                        placeholder: "0",
                        text: $values.primaryCoverageLimit,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                    FinancialProfileLabeledTextField(
                        title: "Deductible",
                        helpMessage: "The deductible amount for this policy.",
                        placeholder: "0",
                        text: $values.deductibleAmount,
                        keyboardType: .decimalPad,
                        formatsGroupedNumber: true
                    )
                }
            }
        case .review:
            MoatCard {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                    FinancialProfileDetailRow(title: "Type", value: FinancialProfileFieldOptions.insurancePolicyTypeLabel(for: values.type.rawValue))
                    FinancialProfileDetailRow(title: "Provider", value: values.providerName.isEmpty ? "Not set" : values.providerName)
                    FinancialProfileDetailRow(title: "Policy", value: values.policyNickname.isEmpty ? values.policyName : values.policyNickname)
                    if !values.premiumAmount.isEmpty {
                        FinancialProfileDetailRow(title: "Premium", value: CurrencyFormatter.formatCompact(AmountInputFormatter.parse(values.premiumAmount) ?? 0))
                    }
                }
            }
        }
    }

    private var insurancePolicyTypeStep: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
            ForEach(FinancialProfileFieldOptions.insurancePolicyTypePickerOptions) { option in
                let selected = values.type == option.type

                Button {
                    values.type = option.type
                } label: {
                    VStack(spacing: MoatTheme.Spacing.small) {
                        Image(systemName: option.systemImage)
                            .font(.title3.weight(.semibold))
                        Text(option.label)
                            .font(.subheadline.weight(.semibold))
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, minHeight: 92)
                    .padding(MoatTheme.Spacing.medium)
                    .foregroundStyle(selected ? MoatTheme.ColorToken.accent : .primary)
                    .background(selected ? MoatTheme.ColorToken.accent.opacity(0.12) : MoatTheme.ColorToken.surface)
                    .overlay {
                        RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                            .stroke(selected ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.gray200, lineWidth: 4)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                }
                .buttonStyle(.plain)
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
            if step != .type {
                Button("Back") {
                    step = InsuranceIntakeStep(rawValue: step.rawValue - 1) ?? .type
                }
                .buttonStyle(.moatSecondary)
            }

            Group {
                if step == .review {
                    Button("Save", action: {
                        HapticFeedback.saveOrSubmit()
                        attemptSave()
                    })
                } else {
                    Button("Next") {
                        step = InsuranceIntakeStep(rawValue: step.rawValue + 1) ?? .review
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .buttonStyle(.moatPrimary)
        }
        .padding(MoatTheme.Spacing.large)
        .background(MoatTheme.ColorToken.appBackground)
    }

    private func attemptSave() {
        let policy = formValuesToInsurancePolicy(values)
        let reasons = getInsuranceBlockedCloudReasons(policy: policy)
        if !reasons.isEmpty {
            blockedReasons = reasons
            showBlockedSheet = true
            return
        }
        onSave(policy)
    }
}

struct FinancialProfileInsuranceCloudBlockedSheet: View {
    let reasons: [InsuranceCloudBlockReason]
    let onDismiss: () -> Void

    var body: some View {
        MoatGlassSheet(title: "Cannot save to Moat Cloud") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(MoatTheme.ColorToken.warning)

                Text("This policy includes details that belong in Moat Private Desktop. Remove sensitive fields or use desktop for local-private storage.")
                    .foregroundStyle(.secondary)

                ForEach(Array(reasons.enumerated()), id: \.offset) { _, reason in
                    Label(reason.userFacingMessage, systemImage: "lock.shield")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        } footer: {
            Button("Done", action: onDismiss)
                .buttonStyle(.moatPrimary)
                .frame(maxWidth: .infinity)
        }
    }
}

private func legacyInsuranceTypeToForm(_ type: String) -> InsurancePolicyType {
    switch type {
    case "Auto": .auto
    case "Boat": .boat
    case "Dental": .dental
    case "Disability": .disability
    case "Health": .health
    case "Home": .homeowners
    case "Life": .life
    case "Renters": .renters
    case "Umbrella": .umbrella
    case "Vision": .vision
    default: .other
    }
}

private func legacyPremiumCadenceToForm(_ frequency: String) -> String {
    switch frequency {
    case "Annual": "annual"
    case "Monthly": "monthly"
    case "Quarterly": "quarterly"
    case "Semiannual": "semiannual"
    default: "unknown"
    }
}
