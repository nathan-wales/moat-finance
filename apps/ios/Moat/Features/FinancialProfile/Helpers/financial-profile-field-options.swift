import Foundation

struct FinancialProfileLabeledOption: Identifiable, Equatable, Hashable {
    let value: String
    let label: String

    var id: String { value }
}

enum FinancialProfileFieldOptions {
    static let usStates: [String] = [
        "Alabama",
        "Alaska",
        "Arizona",
        "Arkansas",
        "California",
        "Colorado",
        "Connecticut",
        "Delaware",
        "Florida",
        "Georgia",
        "Hawaii",
        "Idaho",
        "Illinois",
        "Indiana",
        "Iowa",
        "Kansas",
        "Kentucky",
        "Louisiana",
        "Maine",
        "Maryland",
        "Massachusetts",
        "Michigan",
        "Minnesota",
        "Mississippi",
        "Missouri",
        "Montana",
        "Nebraska",
        "Nevada",
        "New Hampshire",
        "New Jersey",
        "New Mexico",
        "New York",
        "North Carolina",
        "North Dakota",
        "Ohio",
        "Oklahoma",
        "Oregon",
        "Pennsylvania",
        "Rhode Island",
        "South Carolina",
        "South Dakota",
        "Tennessee",
        "Texas",
        "Utah",
        "Vermont",
        "Virginia",
        "Washington",
        "West Virginia",
        "Wisconsin",
        "Wyoming",
    ]

    static let householdTypes = ["Individual", "Couple", "Family"]

    static let lifeStages = ["Early career", "Family", "Pre-retirement", "Retired", "Other"]

    static let employmentTypes = [
        "W-2",
        "Freelancer",
        "Business owner",
        "Retired",
        "Student",
        "Other",
    ]

    static let planningHorizons = ["1 year", "5 years", "10 years", "20+ years"]

    static let riskTolerances = ["Conservative", "Balanced", "Aggressive"]

    static let housingStatuses = ["Homeowner", "Renter", "Other"]

    static let assetTypes = [
        "Real estate",
        "Vehicle",
        "Boat",
        "Business",
        "Personal property",
        "Collectible",
        "Cash-like asset",
        "Other",
    ]

    static let otherAssetTypes = [
        "Vehicle",
        "Boat",
        "Business",
        "Personal property",
        "Collectible",
        "Cash-like asset",
        "Other",
    ]

    static let accountTypes = [
        "Checking",
        "Savings",
        "Credit Card",
        "Loan",
        "Mortgage",
        "Brokerage",
        "Investment",
        "Stocks",
        "Roth IRA",
        "IRA",
        "401(k)",
        "HSA",
        "529",
        "Other",
    ]

    static let investmentTypes = [
        "Stocks",
        "Roth IRA",
        "IRA",
        "401(k)",
        "HSA",
        "529",
        "Real Estate",
        "Brokerage",
        "Other",
    ]

    static let taxFilingStatuses = [
        "Single",
        "Married filing jointly",
        "Married filing separately",
        "Head of household",
    ]

    static let deductionStrategies = ["Standard", "Itemized"]

    static let forecastStyles = ["Conservative", "Balanced", "Aggressive"]

    static let legacyInsurancePolicyTypes: [FinancialProfileLabeledOption] = [
        FinancialProfileLabeledOption(value: "Health", label: "Health"),
        FinancialProfileLabeledOption(value: "Dental", label: "Dental"),
        FinancialProfileLabeledOption(value: "Vision", label: "Vision"),
        FinancialProfileLabeledOption(value: "Auto", label: "Auto"),
        FinancialProfileLabeledOption(value: "Home", label: "Home"),
        FinancialProfileLabeledOption(value: "Renters", label: "Renters"),
        FinancialProfileLabeledOption(value: "Life", label: "Life"),
        FinancialProfileLabeledOption(value: "Disability", label: "Disability"),
        FinancialProfileLabeledOption(value: "Umbrella", label: "Umbrella"),
        FinancialProfileLabeledOption(value: "Boat", label: "Boat"),
        FinancialProfileLabeledOption(value: "Other", label: "Other"),
    ]

