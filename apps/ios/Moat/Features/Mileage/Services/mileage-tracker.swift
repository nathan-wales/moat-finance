import CoreLocation
import Foundation
import UIKit

@MainActor
final class MileageTracker: NSObject, ObservableObject {
    static let shared = MileageTracker()

    enum Phase: Equatable {
        case idle
        case tracking
        case paused
        case completing
    }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var distanceMeters: Double = 0
    @Published private(set) var elapsedSeconds: Int = 0
    @Published private(set) var authorizationStatus: CLAuthorizationStatus
    @Published private(set) var locationError: String?
    @Published private(set) var completedDraft: MileageTrip?

    private let locationManager = CLLocationManager()
    private let fileURL: URL
    private let draftURL: URL
    private var activeTrip: ActiveMileageTrip?
    private var elapsedTimer: Timer?
    private var lastAcceptedLocation: CLLocation?
    private var startAfterAuthorization = false
    private var persistWorkItem: DispatchWorkItem?

    var hasUnfinishedTrip: Bool {
        phase == .tracking || phase == .paused || phase == .completing
    }

    override private init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let directory = support.appendingPathComponent("Moat", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("mileage-active-trip.json")
        draftURL = directory.appendingPathComponent("mileage-completed-draft.json")
        authorizationStatus = locationManager.authorizationStatus
        super.init()
        locationManager.delegate = self
        locationManager.activityType = .automotiveNavigation
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 10
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = false
        restoreIfNeeded()
    }

    func prepareForLaunch() {
        if phase == .tracking {
            beginLocationUpdates()
        }
    }

    func persistNow() {
        persist(force: true)
        persistCompletedDraft()
    }

    var explanation: String {
        "Track business mileage for tax purposes. Start tracking when your business trip begins."
    }

    func start() {
        locationError = nil
        requestAuthorizationIfNeeded()
        guard canTrack else {
            if authorizationStatus == .notDetermined {
                startAfterAuthorization = true
                return
            }
            startAfterAuthorization = false
            locationError = permissionMessage
            return
        }
        startAfterAuthorization = false

        if phase == .paused {
            resume()
            return
        }

        let trip = ActiveMileageTrip(
            id: UUID().uuidString,
            startedAt: Date(),
            pausedAt: nil,
            accumulatedPauseSeconds: 0,
            segments: [MileageSegment(points: [])],
            distanceMeters: 0,
            isPaused: false
        )
        activeTrip = trip
        lastAcceptedLocation = nil
        phase = .tracking
        distanceMeters = 0
        elapsedSeconds = 0
        persist(force: true)
        beginLocationUpdates()
        startTimer()
        Analytics.capture("mileage_trip_started")
    }

    func pause() {
        guard phase == .tracking, var trip = activeTrip else { return }
        trip.isPaused = true
        trip.pausedAt = Date()
        activeTrip = trip
        phase = .paused
        stopLocationUpdates()
        persist(force: true)
        Analytics.capture("mileage_trip_paused")
    }

    func resume() {
        guard phase == .paused, var trip = activeTrip else { return }
        if let pausedAt = trip.pausedAt {
            trip.accumulatedPauseSeconds += Date().timeIntervalSince(pausedAt)
        }
        trip.pausedAt = nil
        trip.isPaused = false
        trip.segments.append(MileageSegment(points: []))
        lastAcceptedLocation = nil
        activeTrip = trip
        phase = .tracking
        persist(force: true)
        beginLocationUpdates()
        Analytics.capture("mileage_trip_resumed")
    }

