import Foundation

struct FinancialChartSelectionPoint<ID: Hashable>: Identifiable, Equatable {
    let id: ID
    let date: Date
    let value: Double
    let label: String

    init(id: ID, date: Date, value: Double, label: String = "") {
        self.id = id
        self.date = date
        self.value = value
        self.label = label
    }
}

enum FinancialChartSelection {
    static func nearestPoint<ID>(
        to targetDate: Date,
        in points: [FinancialChartSelectionPoint<ID>]
    ) -> FinancialChartSelectionPoint<ID>? {
        nearestPoint(to: targetDate, in: points, date: \.date)
    }

    static func nearestPoint<Point>(
        to targetDate: Date,
        in points: [Point],
        date: (Point) -> Date
    ) -> Point? {
        guard let firstPoint = points.first else { return nil }

        return points.dropFirst().reduce(firstPoint) { nearest, point in
            let nearestDistance = abs(date(nearest).timeIntervalSince(targetDate))
            let pointDistance = abs(date(point).timeIntervalSince(targetDate))
            return pointDistance < nearestDistance ? point : nearest
        }
    }

    static func paddedDomain(values: [Double], includeZero: Bool) -> ClosedRange<Double> {
        guard let rawMinimum = values.min(), let rawMaximum = values.max() else {
            return 0...1
        }

        var minimum = includeZero ? min(rawMinimum, 0) : rawMinimum
        var maximum = includeZero ? max(rawMaximum, 0) : rawMaximum

        if minimum == maximum {
            let padding = max(abs(minimum) * 0.12, 1)
            minimum -= padding
            maximum += padding
        } else {
            let padding = max((maximum - minimum) * 0.12, 1)
            minimum -= padding
            maximum += padding
        }

        if includeZero {
            minimum = min(minimum, 0)
            maximum = max(maximum, 0)
        }

        return minimum...maximum
    }
}