    static let insurancePolicyTypeOptions: [FinancialProfileLabeledOption] = [
        FinancialProfileLabeledOption(value: InsurancePolicyType.auto.rawValue, label: "Auto"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.health.rawValue, label: "Health"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.dental.rawValue, label: "Dental"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.vision.rawValue, label: "Vision"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.life.rawValue, label: "Life"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.disability.rawValue, label: "Disability"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.homeowners.rawValue, label: "Homeowners"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.renters.rawValue, label: "Renters"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.longTermCare.rawValue, label: "Long-term care"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.umbrella.rawValue, label: "Umbrella"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.boat.rawValue, label: "Boat"),
        FinancialProfileLabeledOption(value: InsurancePolicyType.other.rawValue, label: "Other"),
    ]

    static let insurancePolicyTypePickerOptions: [InsurancePolicyTypePickerOption] = [
        InsurancePolicyTypePickerOption(type: .auto, label: "Auto", systemImage: "car.fill"),
        InsurancePolicyTypePickerOption(type: .health, label: "Health", systemImage: "cross.case.fill"),
        InsurancePolicyTypePickerOption(type: .dental, label: "Dental", systemImage: "mouth.fill"),
        InsurancePolicyTypePickerOption(type: .vision, label: "Vision", systemImage: "eye.fill"),
        InsurancePolicyTypePickerOption(type: .life, label: "Life", systemImage: "heart.fill"),
        InsurancePolicyTypePickerOption(type: .disability, label: "Disability", systemImage: "figure.roll"),
        InsurancePolicyTypePickerOption(type: .homeowners, label: "Homeowners", systemImage: "house.fill"),
        InsurancePolicyTypePickerOption(type: .renters, label: "Renters", systemImage: "key.fill"),
        InsurancePolicyTypePickerOption(type: .longTermCare, label: "Long-term care", systemImage: "shield.lefthalf.filled"),
        InsurancePolicyTypePickerOption(type: .umbrella, label: "Umbrella", systemImage: "umbrella.fill"),
        InsurancePolicyTypePickerOption(type: .boat, label: "Boat", systemImage: "sailboat.fill"),
        InsurancePolicyTypePickerOption(type: .other, label: "Other", systemImage: "questionmark"),
    ]

    static let premiumCadenceOptions: [FinancialProfileLabeledOption] = [
        FinancialProfileLabeledOption(value: "monthly", label: "Monthly"),
        FinancialProfileLabeledOption(value: "quarterly", label: "Quarterly"),
        FinancialProfileLabeledOption(value: "semiannual", label: "Semiannual"),
        FinancialProfileLabeledOption(value: "annual", label: "Annual"),
        FinancialProfileLabeledOption(value: "oneTime", label: "One-time"),
        FinancialProfileLabeledOption(value: "unknown", label: "Unknown"),
    ]

    static let legacyPremiumFrequencies = ["Monthly", "Quarterly", "Semiannual", "Annual"]

    static func insurancePolicyTypeLabel(for rawValue: String) -> String {
        if let type = InsurancePolicyType(rawValue: rawValue) {
            return insurancePolicyTypeOptions.first(where: { $0.value == type.rawValue })?.label ?? rawValue
        }
        return legacyInsurancePolicyTypes.first(where: { $0.value == rawValue })?.label ?? rawValue
    }

    static func premiumCadenceLabel(for rawValue: String) -> String {
        premiumCadenceOptions.first(where: { $0.value == rawValue })?.label ?? rawValue
    }
}

struct InsurancePolicyTypePickerOption: Identifiable, Equatable {
    let type: InsurancePolicyType
    let label: String
    let systemImage: String

    var id: String { type.rawValue }
}

func assetTypeSystemImage(for type: String) -> String {
    switch type {
    case "Real estate": "house.fill"
    case "Vehicle": "car.fill"
    case "Boat": "sailboat.fill"
    case "Business": "building.2.fill"
    case "Personal property": "shippingbox.fill"
    case "Collectible": "star.fill"
    case "Cash-like asset": "banknote.fill"
    default: "tag.fill"
    }
}

func accountTypeSystemImage(for type: String) -> String {
    switch type.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) {
    case "checking", "depository": "banknote.fill"
    case "savings": "building.columns.fill"
    case "credit card", "credit": "creditcard.fill"
    case "loan": "hand.raised.fill"
    case "mortgage": "house.fill"
    case "brokerage", "stocks", "investment": "chart.line.uptrend.xyaxis"
    case "roth ira", "ira": "leaf.fill"
    case "401(k)", "401k", "roth 401(k)", "roth 401k": "briefcase.fill"
    case "hsa": "cross.case.fill"
    case "529": "graduationcap.fill"
    case "real estate": "house.fill"
    case "other": "ellipsis"
    default: "wallet.pass.fill"
    }
}
