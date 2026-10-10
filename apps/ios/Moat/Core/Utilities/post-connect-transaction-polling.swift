import Foundation

@MainActor
final class PostConnectTransactionPolling {
    static let shared = PostConnectTransactionPolling()

    private var pollingTask: Task<Void, Never>?
    private let transactionsService: TransactionsService

    private let fastIntervalSeconds: UInt64 = 5
    private let fastMaxAttempts = 12
    private let slowIntervalSeconds: UInt64 = 15
    private let slowMaxAttempts = 12

    init(transactionsService: TransactionsService = TransactionsService()) {
        self.transactionsService = transactionsService
    }

    func start(plaidItemDbId: String) {
        pollingTask?.cancel()
        MoatDataRefresh.notifyTransactionsChanged()

        pollingTask = Task {
            if await poll(
                plaidItemDbId: plaidItemDbId,
                intervalSeconds: fastIntervalSeconds,
                maxAttempts: fastMaxAttempts
            ) {
                return
            }

            _ = await poll(
                plaidItemDbId: plaidItemDbId,
                intervalSeconds: slowIntervalSeconds,
                maxAttempts: slowMaxAttempts
            )
        }
    }

    func cancel() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    @discardableResult
    private func poll(
        plaidItemDbId: String,
        intervalSeconds: UInt64,
        maxAttempts: Int
    ) async -> Bool {
        for attempt in 0..<maxAttempts {
            if Task.isCancelled { return true }

            if attempt > 0 {
                try? await Task.sleep(nanoseconds: intervalSeconds * 1_000_000_000)
            }

            if Task.isCancelled { return true }

            do {
                let count = try await transactionsService.count(forPlaidItemDbId: plaidItemDbId)
                if count > 0 {
                    MoatDataRefresh.notifyTransactionsChanged()
                    return true
                }
            } catch {
                AppLogger.warn(
                    "Post-connect transaction poll failed",
                    metadata: [
                        "operation": "postConnectTransactionPolling",
                        "attempt": String(attempt + 1),
                    ]
                )
            }
        }

        return false
    }
}
