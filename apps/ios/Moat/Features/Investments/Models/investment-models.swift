import Foundation
import SwiftUI

enum InvestmentType: String, Codable, CaseIterable, Identifiable {
    case stocks = "STOCKS"
    case realEstate = "REAL_ESTATE"
    case rothIRA = "ROTH_IRA"
    case four01K = "FOUR01K"
    case hsa = "HSA"
    case other = "OTHER"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .stocks: "Stocks"
        case .realEstate: "Real estate"
        case .rothIRA: "Roth IRA"
        case .four01K: "401(k)"
        case .hsa: "HSA"
        case .other: "Other"
        }
    }

    var systemImage: String {
        switch self {
        case .stocks: "chart.line.uptrend.xyaxis"
        case .realEstate: "house.fill"
        case .rothIRA: "leaf.fill"
        case .four01K: "briefcase.fill"
        case .hsa: "cross.case.fill"
        case .other: "ellipsis"
        }
    }

    /// Manual add/edit investment sheet options — excludes real estate (separate flow)
    /// and never includes banking types like checking/savings.
    static var editorCases: [InvestmentType] {
        allCases.filter { $0 != .realEstate }
    }
}

struct InvestmentItem: Decodable, Identifiable, Equatable {
    let id: String
    let type: InvestmentType
    let name: String
    let startingBalance: Double
    let monthlyContribution: Double
    let annualReturnRate: Double
    let notes: String?
    let institutionName: String?
    let accountMask: String?
    let accountSubtype: String?
    let lastBalanceSyncAt: Date?
    let createdAt: Date?
    let updatedAt: Date?

    var isPlaidBacked: Bool { id.hasPrefix("plaid_") }
    var returnPercent: Double {
        let scaled = (annualReturnRate * 10000).rounded() / 100
        return scaled
    }

    static func fromPlaid(account: PlaidAccount, institutionName: String) -> InvestmentItem {
        InvestmentItem(
            id: "plaid_\(account.id)",
            type: InvestmentType(plaidSubtype: account.subtype),
            name: account.displayName,
            startingBalance: account.currentBalance ?? account.availableBalance ?? 0,
            monthlyContribution: account.monthlyContribution ?? 0,
            annualReturnRate: account.annualReturnRate ?? 0.07,
            notes: account.notes,
            institutionName: institutionName,
            accountMask: account.mask,
            accountSubtype: account.subtype,
            lastBalanceSyncAt: account.lastBalanceSyncAt,
            createdAt: nil,
            updatedAt: nil
        )
    }

    static func fromProfile(
        account: ProfileAccount,
        investment: ProfileInvestment?,
        plaidAccount: PlaidAccount? = nil
    ) -> InvestmentItem {
        let isSynced = account.connectionStatus == "Synced" || account.plaidItemId != nil
        let typeSource = investment?.type ?? plaidAccount?.subtype ?? account.type
        let expectedReturnPercent: Double
        if let investment {
            expectedReturnPercent = investment.expectedReturn
        } else if let rate = plaidAccount?.annualReturnRate {
            expectedReturnPercent = (rate * 10000).rounded() / 100
        } else {
            expectedReturnPercent = 7
        }

        return InvestmentItem(
            id: isSynced ? "plaid_\(account.id)" : (investment?.id ?? account.id),
            type: InvestmentType(profileType: typeSource),
            name: investment?.name ?? account.name,
            startingBalance: investment?.currentValue ?? account.balance,
            monthlyContribution: investment?.monthlyContribution ?? plaidAccount?.monthlyContribution ?? 0,
            annualReturnRate: expectedReturnPercent / 100,
            notes: investment?.notes ?? account.notes ?? plaidAccount?.notes,
            institutionName: account.institution,
            accountMask: plaidAccount?.mask,
            accountSubtype: plaidAccount?.subtype ?? account.type,
            lastBalanceSyncAt: plaidAccount?.lastBalanceSyncAt ?? Self.parseLastSynced(account.lastSynced),
            createdAt: nil,
            updatedAt: nil
        )
    }

