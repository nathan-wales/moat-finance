import Foundation

enum RealEstatePropertyType: String, Codable, CaseIterable, Identifiable {
    case singleFamily = "SINGLE_FAMILY"
    case multiFamily = "MULTI_FAMILY"
    case condo = "CONDO"
    case commercial = "COMMERCIAL"
    case land = "LAND"
    case other = "OTHER"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .singleFamily: "Single family"
        case .multiFamily: "Multi-family"
        case .condo: "Condo"
        case .commercial: "Commercial"
        case .land: "Land"
        case .other: "Other"
        }
    }

    var systemImage: String {
        switch self {
        case .singleFamily: "house.fill"
        case .multiFamily: "building.2.fill"
        case .condo: "building.fill"
        case .commercial: "storefront.fill"
        case .land: "leaf.fill"
        case .other: "tag.fill"
        }
    }
}

enum RealEstateUsageType: String, Codable, CaseIterable, Identifiable {
    case primaryResidence = "PRIMARY_RESIDENCE"
    case rental = "RENTAL"
    case vacationHome = "VACATION_HOME"
    case mixedUse = "MIXED_USE"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .primaryResidence: "Primary residence"
        case .rental: "Rental property"
        case .vacationHome: "Vacation home"
        case .mixedUse: "Mixed use"
        }
    }

    var systemImage: String {
        switch self {
        case .primaryResidence: "house.fill"
        case .rental: "key.fill"
        case .vacationHome: "beach.umbrella.fill"
        case .mixedUse: "square.split.2x2.fill"
        }
    }
}

enum RealEstateForecastScenario: String, Codable, CaseIterable, Identifiable {
    case moderate = "MODERATE"
    case standard = "STANDARD"
    case aggressive = "AGGRESSIVE"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .moderate: "Moderate (2% rent growth)"
        case .standard: "Standard (4% rent growth)"
        case .aggressive: "Aggressive (6% rent growth)"
        }
    }
}

enum RealEstateIntakeStep: Int, CaseIterable, Identifiable {
    case property
    case mortgage
    case income
    case expenses
    case forecast
    case review

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .property: "Property"
        case .mortgage: "Mortgage"
        case .income: "Income"
        case .expenses: "Expenses"
        case .forecast: "Forecast"
        case .review: "Review"
        }
    }

    var instruction: String {
        switch self {
        case .property: "Enter property name, type, and estimated value."
        case .mortgage: "Add mortgage details or skip if you own outright."
        case .income: "Add rental income if this property is rented."
        case .expenses: "Estimate monthly operating expenses."
        case .forecast: "Choose forecast assumptions and preview projections."
        case .review: "Review your property before saving."
        }
    }
}

struct RealEstateFormValues: Equatable {
    var name: String
    var propertyType: RealEstatePropertyType
    var usageType: RealEstateUsageType
    var currentEstimatedValue: String
    var currentLoanBalance: String
    var hasMortgage: Bool
    var isRented: Bool
    var monthlyRent: String
    var totalMonthlyExpenses: String
    var forecastScenario: RealEstateForecastScenario
    var purchaseDate: String
    var loanTermYears: String
    var interestRate: String
    var purchasePrice: String
    var downPayment: String
    var closingCosts: String
    var rehabCosts: String
    var remainingTermMonths: String
    var monthlyMortgagePayment: String
    var otherMonthlyIncome: String
    var vacancyRate: String
    var monthlyPropertyTax: String
    var monthlyInsurance: String
    var monthlyHOA: String
    var monthlyUtilities: String
    var monthlyMaintenance: String
    var monthlyManagement: String
    var monthlyOtherExpenses: String
    var appreciationRate: String
    var expenseGrowthRate: String
    var linkedPlaidAccountId: String
}

enum RealEstateAssetSync {
    private static let legacyBannerDismissKey = "moat:legacy-real-estate-banner-dismissed"

    static func isSyncedAssetId(_ id: String) -> Bool {
        id.hasPrefix("real-estate-")
    }

