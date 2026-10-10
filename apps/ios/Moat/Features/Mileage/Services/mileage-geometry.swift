import CoreLocation
import Foundation

enum MileagePolyline {
    static func encode(_ points: [CLLocationCoordinate2D], precision: Int = 5) -> String {
        if points.isEmpty { return "" }

        let factor = pow(10.0, Double(precision))
        var output = ""
        var previousLat = 0
        var previousLng = 0

        for point in points {
            let lat = Int((point.latitude * factor).rounded())
            let lng = Int((point.longitude * factor).rounded())
            output += encodeSigned(lat - previousLat)
            output += encodeSigned(lng - previousLng)
            previousLat = lat
            previousLng = lng
        }

        return output
    }

    static func decode(_ encoded: String, precision: Int = 5) -> [CLLocationCoordinate2D] {
        if encoded.isEmpty { return [] }

        let factor = pow(10.0, Double(precision))
        var points: [CLLocationCoordinate2D] = []
        let characters = Array(encoded.utf16)
        var index = 0
        var lat = 0
        var lng = 0

        while index < characters.count {
            let deltaLat = nextSignedValue(characters, index: &index)
            lat += deltaLat
            let deltaLng = nextSignedValue(characters, index: &index)
            lng += deltaLng
            points.append(
                CLLocationCoordinate2D(
                    latitude: Double(lat) / factor,
                    longitude: Double(lng) / factor
                )
            )
        }

        return points
    }

    static func encodeSegments(_ segments: [MileageSegment]) -> [String] {
        segments.compactMap { segment in
            let coordinates = simplify(
                segment.points.map {
                    CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
                },
                toleranceMeters: 15
            )
            let encoded = encode(coordinates)
            return encoded.isEmpty ? nil : encoded
        }
    }

    static func simplify(
        _ points: [CLLocationCoordinate2D],
        toleranceMeters: CLLocationDistance
    ) -> [CLLocationCoordinate2D] {
        guard points.count > 2 else { return points }
        return simplifySection(points, start: 0, end: points.count - 1, toleranceMeters: toleranceMeters)
    }

    private static func simplifySection(
        _ points: [CLLocationCoordinate2D],
        start: Int,
        end: Int,
        toleranceMeters: CLLocationDistance
    ) -> [CLLocationCoordinate2D] {
        if end <= start + 1 {
            return [points[start], points[end]]
        }

        var farthestDistance: CLLocationDistance = 0
        var farthestIndex = start
        for index in (start + 1) ..< end {
            let distance = perpendicularDistanceMeters(points[index], start: points[start], end: points[end])
            if distance > farthestDistance {
                farthestDistance = distance
                farthestIndex = index
            }
        }

        if farthestDistance <= toleranceMeters {
            return [points[start], points[end]]
        }

        let leading = simplifySection(points, start: start, end: farthestIndex, toleranceMeters: toleranceMeters)
        let trailing = simplifySection(points, start: farthestIndex, end: end, toleranceMeters: toleranceMeters)
        return leading + trailing.dropFirst()
    }

    private static func perpendicularDistanceMeters(
        _ point: CLLocationCoordinate2D,
        start: CLLocationCoordinate2D,
        end: CLLocationCoordinate2D
    ) -> CLLocationDistance {
        let startLocation = CLLocation(latitude: start.latitude, longitude: start.longitude)
        let endLocation = CLLocation(latitude: end.latitude, longitude: end.longitude)
        let pointLocation = CLLocation(latitude: point.latitude, longitude: point.longitude)
        let lineLength = startLocation.distance(from: endLocation)
        if lineLength < 1 {
            return pointLocation.distance(from: startLocation)
        }

        let startToPoint = startLocation.distance(from: pointLocation)
        let endToPoint = endLocation.distance(from: pointLocation)
        let along = (startToPoint * startToPoint - endToPoint * endToPoint + lineLength * lineLength) / (2 * lineLength)
        let clamped = min(max(along, 0), lineLength)
        let heightSquared = startToPoint * startToPoint - clamped * clamped
        return heightSquared > 0 ? sqrt(heightSquared) : 0
    }

    private static func encodeSigned(_ value: Int) -> String {
        var chunk = value < 0 ? ~(value << 1) : (value << 1)
        var encoded = ""
        while chunk >= 0x20 {
            encoded.append(asciiCharacter((0x20 | (chunk & 0x1f)) + 63))
            chunk >>= 5
        }
        encoded.append(asciiCharacter(chunk + 63))
        return encoded
    }

    private static func asciiCharacter(_ value: Int) -> Character {
        Character(UnicodeScalar(UInt8(value)))
    }

    private static func nextSignedValue(_ characters: [UInt16], index: inout Int) -> Int {
        var result = 0
        var shift = 0
        var byte = 0
        repeat {
            guard index < characters.count else { return 0 }
            byte = Int(characters[index]) - 63
            index += 1
            result |= (byte & 0x1f) << shift
            shift += 5
        } while byte >= 0x20 && index < characters.count
        return (result & 1) != 0 ? ~(result >> 1) : (result >> 1)
    }
}

enum MileageLocationFilter {
    static let maximumAccuracyMeters: CLLocationAccuracy = 50
    static let maximumAgeSeconds: TimeInterval = 10
    static let minimumMovementMeters: CLLocationDistance = 5
    static let maximumImpliedSpeedMetersPerSecond: CLLocationSpeed = 70

    static func shouldAccept(_ location: CLLocation, previous: CLLocation?) -> Bool {
        if location.horizontalAccuracy < 0 || location.horizontalAccuracy > maximumAccuracyMeters {
            return false
        }
        if abs(location.timestamp.timeIntervalSinceNow) > maximumAgeSeconds {
            return false
        }
        guard let previous else { return true }

        let distance = location.distance(from: previous)
        if distance < minimumMovementMeters {
            return false
        }

        let elapsed = location.timestamp.timeIntervalSince(previous.timestamp)
        if elapsed <= 0 {
            return false
        }

        let impliedSpeed = distance / elapsed
        return impliedSpeed <= maximumImpliedSpeedMetersPerSecond
    }
}

enum MileageDistance {
    static func meters(in segments: [MileageSegment]) -> Double {
        segments.reduce(0) { total, segment in
            total + meters(in: segment.points)
        }
    }

    static func meters(in points: [MileageCoordinate]) -> Double {
        guard points.count >= 2 else { return 0 }
        var total: Double = 0
        for index in 1 ..< points.count {
            let previous = CLLocation(
                latitude: points[index - 1].latitude,
                longitude: points[index - 1].longitude
            )
            let current = CLLocation(
                latitude: points[index].latitude,
                longitude: points[index].longitude
            )
            total += current.distance(from: previous)
        }
        return total
    }
}