    private static func parseLastSynced(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.lowercased() != "manual" else { return nil }

        let isoDate = ISO8601DateFormatter()
        isoDate.formatOptions = [.withFullDate]
        if let date = isoDate.date(from: trimmed) {
            return date
        }

        let isoDateTime = ISO8601DateFormatter()
        isoDateTime.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoDateTime.date(from: trimmed) {
            return date
        }

        isoDateTime.formatOptions = [.withInternetDateTime]
        if let date = isoDateTime.date(from: trimmed) {
            return date
        }

        let display = DateFormatter()
        display.dateStyle = .medium
        display.timeStyle = .none
        return display.date(from: trimmed)
    }
}

extension InvestmentType {
    init(plaidSubtype: String?) {
        let normalized = plaidSubtype?.lowercased() ?? ""
        if normalized.contains("401") {
            self = .four01K
        } else if normalized.contains("ira") {
            self = .rothIRA
        } else if normalized.contains("hsa") {
            self = .hsa
        } else {
            self = .stocks
        }
    }

    init(profileType: String?) {
        let normalized = (profileType ?? "")
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized.contains("401") {
            self = .four01K
        } else if normalized.contains("roth") {
            self = .rothIRA
        } else if normalized.contains("ira") {
            self = .rothIRA
        } else if normalized.contains("hsa") {
            self = .hsa
        } else if normalized.contains("real estate") || normalized.contains("real_estate") {
            self = .realEstate
        } else if normalized.contains("stock") || normalized.contains("brokerage") {
            self = .stocks
        } else if normalized.contains("529") {
            self = .other
        } else if normalized.isEmpty {
            self = .stocks
        } else {
            self = .other
        }
    }
}

struct InvestmentSummary: Decodable, Equatable {
    let totalBalance: Double
    let totalMonthly: Double
    let totalRealEstateEquity: Double
    let forecastedPortfolio: Double
    let forecastedBalance: Double
    let forecastedRealEstateEquity: Double
    let forecastMonths: Int
    let forecastYears: Double

    var totalCurrentPortfolio: Double { totalBalance + totalRealEstateEquity }
}

struct PortfolioAllocation: Decodable, Equatable {
    let sections: [PortfolioAllocationSection]
}

struct PortfolioAllocationSection: Decodable, Identifiable, Equatable {
    let key: String
    let label: String
    let value: Double
    let items: [PortfolioAllocationItem]

    var id: String { key }
}

struct PortfolioAllocationItem: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let value: Double
    let subtitle: String?
    let lastSynced: String?
}

struct InvestmentForecast: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let type: InvestmentType
    let projections: [InvestmentForecastPoint]
}

struct InvestmentForecastPoint: Decodable, Identifiable, Equatable {
    let month: String
    let balance: Double
    let isForecast: Bool?

    var id: String { month }
    var dateValue: Date { DateFormatterProvider.parseYearMonth(month) ?? Date() }

    init(month: String, balance: Double, isForecast: Bool? = true) {
        self.month = month
        self.balance = balance
        self.isForecast = isForecast
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let month = try? container.decode(String.self, forKey: .month) {
            self.month = month
        } else {
            let monthNumber = try container.decode(Int.self, forKey: .month)
            self.month = String(monthNumber)
        }
        balance = try container.decode(Double.self, forKey: .balance)
        isForecast = try container.decodeIfPresent(Bool.self, forKey: .isForecast)
    }

    private enum CodingKeys: String, CodingKey {
        case month
        case balance
        case isForecast
    }
}

struct InvestmentsLoadResult {
    let summary: InvestmentSummary
    let investments: [InvestmentItem]
    let properties: [RealEstateProperty]
    let allocation: PortfolioAllocation
    let forecast: [InvestmentForecast]
    let activeScenario: ForecastScenario?
    let institutions: [PlaidInstitution]
}

struct InvestmentActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}
