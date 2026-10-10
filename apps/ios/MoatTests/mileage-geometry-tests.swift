import CoreLocation
import XCTest
@testable import Moat

final class MileageGeometryTests: XCTestCase {
    func testPauseResumeDoesNotConnectSegments() {
        let first = MileageSegment(points: [
            MileageCoordinate(latitude: 40.0, longitude: -105.0, timestamp: Date(), horizontalAccuracy: 5),
            MileageCoordinate(latitude: 40.0, longitude: -104.91, timestamp: Date(), horizontalAccuracy: 5),
        ])
        let second = MileageSegment(points: [
            MileageCoordinate(latitude: 40.2, longitude: -104.5, timestamp: Date(), horizontalAccuracy: 5),
            MileageCoordinate(latitude: 40.21, longitude: -104.43, timestamp: Date(), horizontalAccuracy: 5),
        ])

        let pausedTotal = MileageDistance.meters(in: [first, second])
        let connected = MileageDistance.meters(in: first.points + second.points)
        XCTAssertLessThan(pausedTotal, connected)
        XCTAssertGreaterThan(pausedTotal, 0)
    }

    func testPolylineRoundTrip() {
        let points = [
            CLLocationCoordinate2D(latitude: 40.0, longitude: -105.0),
            CLLocationCoordinate2D(latitude: 40.01, longitude: -105.02),
        ]
        let encoded = MileagePolyline.encode(points)
        let decoded = MileagePolyline.decode(encoded)
        XCTAssertEqual(decoded.count, 2)
        XCTAssertEqual(decoded[0].latitude, points[0].latitude, accuracy: 0.0001)
        XCTAssertEqual(decoded[0].longitude, points[0].longitude, accuracy: 0.0001)
    }

    func testLocationFilterDropsInaccurateAndJitterReadings() {
        let previous = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 40, longitude: -105),
            altitude: 0,
            horizontalAccuracy: 5,
            verticalAccuracy: 5,
            timestamp: Date()
        )
        let inaccurate = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 40.001, longitude: -105.001),
            altitude: 0,
            horizontalAccuracy: 200,
            verticalAccuracy: 5,
            timestamp: Date()
        )
        XCTAssertFalse(MileageLocationFilter.shouldAccept(inaccurate, previous: previous))

        let jitter = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 40.00001, longitude: -105.00001),
            altitude: 0,
            horizontalAccuracy: 5,
            verticalAccuracy: 5,
            timestamp: Date().addingTimeInterval(1)
        )
        XCTAssertFalse(MileageLocationFilter.shouldAccept(jitter, previous: previous))
    }

    func testSimplifyKeepsEndpointsAndDropsColinearNoise() {
        let points = [
            CLLocationCoordinate2D(latitude: 40.0, longitude: -105.0),
            CLLocationCoordinate2D(latitude: 40.00001, longitude: -104.995),
            CLLocationCoordinate2D(latitude: 40.0, longitude: -104.99),
        ]
        let simplified = MileagePolyline.simplify(points, toleranceMeters: 50)
        XCTAssertEqual(simplified.count, 2)
        XCTAssertEqual(simplified[0].latitude, points[0].latitude, accuracy: 0.0001)
        XCTAssertEqual(simplified[1].longitude, points[2].longitude, accuracy: 0.0001)
    }
}

final class MileageRatesTests: XCTestCase {
    func testUsesDateSpecificIrsRate() throws {
        let june = try XCTUnwrap(date(year: 2026, month: 6, day: 30))
        let july = try XCTUnwrap(date(year: 2026, month: 7, day: 1))
        XCTAssertEqual(BusinessMileageRates.centsPerMile(on: june), 72.5)
        XCTAssertEqual(BusinessMileageRates.centsPerMile(on: july), 76)

        let fiveMiles = 5 * MileageFormatting.metersPerMile
        XCTAssertEqual(BusinessMileageRates.estimatedDeductionCents(distanceMeters: fiveMiles, on: june), 363)
        XCTAssertEqual(BusinessMileageRates.estimatedDeductionCents(distanceMeters: fiveMiles, on: july), 380)
    }

    private func date(year: Int, month: Int, day: Int) -> Date? {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        return calendar.date(from: components)
    }
}