    static func propertyId(fromAssetId id: String) -> String {
        id.replacingOccurrences(of: "^real-estate-", with: "", options: .regularExpression)
    }

    static func syncedAssetId(forPropertyId propertyId: String) -> String {
        "real-estate-\(propertyId)"
    }

    static func isLegacyAsset(_ asset: ProfileAsset) -> Bool {
        asset.type == "Real estate" && !isSyncedAssetId(asset.id)
    }

    static var isLegacyBannerDismissed: Bool {
        UserDefaults.standard.bool(forKey: legacyBannerDismissKey)
    }

    static func dismissLegacyBanner() {
        UserDefaults.standard.set(true, forKey: legacyBannerDismissKey)
    }
}

struct RealEstateProperty: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let propertyType: RealEstatePropertyType
    let usageType: RealEstateUsageType
    let purchasePrice: Double?
    let purchaseDate: Date?
    let downPayment: Double?
    let closingCosts: Double?
    let rehabCosts: Double?
    let currentEstimatedValue: Double
    let currentLoanBalance: Double
    let interestRate: Double?
    let loanTermYears: Int?
    let remainingTermMonths: Int?
    let monthlyMortgagePayment: Double?
    let monthlyRent: Double?
    let otherMonthlyIncome: Double?
    let vacancyRate: Double?
    let totalMonthlyExpenses: Double?
    let monthlyPropertyTax: Double?
    let monthlyInsurance: Double?
    let monthlyHOA: Double?
    let monthlyUtilities: Double?
    let monthlyMaintenance: Double?
    let monthlyManagement: Double?
    let monthlyOtherExpenses: Double?
    let appreciationRate: Double?
    let expenseGrowthRate: Double?
    let forecastScenario: RealEstateForecastScenario?
    let linkedPlaidAccountId: String?
    let createdAt: Date?
    let updatedAt: Date?

    var equity: Double { currentEstimatedValue - currentLoanBalance }
    var totalMonthlyIncome: Double { (monthlyRent ?? 0) + (otherMonthlyIncome ?? 0) }
    var effectiveMonthlyExpenses: Double {
        let itemized = [monthlyPropertyTax, monthlyInsurance, monthlyHOA, monthlyUtilities, monthlyMaintenance, monthlyManagement, monthlyOtherExpenses]
            .compactMap { $0 }
            .reduce(0, +)
        return itemized > 0 ? itemized : (totalMonthlyExpenses ?? 0)
    }
    var monthlyCashFlow: Double {
        totalMonthlyIncome - (monthlyMortgagePayment ?? 0) - effectiveMonthlyExpenses
    }

    var hasLinkedMortgage: Bool {
        linkedPlaidAccountId?.isEmpty == false
    }
}

struct LinkedPlaidAccountSummary: Identifiable, Equatable {
    let id: String
    let displayName: String
    let institutionName: String
    let mask: String?
    let type: String
    let subtype: String?
    let balance: Double
    let currency: String?
    let lastBalanceSyncAt: Date?

    init(account: PlaidAccount, institutionName: String) {
        id = account.id
        displayName = account.displayName
        self.institutionName = institutionName
        mask = account.mask
        type = account.type
        subtype = account.subtype
        balance = account.currentBalance ?? account.availableBalance ?? 0
        currency = account.currency
        lastBalanceSyncAt = account.lastBalanceSyncAt
    }

    var displayType: String {
        [type, subtype].compactMap { value in
            guard let value, !value.isEmpty else { return nil }
            return value.replacingOccurrences(of: "_", with: " ").capitalized
        }.joined(separator: " - ")
    }

    var maskedName: String {
        if let mask, !mask.isEmpty {
            return "\(displayName) (...\(mask))"
        }
        return displayName
    }

    var isMortgageCandidate: Bool {
        let normalized = "\(type) \(subtype ?? "") \(displayName)".lowercased()
        return normalized.contains("mortgage") || normalized.contains("loan") || normalized.contains("credit")
    }
}

struct RealEstateProjection: Decodable, Equatable {
    let projections: [RealEstateProjectionPoint]
    let summary: RealEstateProjectionSummary
}