    func stop() {
        guard phase == .tracking || phase == .paused, var trip = activeTrip else { return }
        stopLocationUpdates()
        if let pausedAt = trip.pausedAt {
            trip.accumulatedPauseSeconds += Date().timeIntervalSince(pausedAt)
            trip.pausedAt = nil
            trip.isPaused = false
        }
        let endedAt = Date()
        let trackedDuration = max(0, Int(endedAt.timeIntervalSince(trip.startedAt) - trip.accumulatedPauseSeconds))
        let firstPoint = trip.segments.flatMap(\.points).first
        let lastPoint = trip.segments.flatMap(\.points).last
        guard let firstPoint, let lastPoint else {
            resetIdle()
            locationError = "No usable GPS points were recorded. Try again with a clearer signal."
            return
        }

        let encoded = MileagePolyline.encodeSegments(trip.segments)
        completedDraft = MileageTrip(
            id: trip.id,
            startedAt: trip.startedAt,
            endedAt: endedAt,
            distanceMeters: trip.distanceMeters,
            trackedDurationSeconds: trackedDuration,
            startLatitude: firstPoint.latitude,
            startLongitude: firstPoint.longitude,
            endLatitude: lastPoint.latitude,
            endLongitude: lastPoint.longitude,
            encodedPolylines: encoded,
            businessPurpose: "",
            estimatedDeductionCents: BusinessMileageRates.estimatedDeductionCents(
                distanceMeters: trip.distanceMeters,
                on: trip.startedAt
            ),
            createdAt: trip.startedAt,
            updatedAt: endedAt
        )
        activeTrip = nil
        lastAcceptedLocation = nil
        phase = .completing
        elapsedSeconds = trackedDuration
        distanceMeters = trip.distanceMeters
        stopTimer()
        persistCompletedDraft()
        clearPersistedTrip()
        Analytics.capture("mileage_trip_stopped")
    }

    func discardCompleted() {
        completedDraft = nil
        resetIdle()
        Analytics.capture("mileage_trip_discarded")
    }

    func consumeCompletedDraft() -> MileageTrip? {
        let draft = completedDraft
        completedDraft = nil
        resetIdle()
        return draft
    }

    private var canTrack: Bool {
        authorizationStatus == .authorizedAlways || authorizationStatus == .authorizedWhenInUse
    }

    private var permissionMessage: String {
        "Location is used only while you are actively tracking a business mileage trip. Enable Location for Moat in Settings to start."
    }

