import Foundation

enum MileageTab: String, CaseIterable, Identifiable {
    case track
    case history

    var id: String { rawValue }

    var title: String {
        switch self {
        case .track: return "Track"
        case .history: return "History"
        }
    }
}

enum MileageHistoryMode: String, CaseIterable, Identifiable {
    case list
    case map

    var id: String { rawValue }

    var title: String {
        switch self {
        case .list: return "List"
        case .map: return "Map"
        }
    }
}

enum MileageSyncStatus: String, Codable, Equatable, Hashable {
    case pending
    case synced
    case failed
}

struct MileageCoordinate: Codable, Equatable {
    var latitude: Double
    var longitude: Double
    var timestamp: Date
    var horizontalAccuracy: Double
}

struct MileageSegment: Codable, Equatable {
    var points: [MileageCoordinate]
}

struct MileageTrip: Codable, Identifiable, Equatable, Hashable {
    let id: String
    var startedAt: Date
    var endedAt: Date
    var distanceMeters: Double
    var trackedDurationSeconds: Int
    var startLatitude: Double
    var startLongitude: Double
    var endLatitude: Double
    var endLongitude: Double
    var encodedPolylines: [String]
    var businessPurpose: String
    var estimatedDeductionCents: Int
    var createdAt: Date
    var updatedAt: Date
}

struct MileageYearSummary: Codable, Equatable {
    var year: Int
    var tripCount: Int
    var totalDistanceMeters: Double
    var estimatedDeductionCents: Int
}

struct MileageTripList: Codable, Equatable {
    var trips: [MileageTrip]
    var summary: MileageYearSummary
}

struct StoredMileageTrip: Codable, Identifiable, Equatable, Hashable {
    var trip: MileageTrip
    var syncStatus: MileageSyncStatus

    var id: String { trip.id }
}

struct ActiveMileageTrip: Codable, Equatable {
    var id: String
    var startedAt: Date
    var pausedAt: Date?
    var accumulatedPauseSeconds: TimeInterval
    var segments: [MileageSegment]
    var distanceMeters: Double
    var isPaused: Bool
}

struct MileageYearInput: Encodable {
    let year: Int
    let timeZone: String

    init(year: Int) {
        self.year = year
        timeZone = TimeZone.current.identifier
    }
}

struct MileageTripIdInput: Encodable {
    let id: String
}

struct UpsertMileageTripBody: Encodable {
    let id: String
    let startedAt: Date
    let endedAt: Date
    let distanceMeters: Double
    let trackedDurationSeconds: Int
    let startLatitude: Double
    let startLongitude: Double
    let endLatitude: Double
    let endLongitude: Double
    let encodedPolylines: [String]
    let businessPurpose: String
}

struct UpdateMileagePurposeBody: Encodable {
    let id: String
    let businessPurpose: String
}

enum MileageFormatting {
    static let metersPerMile = 1609.344

    static func miles(fromMeters meters: Double) -> Double {
        meters / metersPerMile
    }

    static func milesLabel(_ meters: Double) -> String {
        String(format: "%.1f mi", miles(fromMeters: meters))
    }

    static func elapsedLabel(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let remainder = seconds % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, remainder)
    }

    static func deductionLabel(_ cents: Int) -> String {
        CurrencyFormatter.format(Double(cents) / 100.0)
    }
}
