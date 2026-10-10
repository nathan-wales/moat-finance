import Foundation

enum TransactionKind: String, Codable, CaseIterable, Identifiable {
    case income = "INCOME"
    case expense = "EXPENSE"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .income: "Income"
        case .expense: "Expense"
        }
    }
}

enum TransactionSortField: String, CaseIterable, Identifiable {
    case date
    case amount
    case account

    var id: String { rawValue }

    var title: String {
        switch self {
        case .date: "Date"
        case .amount: "Amount"
        case .account: "Account"
        }
    }
}

struct TransactionFilterState: Equatable {
    var search: String = ""
    var category: String?
    var categories: [String] = []
    var hashtag: String?
    var type: TransactionKind?
    var startDate: Date?
    var endDate: Date?
    var sortField: TransactionSortField = .date
    var sortDescending = true
    var limit = 100
    var cursor = 0

    var hasExplicitDateFilter: Bool {
        startDate != nil || endDate != nil
    }

    var hasCategoryFilter: Bool {
        category != nil || !categories.isEmpty
    }

    var categoryChipTitle: String {
        if categories.count > 1 {
            return "\(categories.count) categories"
        }
        return categories.first ?? category ?? "Category"
    }

    var hasActiveFilters: Bool {
        !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || hasCategoryFilter
            || hashtag != nil
            || type != nil
            || hasExplicitDateFilter
    }

    /// Date sort (asc or desc) groups the list under day bands; other sort fields show dates on each row.
    var isChronologicalSort: Bool {
        sortField == .date
    }

    var sortTitle: String {
        "\(sortField.title) \(sortDescending ? "desc" : "asc")"
    }

    var dateRangeTitle: String {
        switch (startDate, endDate) {
        case (.some(let startDate), .some(let endDate)):
            return "\(DateFormatterProvider.fullDate(startDate)) - \(DateFormatterProvider.fullDate(endDate))"
        case (.some(let startDate), nil):
            return "From \(DateFormatterProvider.fullDate(startDate))"
        case (nil, .some(let endDate)):
            return "Until \(DateFormatterProvider.fullDate(endDate))"
        case (nil, nil):
            return "Date range"
        }
    }

    var requestBody: JSONValue {
        var body: [String: JSONValue] = [
            "limit": .number(Double(limit)),
            "cursor": .number(Double(cursor)),
            "sortField": .string(sortField.rawValue),
            "sortDir": .string(sortDescending ? "desc" : "asc")
        ]

        let trimmedSearch = search.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedSearch.isEmpty {
            body["search"] = .string(trimmedSearch)
        }

        if let category {
            body["category"] = .string(category)
        }

        if !categories.isEmpty {
            body["categories"] = .array(categories.map(JSONValue.string))
        }

        if let hashtag {
            body["hashtag"] = .string(hashtag)
        }

        if let type {
            body["type"] = .string(type.rawValue)
        }

        if let startDate {
            body["startDate"] = .string(TransactionDateEncoding.string(from: startDate))
        }

        if let endDate {
            body["endDate"] = .string(TransactionDateEncoding.string(from: endDate))
        }

        return .object(body)
    }
}

struct TransactionListResponse: Decodable {
    let items: [TransactionItem]
    let nextCursor: Int?
}

struct TransactionItem: Decodable, Identifiable, Equatable {
    let id: String
    let date: Date
    let postedDate: Date?
    let amount: Double
    let type: TransactionKind
    let category: String?
    let categoryId: String?
    let description: String?
    let originalDescription: String?
    let merchantName: String?
    let account: String?
    let source: String?
    let pending: Bool?
    let hidden: Bool?
    let splitGroupId: String?
    let splitParentId: String?
    let splitOriginalAmount: Double?
    let appliedRuleId: String?
    let hashtags: [TransactionHashtagLink]?
    let categoryRef: TransactionCategoryRef?

    var displayTitle: String {
        description.nonEmpty ?? merchantName.nonEmpty ?? originalDescription.nonEmpty ?? "Transaction"
    }

    var canonicalDate: Date {
        postedDate ?? date
    }

    var displaySubtitle: String {
        DateFormatterProvider.fullDate(canonicalDate)
    }

    var displayCategory: String {
        categoryRef?.name.nonEmpty ?? category.nonEmpty ?? "Uncategorized"
    }