struct RealEstateProjectionPoint: Decodable, Identifiable, Equatable {
    let year: Int
    let propertyValue: Double
    let loanBalance: Double
    let equity: Double
    let cashFlow: Double?
    let totalReturn: Double?

    var id: Int { year }
}

struct RealEstateProjectionSummary: Decodable, Equatable {
    let totalAppreciation: Double
    let totalRent: Double
    let totalExpenses: Double
    let finalEquity: Double
}

func createEmptyRealEstateFormValues() -> RealEstateFormValues {
    RealEstateFormValues(
        name: "",
        propertyType: .singleFamily,
        usageType: .primaryResidence,
        currentEstimatedValue: "",
        currentLoanBalance: "",
        hasMortgage: true,
        isRented: false,
        monthlyRent: "",
        totalMonthlyExpenses: "",
        forecastScenario: .standard,
        purchaseDate: "",
        loanTermYears: "",
        interestRate: "",
        purchasePrice: "",
        downPayment: "",
        closingCosts: "",
        rehabCosts: "",
        remainingTermMonths: "",
        monthlyMortgagePayment: "",
        otherMonthlyIncome: "",
        vacancyRate: "",
        monthlyPropertyTax: "",
        monthlyInsurance: "",
        monthlyHOA: "",
        monthlyUtilities: "",
        monthlyMaintenance: "",
        monthlyManagement: "",
        monthlyOtherExpenses: "",
        appreciationRate: "",
        expenseGrowthRate: "",
        linkedPlaidAccountId: ""
    )
}

func realEstateFormValues(from property: RealEstateProperty) -> RealEstateFormValues {
    RealEstateFormValues(
        name: property.name,
        propertyType: property.propertyType,
        usageType: property.usageType,
        currentEstimatedValue: formatOptionalNumber(property.currentEstimatedValue),
        currentLoanBalance: formatOptionalNumber(property.currentLoanBalance),
        hasMortgage: propertyHasMortgage(property),
        isRented: propertyIsRented(property),
        monthlyRent: formatOptionalNumber(property.monthlyRent),
        totalMonthlyExpenses: formatOptionalNumber(property.totalMonthlyExpenses),
        forecastScenario: property.forecastScenario ?? .standard,
        purchaseDate: property.purchaseDate.map { realEstatePurchaseDateString($0) } ?? "",
        loanTermYears: formatOptionalInt(property.loanTermYears),
        interestRate: formatOptionalPercent(property.interestRate),
        purchasePrice: formatOptionalNumber(property.purchasePrice),
        downPayment: formatOptionalNumber(property.downPayment),
        closingCosts: formatOptionalNumber(property.closingCosts),
        rehabCosts: formatOptionalNumber(property.rehabCosts),
        remainingTermMonths: formatOptionalInt(property.remainingTermMonths),
        monthlyMortgagePayment: formatOptionalNumber(property.monthlyMortgagePayment),
        otherMonthlyIncome: formatOptionalNumber(property.otherMonthlyIncome),
        vacancyRate: formatOptionalPercent(property.vacancyRate),
        monthlyPropertyTax: formatOptionalNumber(property.monthlyPropertyTax),
        monthlyInsurance: formatOptionalNumber(property.monthlyInsurance),
        monthlyHOA: formatOptionalNumber(property.monthlyHOA),
        monthlyUtilities: formatOptionalNumber(property.monthlyUtilities),
        monthlyMaintenance: formatOptionalNumber(property.monthlyMaintenance),
        monthlyManagement: formatOptionalNumber(property.monthlyManagement),
        monthlyOtherExpenses: formatOptionalNumber(property.monthlyOtherExpenses),
        appreciationRate: formatOptionalPercent(property.appreciationRate),
        expenseGrowthRate: formatOptionalPercent(property.expenseGrowthRate),
        linkedPlaidAccountId: property.linkedPlaidAccountId ?? ""
    )
}

func parseRealEstateFormNumber(_ value: String) -> Double? {
    AmountInputFormatter.parse(value)
}

