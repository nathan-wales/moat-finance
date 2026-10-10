import Foundation

struct BusinessMileageRatePeriod {
    let effectiveFrom: String
    let effectiveTo: String
    let centsPerMile: Double
}

enum BusinessMileageRates {
    static let periods: [BusinessMileageRatePeriod] = [
        BusinessMileageRatePeriod(effectiveFrom: "2021-01-01", effectiveTo: "2021-12-31", centsPerMile: 56),
        BusinessMileageRatePeriod(effectiveFrom: "2022-01-01", effectiveTo: "2022-06-30", centsPerMile: 58.5),
        BusinessMileageRatePeriod(effectiveFrom: "2022-07-01", effectiveTo: "2022-12-31", centsPerMile: 62.5),
        BusinessMileageRatePeriod(effectiveFrom: "2023-01-01", effectiveTo: "2023-12-31", centsPerMile: 65.5),
        BusinessMileageRatePeriod(effectiveFrom: "2024-01-01", effectiveTo: "2024-12-31", centsPerMile: 67),
        BusinessMileageRatePeriod(effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", centsPerMile: 70),
        BusinessMileageRatePeriod(effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30", centsPerMile: 72.5),
        BusinessMileageRatePeriod(effectiveFrom: "2026-07-01", effectiveTo: "2026-12-31", centsPerMile: 76),
    ]

    static func centsPerMile(on date: Date) -> Double {
        let key = utcDateKey(date)
        if let match = periods.first(where: { key >= $0.effectiveFrom && key <= $0.effectiveTo }) {
            return match.centsPerMile
        }
        if let first = periods.first, key < first.effectiveFrom {
            return first.centsPerMile
        }
        return periods.last?.centsPerMile ?? 76
    }

    static func estimatedDeductionCents(distanceMeters: Double, on date: Date) -> Int {
        let miles = MileageFormatting.miles(fromMeters: distanceMeters)
        return Int((miles * centsPerMile(on: date)).rounded())
    }

    private static func utcDateKey(_ date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let year = components.year ?? 1970
        let month = components.month ?? 1
        let day = components.day ?? 1
        return String(format: "%04d-%02d-%02d", year, month, day)
    }
}
