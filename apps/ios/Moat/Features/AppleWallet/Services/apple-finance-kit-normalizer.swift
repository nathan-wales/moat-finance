import Foundation

enum AppleFinanceKitNormalizer {
    private static let apiDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func normalizeAccount(
        externalAccountId: String,
        displayName: String,
        accountType: String,
        accountSubtype: String?,
        currency: String
    ) -> ExternalAccountDTO {
        ExternalAccountDTO(
            source: AppleWalletIntegrationSource.financeKit,
            externalAccountId: externalAccountId,
            displayName: displayName,
            institutionName: "Apple Wallet",
            accountType: accountType,
            accountSubtype: accountSubtype,
            currency: currency
        )
    }

    static func normalizeBalance(
        externalAccountId: String,
        currentBalance: Double?,
        availableBalance: Double?,
        currency: String,
        asOf: Date = Date()
    ) -> ExternalBalanceDTO {
        ExternalBalanceDTO(
            source: AppleWalletIntegrationSource.financeKit,
            externalAccountId: externalAccountId,
            currentBalance: currentBalance,
            availableBalance: availableBalance,
            currency: currency,
            asOf: ISO8601DateFormatter().string(from: asOf)
        )
    }

    static func normalizeTransaction(
        externalTransactionId: String,
        externalAccountId: String,
        transactionDate: Date,
        authorizedDate: Date?,
        signedAmount: Double,
        currency: String,
        merchantName: String?,
        description: String,
        pending: Bool,
        rawCategory: String?,
        pendingTransactionId: String? = nil,
        transactionType: String? = nil,
        foreignCurrencyCode: String? = nil,
        creditDebitIndicator: String? = nil
    ) -> ExternalTransactionDTO {
        ExternalTransactionDTO(
            source: AppleWalletIntegrationSource.financeKit,
            externalTransactionId: externalTransactionId,
            externalAccountId: externalAccountId,
            date: dateOnlyString(transactionDate),
            authorizedDate: authorizedDate.map(dateOnlyString),
            amount: signedAmount,
            currency: currency,
            merchantName: merchantName,
            description: description,
            pending: pending,
            category: nil,
            rawCategory: rawCategory,
            pendingTransactionId: pendingTransactionId,
            transactionType: transactionType,
            foreignCurrencyCode: foreignCurrencyCode,
            creditDebitIndicator: creditDebitIndicator
        )
    }

    static func mapAccountType(isLiability: Bool) -> String {
        isLiability ? "credit" : "depository"
    }

    static func mapAccountSubtype(isLiability: Bool, accountDescription: String?) -> String? {
        if isLiability {
            return "credit_card"
        }

        let normalized = accountDescription?.lowercased() ?? ""
        if normalized.contains("savings") {
            return "savings"
        }
        if normalized.contains("cash") {
            return "checking"
        }
        return "checking"
    }

    static func signedAmount(amount: Decimal, isCredit: Bool) -> Double {
        let absolute = NSDecimalNumber(decimal: abs(amount)).doubleValue
        return isCredit ? -absolute : absolute
    }

    private static func dateOnlyString(_ date: Date) -> String {
        apiDateFormatter.string(from: date)
    }
}
