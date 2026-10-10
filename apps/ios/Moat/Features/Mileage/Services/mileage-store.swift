import Foundation

actor MileageStore {
    private let fileURL: URL
    private var trips: [StoredMileageTrip] = []
    private var didLoad = false

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let directory = support.appendingPathComponent("Moat", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("mileage-trips.json")
    }

    func list(year: Int) async -> [StoredMileageTrip] {
        await loadIfNeeded()
        return trips
            .filter { Calendar.current.component(.year, from: $0.trip.startedAt) == year }
            .sorted { $0.trip.startedAt > $1.trip.startedAt }
    }

    func pending() async -> [StoredMileageTrip] {
        await loadIfNeeded()
        return trips.filter { $0.syncStatus != .synced }
    }

    func upsert(_ stored: StoredMileageTrip) async {
        await loadIfNeeded()
        if let index = trips.firstIndex(where: { $0.id == stored.id }) {
            trips[index] = stored
        } else {
            trips.append(stored)
        }
        persist()
    }

    func replaceRemote(_ remoteTrips: [MileageTrip], year: Int) async {
        await loadIfNeeded()
        let pendingIds = Set(trips.filter { $0.syncStatus != .synced }.map(\.id))
        trips.removeAll { stored in
            Calendar.current.component(.year, from: stored.trip.startedAt) == year
                && pendingIds.contains(stored.id) == false
        }
        for remote in remoteTrips {
            if pendingIds.contains(remote.id) { continue }
            let stored = StoredMileageTrip(trip: remote, syncStatus: .synced)
            if let index = trips.firstIndex(where: { $0.id == remote.id }) {
                trips[index] = stored
            } else {
                trips.append(stored)
            }
        }
        persist()
    }

    func updatePurpose(id: String, purpose: String) async -> StoredMileageTrip? {
        await loadIfNeeded()
        guard let index = trips.firstIndex(where: { $0.id == id }) else { return nil }
        trips[index].trip.businessPurpose = purpose
        trips[index].trip.updatedAt = Date()
        if trips[index].syncStatus == .synced {
            trips[index].syncStatus = .pending
        }
        persist()
        return trips[index]
    }

    private func loadIfNeeded() async {
        if didLoad { return }
        didLoad = true
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            trips = try decoder.decode([StoredMileageTrip].self, from: data)
        } catch {
            AppLogger.warn(
                "Failed to load saved mileage trips",
                metadata: ["operation": "mileage.store.load"]
            )
            trips = []
        }
    }

    private func persist() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(trips)
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            AppLogger.warn(
                "Failed to persist saved mileage trips",
                metadata: ["operation": "mileage.store.persist"]
            )
        }
    }
}

actor MileageService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func list(year: Int) async throws -> MileageTripList {
        try await apiClient.post(
            path: "/api/v1/mileage/list",
            body: MileageYearInput(year: year)
        )
    }

    func upsert(_ trip: MileageTrip) async throws -> MileageTrip {
        try await apiClient.post(
            path: "/api/v1/mileage/upsert",
            body: UpsertMileageTripBody(
                id: trip.id,
                startedAt: trip.startedAt,
                endedAt: trip.endedAt,
                distanceMeters: trip.distanceMeters,
                trackedDurationSeconds: trip.trackedDurationSeconds,
                startLatitude: trip.startLatitude,
                startLongitude: trip.startLongitude,
                endLatitude: trip.endLatitude,
                endLongitude: trip.endLongitude,
                encodedPolylines: trip.encodedPolylines,
                businessPurpose: trip.businessPurpose
            )
        )
    }

    func updatePurpose(id: String, businessPurpose: String) async throws -> MileageTrip {
        try await apiClient.post(
            path: "/api/v1/mileage/updatePurpose",
            body: UpdateMileagePurposeBody(id: id, businessPurpose: businessPurpose)
        )
    }
}