    var displayCategorySystemImage: String {
        if let catalogImage = CategoryIconCatalog.systemImage(forKey: categoryRef?.icon) {
            return catalogImage
        }
        return CategoryItem.systemImage(forName: displayCategory)
    }

    var signedAmount: Double {
        type == .expense ? -abs(amount) : abs(amount)
    }

    var canEditAmount: Bool {
        source?.uppercased() != "PLAID" && splitGroupId == nil
    }

    var isPlaidTransaction: Bool {
        source?.uppercased() == "PLAID"
    }

    var isHiddenTransaction: Bool {
        hidden == true
    }

    var isPendingTransaction: Bool {
        pending == true
    }

    var isPendingPlaidTransaction: Bool {
        isPlaidTransaction && isPendingTransaction
    }

    var hasExistingSplit: Bool {
        splitGroupId != nil
    }

    var hashtagNames: [String] {
        hashtags?.compactMap { $0.hashtag.name.nonEmpty } ?? []
    }

    func withHidden(_ isHidden: Bool) -> TransactionItem {
        TransactionItem(
            id: id,
            date: date,
            postedDate: postedDate,
            amount: amount,
            type: type,
            category: category,
            categoryId: categoryId,
            description: self.description,
            originalDescription: originalDescription,
            merchantName: merchantName,
            account: account,
            source: source,
            pending: pending,
            hidden: isHidden,
            splitGroupId: splitGroupId,
            splitParentId: splitParentId,
            splitOriginalAmount: splitOriginalAmount,
            appliedRuleId: appliedRuleId,
            hashtags: hashtags,
            categoryRef: categoryRef
        )
    }

    func splitChild(in transactions: [TransactionItem]) -> TransactionItem? {
        if splitParentId != nil {
            return self
        }
        return transactions.first { $0.splitParentId == id }
    }

    func splitSiblings(in transactions: [TransactionItem]) -> [TransactionItem] {
        guard let groupId = splitGroupId else { return [] }
        return transactions.filter { sibling in
            sibling.splitGroupId == groupId && sibling.id != id
        }
    }
}

enum TransactionAmountInput {
    static func parse(_ value: String) -> Double {
        AmountInputFormatter.parse(value) ?? 0
    }

    static func format(_ value: Double) -> String {
        AmountInputFormatter.format(value, fractionDigits: 2)
    }

    static func clampSplitAmount(_ value: String, total: Double) -> (original: String, split: String) {
        let splitAmount = min(parse(value), total)
        let originalAmount = max(total - splitAmount, 0)
        return (format(originalAmount), format(splitAmount))
    }

    static func originalAmount(total: Double, splitAmounts: [String]) -> String {
        let splitsTotal = splitAmounts.reduce(0) { $0 + parse($1) }
        return format(max(total - splitsTotal, 0))
    }

    static func clampSplitAmount(
        _ value: String,
        total: Double,
        otherSplitAmounts: [String]
    ) -> String {
        let otherTotal = otherSplitAmounts.reduce(0) { $0 + parse($1) }
        let maxForThis = max(total - otherTotal, 0)
        let parsed = parse(value)
        return parsed > maxForThis ? format(min(parsed, maxForThis)) : value
    }
}

struct SplitDraft: Identifiable, Equatable {
    let id: UUID
    var category: String
    var amount: String

    init(id: UUID = UUID(), category: String, amount: String = "") {
        self.id = id
        self.category = category
        self.amount = amount
    }
}

struct TransactionDayGroup: Identifiable, Equatable {
    let day: Date
    let transactions: [TransactionItem]

    var id: Date { day }

    var title: String {
        DateFormatterProvider.fullDate(day)
    }

    var dayNet: Double {
        transactions.reduce(0) { $0 + $1.signedAmount }
    }
}

func groupTransactionsByDay(
    _ transactions: [TransactionItem],
    calendar: Calendar = .current
) -> [TransactionDayGroup] {
    var groups: [TransactionDayGroup] = []
    var currentDay: Date?
    var currentTransactions: [TransactionItem] = []

    for transaction in transactions {
        let day = calendar.startOfDay(for: transaction.canonicalDate)

        if let activeDay = currentDay, day != activeDay {
            groups.append(TransactionDayGroup(day: activeDay, transactions: currentTransactions))
            currentDay = day
            currentTransactions = [transaction]
            continue
        }

        currentDay = day
        currentTransactions.append(transaction)
    }

    if let currentDay, !currentTransactions.isEmpty {
        groups.append(TransactionDayGroup(day: currentDay, transactions: currentTransactions))
    }

    return groups
}