    private func requestAuthorizationIfNeeded() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse:
            locationManager.requestAlwaysAuthorization()
        default:
            break
        }
    }

    private func beginLocationUpdates() {
        if locationManager.authorizationStatus == .authorizedWhenInUse {
            locationManager.requestAlwaysAuthorization()
        }
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.showsBackgroundLocationIndicator = true
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.startUpdatingLocation()
        UIApplication.shared.isIdleTimerDisabled = true
    }

    private func stopLocationUpdates() {
        locationManager.stopUpdatingLocation()
        locationManager.allowsBackgroundLocationUpdates = false
        locationManager.showsBackgroundLocationIndicator = false
        UIApplication.shared.isIdleTimerDisabled = false
    }

    private func startTimer() {
        stopTimer()
        let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.tickElapsed()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        elapsedTimer = timer
        tickElapsed()
    }

    private func stopTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = nil
    }

    private func tickElapsed() {
        guard let trip = activeTrip else { return }
        let pauseOffset: TimeInterval
        if let pausedAt = trip.pausedAt {
            pauseOffset = trip.accumulatedPauseSeconds + Date().timeIntervalSince(pausedAt)
        } else {
            pauseOffset = trip.accumulatedPauseSeconds
        }
        elapsedSeconds = max(0, Int(Date().timeIntervalSince(trip.startedAt) - pauseOffset))
    }

    private func persist(force: Bool = false) {
        persistWorkItem?.cancel()
        if force {
            writeActiveTrip()
            return
        }
        let work = DispatchWorkItem { [weak self] in
            Task { @MainActor in
                self?.writeActiveTrip()
            }
        }
        persistWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: work)
    }

    private func writeActiveTrip() {
        guard let activeTrip else { return }
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(activeTrip)
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            AppLogger.warn(
                "Failed to persist active mileage trip",
                metadata: ["operation": "mileage.persist"]
            )
        }
    }

    private func persistCompletedDraft() {
        guard let completedDraft else {
            clearCompletedDraft()
            return
        }
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(completedDraft)
            try data.write(to: draftURL, options: [.atomic])
        } catch {
            AppLogger.warn(
                "Failed to persist completed mileage trip",
                metadata: ["operation": "mileage.persist.draft"]
            )
        }
    }

    private func restoreIfNeeded() {
        if restoreCompletedDraft() { return }
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            var trip = try decoder.decode(ActiveMileageTrip.self, from: data)
            distanceMeters = trip.distanceMeters
            if trip.isPaused {
                lastAcceptedLocation = lastLocation(in: trip)
                activeTrip = trip
                phase = .paused
            } else {
                trip.segments.append(MileageSegment(points: []))
                lastAcceptedLocation = nil
                activeTrip = trip
                phase = .tracking
                persist(force: true)
                beginLocationUpdates()
            }
            startTimer()
        } catch {
            clearPersistedTrip()
        }
    }

    private func restoreCompletedDraft() -> Bool {
        guard FileManager.default.fileExists(atPath: draftURL.path) else { return false }
        do {
            let data = try Data(contentsOf: draftURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let draft = try decoder.decode(MileageTrip.self, from: data)
            completedDraft = draft
            distanceMeters = draft.distanceMeters
            elapsedSeconds = draft.trackedDurationSeconds
            phase = .completing
            return true
        } catch {
            clearCompletedDraft()
            return false
        }
    }

    private func lastLocation(in trip: ActiveMileageTrip) -> CLLocation? {
        trip.segments.last?.points.last.map { point in
            CLLocation(
                coordinate: CLLocationCoordinate2D(latitude: point.latitude, longitude: point.longitude),
                altitude: 0,
                horizontalAccuracy: point.horizontalAccuracy,
                verticalAccuracy: -1,
                timestamp: point.timestamp
            )
        }
    }

    private func clearPersistedTrip() {
        persistWorkItem?.cancel()
        try? FileManager.default.removeItem(at: fileURL)
    }

    private func clearCompletedDraft() {
        try? FileManager.default.removeItem(at: draftURL)
    }

    private func resetIdle() {
        phase = .idle
        distanceMeters = 0
        elapsedSeconds = 0
        activeTrip = nil
        lastAcceptedLocation = nil
        completedDraft = nil
        stopTimer()
        stopLocationUpdates()
        clearPersistedTrip()
        clearCompletedDraft()
    }

    private func append(location: CLLocation) {
        guard phase == .tracking, var trip = activeTrip else { return }
        guard MileageLocationFilter.shouldAccept(location, previous: lastAcceptedLocation) else { return }

        let coordinate = MileageCoordinate(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            timestamp: location.timestamp,
            horizontalAccuracy: location.horizontalAccuracy
        )
        if trip.segments.isEmpty {
            trip.segments.append(MileageSegment(points: [coordinate]))
        } else {
            var segment = trip.segments[trip.segments.count - 1]
            segment.points.append(coordinate)
            trip.segments[trip.segments.count - 1] = segment
        }
        trip.distanceMeters = MileageDistance.meters(in: trip.segments)
        activeTrip = trip
        lastAcceptedLocation = location
        distanceMeters = trip.distanceMeters
        persist()
    }
}

extension MileageTracker: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            authorizationStatus = manager.authorizationStatus
            if manager.authorizationStatus == .authorizedAlways
                || manager.authorizationStatus == .authorizedWhenInUse
            {
                if phase == .tracking {
                    locationManager.allowsBackgroundLocationUpdates = true
                }
                locationError = nil
                if startAfterAuthorization, phase == .idle {
                    start()
                }
            } else if startAfterAuthorization {
                startAfterAuthorization = false
                locationError = permissionMessage
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            for location in locations {
                append(location: location)
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            AppLogger.warn(
                "Mileage location update failed",
                metadata: ["operation": "mileage.location", "code": (error as NSError).code]
            )
            locationError = "Couldn't read your location. Try moving somewhere with a clearer GPS signal."
        }
    }
}
