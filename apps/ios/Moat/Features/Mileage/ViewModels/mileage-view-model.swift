import Combine
import Foundation

@MainActor
final class MileageViewModel: ObservableObject {
    enum HistoryState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published var selectedTab: MileageTab = .track
    @Published var historyMode: MileageHistoryMode = .list
    @Published var selectedYear: Int
    @Published var businessPurpose = ""
    @Published private(set) var trips: [StoredMileageTrip] = []
    @Published private(set) var summary: MileageYearSummary
    @Published private(set) var historyState: HistoryState = .idle
    @Published var actionError: String?
    @Published var selectedTrip: StoredMileageTrip?

    let tracker: MileageTracker
    private let store: MileageStore
    private let service: MileageService
    private var cancellables: Set<AnyCancellable> = []
    private var historyTask: Task<Void, Never>?

    init(
        tracker: MileageTracker? = nil,
        store: MileageStore = MileageStore(),
        service: MileageService = MileageService()
    ) {
        self.tracker = tracker ?? MileageTracker.shared
        self.store = store
        self.service = service
        let year = Calendar.current.component(.year, from: Date())
        selectedYear = year
        summary = MileageYearSummary(
            year: year,
            tripCount: 0,
            totalDistanceMeters: 0,
            estimatedDeductionCents: 0
        )
        self.tracker.objectWillChange
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    var yearOptions: [Int] {
        let current = Calendar.current.component(.year, from: Date())
        return Array((current - 4)...current).reversed()
    }

    var isDemoMode: Bool {
        let sessionKey = UserDefaults.standard.string(forKey: DemoModeDefaults.sessionKey)
        return sessionKey?.isEmpty == false
    }

    var canSaveCompletedTrip: Bool {
        businessPurpose.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    }

    func loadHistory() async {
        if case .idle = historyState {
            await reloadHistory(showLoading: true)
        }
    }

    func refreshHistory() async {
        await reloadHistory(showLoading: false, showRefreshing: true)
    }

    func changeYear(_ year: Int) {
        selectedYear = year
        historyTask?.cancel()
        historyTask = Task { await reloadHistory(showLoading: false, showRefreshing: true) }
    }

    func saveCompletedTrip() async {
        let purpose = businessPurpose.trimmingCharacters(in: .whitespacesAndNewlines)
        guard purpose.isEmpty == false else { return }
        guard var draft = tracker.consumeCompletedDraft() else { return }
        draft.businessPurpose = purpose
        draft.estimatedDeductionCents = BusinessMileageRates.estimatedDeductionCents(
            distanceMeters: draft.distanceMeters,
            on: draft.startedAt
        )
        draft.updatedAt = Date()
        businessPurpose = ""
        let stored = StoredMileageTrip(trip: draft, syncStatus: .pending)
        await store.upsert(stored)
        Analytics.capture("mileage_trip_saved")
        await sync(stored)
        selectedTab = .history
        await reloadHistory(showLoading: false)
    }

    func discardCompletedTrip() {
        businessPurpose = ""
        tracker.discardCompleted()
    }

    func updatePurpose(_ trip: StoredMileageTrip, purpose: String) async {
        let trimmed = purpose.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.isEmpty == false else { return }
        guard var updated = await store.updatePurpose(id: trip.id, purpose: trimmed) else { return }
        selectedTrip = updated
        await reloadLocal()
        if isDemoMode {
            return
        }
        do {
            let remote = try await service.updatePurpose(id: updated.id, businessPurpose: trimmed)
            updated.trip = remote
            updated.syncStatus = .synced
            await store.upsert(updated)
            selectedTrip = updated
            await reloadLocal()
        } catch {
            if error.isCancellation { return }
            updated.syncStatus = .failed
            await store.upsert(updated)
            AppLogger.warn(
                "Mileage purpose sync failed",
                metadata: ["operation": "mileage.sync.purpose"]
            )
        }
    }

    private func sync(_ stored: StoredMileageTrip) async {
        if isDemoMode { return }
        var next = stored
        do {
            let remote = try await service.upsert(stored.trip)
            next.trip = remote
            next.syncStatus = .synced
            await store.upsert(next)
        } catch {
            if error.isCancellation { return }
            next.syncStatus = .failed
            await store.upsert(next)
            AppLogger.warn(
                "Mileage trip sync failed",
                metadata: ["operation": "mileage.sync.upsert"]
            )
        }
    }

    private func reloadHistory(showLoading: Bool, showRefreshing: Bool = false) async {
        if showLoading { historyState = .loading }
        if showRefreshing { historyState = .refreshing }
        await reloadLocal()
        await pushPending()
        if isDemoMode == false {
            do {
                let remote = try await service.list(year: selectedYear)
                await store.replaceRemote(remote.trips, year: selectedYear)
                await reloadLocal()
                historyState = .loaded
            } catch {
                if error.isCancellation { return }
                historyState = trips.isEmpty ? .error(error) : .loaded
                if trips.isEmpty {
                    actionError = "Couldn't refresh mileage history."
                }
            }
            return
        }
        historyState = .loaded
    }

    private func pushPending() async {
        if isDemoMode { return }
        let pending = await store.pending()
        for stored in pending {
            await sync(stored)
        }
    }

    private func reloadLocal() async {
        let local = await store.list(year: selectedYear)
        trips = local
        summary = MileageYearSummary(
            year: selectedYear,
            tripCount: local.count,
            totalDistanceMeters: local.reduce(0) { $0 + $1.trip.distanceMeters },
            estimatedDeductionCents: local.reduce(0) { $0 + $1.trip.estimatedDeductionCents }
        )
        if let selectedId = selectedTrip?.id {
            selectedTrip = local.first(where: { $0.id == selectedId })
        }
    }
}