func groupSplitTransactions(_ transactions: [TransactionItem]) -> [TransactionItem] {
    var splitGroups: [String: [TransactionItem]] = [:]
    var originalIndexes: [String: Int] = [:]

    for (index, transaction) in transactions.enumerated() {
        originalIndexes[transaction.id] = index
        guard let groupId = transaction.splitGroupId else { continue }
        splitGroups[groupId, default: []].append(transaction)
    }

    var emittedGroups = Set<String>()
    var grouped: [TransactionItem] = []

    for transaction in transactions {
        guard let groupId = transaction.splitGroupId else {
            grouped.append(transaction)
            continue
        }

        guard !emittedGroups.contains(groupId) else { continue }
        emittedGroups.insert(groupId)

        let group = splitGroups[groupId] ?? [transaction]
        grouped.append(
            contentsOf: group.sorted { lhs, rhs in
                if lhs.id == groupId { return true }
                if rhs.id == groupId { return false }
                return (originalIndexes[lhs.id] ?? 0) < (originalIndexes[rhs.id] ?? 0)
            }
        )
    }

    return grouped
}

struct TransactionCategoryRef: Decodable, Equatable {
    let id: String
    let name: String
    let icon: String?
}

struct TransactionHashtagLink: Decodable, Equatable {
    let hashtag: HashtagSummary
}

struct HashtagSummary: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let normalizedName: String?
}

struct TransactionSummary: Decodable, Equatable {
    let income: [TransactionSummaryItem]
    let expenses: [TransactionSummaryItem]
    let incomeSum: Double
    let incomeCount: Int
    let expenseSum: Double
    let expenseCount: Int

    var net: Double { incomeSum - expenseSum }
    var totalCount: Int { incomeCount + expenseCount }
}

struct TransactionSummaryItem: Decodable, Equatable {
    let name: String?
    let amount: Double
    let count: Int
}

struct TransactionsLoadResult {
    let list: TransactionListResponse
    let totalCount: Int
    let summary: TransactionSummary
    let categories: [String]
    let hashtags: [HashtagSummary]
}

struct TransactionRulePrompt: Identifiable, Equatable {
    enum Mode: Equatable {
        case create
        case update(ruleId: String)
    }

    enum Action: Equatable {
        case setCategory(String)
        case setDescription(String)
        case setType(TransactionKind)
        case addHashtag(String)

        var title: String {
            switch self {
            case .setCategory(let category):
                return "Set category to \(category)"
            case .setDescription(let description):
                return "Set description to \(description)"
            case .setType(let type):
                return "Set type to \(type.title)"
            case .addHashtag(let hashtag):
                return "Add #\(hashtag)"
            }
        }

        var ruleActionDraft: EditableRuleActionDraft {
            switch self {
            case .setCategory(let category):
                return EditableRuleActionDraft(actionType: .setCategory, text: category)
            case .setDescription(let description):
                return EditableRuleActionDraft(actionType: .setDescription, text: description)
            case .setType(let type):
                return EditableRuleActionDraft(actionType: .setType, text: type.rawValue)
            case .addHashtag(let hashtag):
                return EditableRuleActionDraft(actionType: .addHashtag, text: hashtag)
            }
        }
    }

    let id = UUID()
    let transactionId: String
    let mode: Mode
    let originalDescription: String
    let actions: [Action]

    var primaryAction: Action? { actions.first }

    var summaryTitle: String {
        guard let primaryAction else { return "Apply changes" }
        if actions.count == 1 {
            return primaryAction.title
        }
        return "\(primaryAction.title) and \(actions.count - 1) more"
    }

    var title: String {
        switch mode {
        case .create:
            return "Create a rule?"
        case .update:
            return "Update applied rule?"
        }
    }

    var editorTitle: String {
        switch mode {
        case .create:
            return "Create rule"
        case .update:
            return "Update rule"
        }
    }
}

struct TransactionRuleEditorContext {
    let draft: EditableRuleDraft
    let existingRule: TransactionRule?
    let categories: [CategoryItem]
}

private extension Optional where Wrapped == String {
    var nonEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}

extension Optional where Wrapped == String {
    var transactionNilIfBlank: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }

        return value
    }
}

private extension String {
    var nonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private enum TransactionDateEncoding {
    private static let formatter = ISO8601DateFormatter()

    static func string(from date: Date) -> String {
        formatter.string(from: date)
    }
}