func parseRealEstateFormInt(_ value: String) -> Int? {
    guard !value.isEmpty, let parsed = Int(value) else { return nil }
    return parsed
}

func canContinueRealEstateStep(_ step: RealEstateIntakeStep, form: RealEstateFormValues) -> Bool {
    switch step {
    case .property:
        return !form.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (parseRealEstateFormNumber(form.currentEstimatedValue) ?? 0) > 0
    case .mortgage:
        guard form.hasMortgage else { return true }
        return !form.purchaseDate.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (parseRealEstateFormInt(form.loanTermYears) ?? 0) > 0
            && (parseRealEstateFormNumber(form.currentLoanBalance) ?? 0) > 0
            && (parseRealEstateFormNumber(form.interestRate) ?? 0) > 0
    case .income:
        guard form.isRented else { return true }
        return (parseRealEstateFormNumber(form.monthlyRent) ?? 0) > 0
    case .expenses, .forecast, .review:
        return true
    }
}

func canSubmitRealEstateForm(_ form: RealEstateFormValues) -> Bool {
    RealEstateIntakeStep.allCases
        .filter { $0 != .review }
        .allSatisfy { canContinueRealEstateStep($0, form: form) }
}

func realEstatePreview(from form: RealEstateFormValues) -> (equity: Double, monthlyCashFlow: Double) {
    let value = parseRealEstateFormNumber(form.currentEstimatedValue) ?? 0
    let loan = form.hasMortgage ? (parseRealEstateFormNumber(form.currentLoanBalance) ?? 0) : 0
    let rent = form.isRented ? (parseRealEstateFormNumber(form.monthlyRent) ?? 0) : 0
    let expenses = parseRealEstateFormNumber(form.totalMonthlyExpenses) ?? 0
    let mortgage = parseRealEstateFormNumber(form.monthlyMortgagePayment) ?? 0
    return (
        equity: value - loan,
        monthlyCashFlow: rent - expenses - mortgage
    )
}

func mapFormValuesToCreateBody(_ values: RealEstateFormValues) -> [String: JSONValue] {
    buildRealEstateBody(from: values)
}

func mapFormValuesToUpdateBody(id: String, values: RealEstateFormValues) -> [String: JSONValue] {
    var body = buildRealEstateBody(from: values)
    body["id"] = .string(id)

    if !values.hasMortgage {
        body["currentLoanBalance"] = .number(0)
        for key in mortgageClearFieldKeys {
            body[key] = .null
        }
    }

    if !values.isRented {
        for key in rentalClearFieldKeys {
            body[key] = .null
        }
    }

    let linkedId = values.linkedPlaidAccountId.trimmingCharacters(in: .whitespacesAndNewlines)
    body["linkedPlaidAccountId"] = linkedId.isEmpty ? .null : .string(linkedId)

    return body
}

private let mortgageClearFieldKeys = [
    "purchasePrice",
    "purchaseDate",
    "downPayment",
    "closingCosts",
    "rehabCosts",
    "interestRate",
    "loanTermYears",
    "remainingTermMonths",
    "monthlyMortgagePayment",
]

private let rentalClearFieldKeys = [
    "monthlyRent",
    "otherMonthlyIncome",
    "vacancyRate",
]

private func propertyHasMortgage(_ property: RealEstateProperty) -> Bool {
    property.currentLoanBalance > 0
        || property.hasLinkedMortgage
        || property.interestRate != nil
        || property.loanTermYears != nil
        || property.purchaseDate != nil
}

private func propertyIsRented(_ property: RealEstateProperty) -> Bool {
    property.usageType == .rental
        || property.monthlyRent != nil
        || property.otherMonthlyIncome != nil
}

