import CoreGraphics
import Foundation

enum FinancialChartInteraction {
    static let holdDuration: TimeInterval = 0.3
    static let movementThreshold: CGFloat = 10
    static let accessibilityHint = "Touch and hold, then drag to inspect each period."

    static func distance(from start: CGPoint, to end: CGPoint) -> CGFloat {
        hypot(end.x - start.x, end.y - start.y)
    }
}

enum FinancialChartInspectionPhase: Equatable {
    case idle
    case waitingToActivate
    case inspecting
}

enum FinancialChartInspectionMoveResult: Equatable {
    case ignore
    case cancelHold
    case updateInspection
}

struct FinancialChartInspectionController: Equatable {
    var holdDuration: TimeInterval
    var movementThreshold: CGFloat
    private(set) var phase: FinancialChartInspectionPhase = .idle
    private(set) var startLocation: CGPoint = .zero
    private(set) var currentLocation: CGPoint = .zero

    init(
        holdDuration: TimeInterval = FinancialChartInteraction.holdDuration,
        movementThreshold: CGFloat = FinancialChartInteraction.movementThreshold
    ) {
        self.holdDuration = holdDuration
        self.movementThreshold = movementThreshold
    }

    var isInspecting: Bool {
        phase == .inspecting
    }

    mutating func touchBegan(at location: CGPoint) {
        phase = .waitingToActivate
        startLocation = location
        currentLocation = location
    }

    mutating func touchMoved(to location: CGPoint) -> FinancialChartInspectionMoveResult {
        currentLocation = location

        switch phase {
        case .idle:
            return .ignore
        case .waitingToActivate:
            if FinancialChartInteraction.distance(from: startLocation, to: location) > movementThreshold {
                phase = .idle
                return .cancelHold
            }
            return .ignore
        case .inspecting:
            return .updateInspection
        }
    }

    mutating func holdDurationElapsed() -> Bool {
        guard phase == .waitingToActivate else { return false }
        phase = .inspecting
        return true
    }

    mutating func touchEnded() {
        phase = .idle
    }

    mutating func touchCancelled() {
        phase = .idle
    }
}
