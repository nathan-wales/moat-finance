import Foundation

actor TransactionsService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load(
        filters: TransactionFilterState,
        statsFilters: TransactionFilterState
    ) async throws -> TransactionsLoadResult {
        async let list: TransactionListResponse = apiClient.post(
            path: "/api/v1/transaction/getAll",
            body: filters.requestBody
        )
        async let stats = loadStats(filters: statsFilters)
        async let categories: [String] = apiClient.get(path: "/api/v1/transaction/listCategories")
        async let hashtags: [HashtagSummary] = apiClient.get(path: "/api/v1/hashtag/list")

        let loadedStats = try await stats
        return try await TransactionsLoadResult(
            list: list,
            totalCount: loadedStats.totalCount,
            summary: loadedStats.summary,
            categories: categories.sorted {
                $0.localizedCaseInsensitiveCompare($1) == .orderedAscending
            },
            hashtags: hashtags
        )
    }

    func loadPage(filters: TransactionFilterState) async throws -> TransactionListResponse {
        try await apiClient.post(
            path: "/api/v1/transaction/getAll",
            body: filters.requestBody
        )
    }

    func loadStats(filters: TransactionFilterState) async throws -> (summary: TransactionSummary, totalCount: Int) {
        async let totalCount: Int = apiClient.post(
            path: "/api/v1/transaction/count",
            body: filters.requestBody
        )
        async let summary: TransactionSummary = apiClient.post(
            path: "/api/v1/transaction/getSummary",
            body: filters.requestBody
        )
        return try await (summary, totalCount)
    }

    func count(forPlaidItemDbId plaidItemDbId: String) async throws -> Int {
        try await apiClient.post(
            path: "/api/v1/transaction/count",
            body: .object(["plaidItemDbId": .string(plaidItemDbId)])
        )
    }

    func updateCategory(transactionId: String, categoryName: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/updateCategory",
            body: .object([
                "id": .string(transactionId),
                "categoryName": .string(categoryName)
            ])
        )
    }

    func updateType(transactionId: String, type: TransactionKind) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/updateType",
            body: .object([
                "id": .string(transactionId),
                "type": .string(type.rawValue)
            ])
        )
    }

    func update(transactionId: String, description: String? = nil, amount: Double? = nil) async throws {
        var body: [String: JSONValue] = ["id": .string(transactionId)]
        if let description {
            body["description"] = .string(description)
        }
        if let amount {
            body["amount"] = .number(amount)
        }

        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/update",
            body: .object(body)
        )
    }

    func delete(transactionId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/delete",
            body: .object(["id": .string(transactionId)])
        )
    }

    func unhide(transactionId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/unhide",
            body: .object(["id": .string(transactionId)])
        )
    }

    func split(
        transactionId: String,
        description: String?,
        originalAmount: Double,
        splitAmount: Double,
        type: TransactionKind,
        originalCategoryName: String,
        splitCategoryName: String,
        hashtags: [String]
    ) async throws {
        var body: [String: JSONValue] = [
            "id": .string(transactionId),
            "originalAmount": .number(originalAmount),
            "splitAmount": .number(splitAmount),
            "type": .string(type.rawValue),
            "originalCategoryName": .string(originalCategoryName),
            "splitCategoryName": .string(splitCategoryName),
            "hashtags": .array(hashtags.map(JSONValue.string))
        ]
        if let description {
            body["description"] = .string(description)
        }

        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/split",
            body: .object(body)
        )
    }

    func unsplit(transactionId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/unsplit",
            body: .object(["id": .string(transactionId)])
        )
    }

    func setHashtags(transactionId: String, names: [String]) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/hashtag/setOnTransaction",
            body: .object([
                "transactionId": .string(transactionId),
                "hashtags": .array(names.map(JSONValue.string))
            ])
        )
    }

    func bulkUpdateType(transactionIds: [String], type: TransactionKind) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/bulkUpdateType",
            body: .object([
                "ids": .array(transactionIds.map(JSONValue.string)),
                "type": .string(type.rawValue)
            ])
        )
    }

    func bulkDelete(transactionIds: [String]) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/transaction/bulkDelete",
            body: .object(["ids": .array(transactionIds.map(JSONValue.string))])
        )
    }

    func fetchTransaction(id: String, around date: Date) async throws -> TransactionItem? {
        var filters = TransactionFilterState()
        let calendar = Calendar.current
        filters.startDate = calendar.startOfDay(for: date)
        filters.endDate = calendar.date(byAdding: .day, value: 1, to: filters.startDate ?? date)
        filters.limit = 100

        let result = try await load(filters: filters, statsFilters: filters)
        return result.list.items.first { $0.id == id }
    }
}