private func buildRealEstateBody(from values: RealEstateFormValues) -> [String: JSONValue] {
    var body: [String: JSONValue] = [
        "name": .string(values.name.trimmingCharacters(in: .whitespacesAndNewlines)),
        "propertyType": .string(values.propertyType.rawValue),
        "usageType": .string(values.usageType.rawValue),
        "currentEstimatedValue": .number(parseRealEstateFormNumber(values.currentEstimatedValue) ?? 0),
        "currentLoanBalance": .number(
            values.hasMortgage
                ? (parseRealEstateFormNumber(values.currentLoanBalance) ?? 0)
                : 0
        ),
        "forecastScenario": .string(values.forecastScenario.rawValue),
    ]

    optionalNumberField(&body, key: "totalMonthlyExpenses", value: values.totalMonthlyExpenses)
    optionalNumberField(&body, key: "monthlyPropertyTax", value: values.monthlyPropertyTax)
    optionalNumberField(&body, key: "monthlyInsurance", value: values.monthlyInsurance)
    optionalNumberField(&body, key: "monthlyHOA", value: values.monthlyHOA)
    optionalNumberField(&body, key: "monthlyUtilities", value: values.monthlyUtilities)
    optionalNumberField(&body, key: "monthlyMaintenance", value: values.monthlyMaintenance)
    optionalNumberField(&body, key: "monthlyManagement", value: values.monthlyManagement)
    optionalNumberField(&body, key: "monthlyOtherExpenses", value: values.monthlyOtherExpenses)
    optionalPercentField(&body, key: "appreciationRate", value: values.appreciationRate)
    optionalPercentField(&body, key: "expenseGrowthRate", value: values.expenseGrowthRate)

    if values.hasMortgage {
        optionalNumberField(&body, key: "purchasePrice", value: values.purchasePrice)
        optionalNumberField(&body, key: "downPayment", value: values.downPayment)
        optionalNumberField(&body, key: "closingCosts", value: values.closingCosts)
        optionalNumberField(&body, key: "rehabCosts", value: values.rehabCosts)
        optionalIntField(&body, key: "remainingTermMonths", value: values.remainingTermMonths)
        optionalNumberField(&body, key: "monthlyMortgagePayment", value: values.monthlyMortgagePayment)
        optionalIntField(&body, key: "loanTermYears", value: values.loanTermYears)
        optionalPercentField(&body, key: "interestRate", value: values.interestRate)

        if !values.purchaseDate.isEmpty {
            body["purchaseDate"] = .string(isoPurchaseDate(from: values.purchaseDate))
        }
    }

    if values.isRented {
        optionalNumberField(&body, key: "monthlyRent", value: values.monthlyRent)
        optionalNumberField(&body, key: "otherMonthlyIncome", value: values.otherMonthlyIncome)
        optionalPercentField(&body, key: "vacancyRate", value: values.vacancyRate)
    }

    let linkedId = values.linkedPlaidAccountId.trimmingCharacters(in: .whitespacesAndNewlines)
    if !linkedId.isEmpty {
        body["linkedPlaidAccountId"] = .string(linkedId)
    }

    return body
}

private func optionalNumberField(_ body: inout [String: JSONValue], key: String, value: String) {
    guard let parsed = parseRealEstateFormNumber(value) else { return }
    body[key] = .number(parsed)
}

private func optionalIntField(_ body: inout [String: JSONValue], key: String, value: String) {
    guard let parsed = parseRealEstateFormInt(value) else { return }
    body[key] = .number(Double(parsed))
}

private func optionalPercentField(_ body: inout [String: JSONValue], key: String, value: String) {
    guard let parsed = parseRealEstateFormNumber(value) else { return }
    body[key] = .number(parsed / 100)
}

private func realEstatePurchaseDateString(_ date: Date) -> String {
    realEstatePurchaseDateFormatter.string(from: date)
}

private func isoPurchaseDate(from value: String) -> String {
    guard let date = realEstatePurchaseDateFormatter.date(from: value) else { return value }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.string(from: date)
}

private let realEstatePurchaseDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    return formatter
}()

private func formatOptionalNumber(_ value: Double?) -> String {
    guard let value else { return "" }
    return AmountInputFormatter.format(value)
}

private func formatOptionalInt(_ value: Int?) -> String {
    guard let value else { return "" }
    return String(value)
}

private func formatOptionalPercent(_ value: Double?) -> String {
    guard let value else { return "" }
    return String(value * 100)
}
