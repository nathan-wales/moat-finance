import XCTest
@testable import Moat

final class FinancialChartInteractionTests: XCTestCase {
    func testHoldDurationAndMovementThresholdAreCentralized() {
        XCTAssertEqual(FinancialChartInteraction.holdDuration, 0.3, accuracy: 0.000_1)
        XCTAssertEqual(FinancialChartInteraction.movementThreshold, 10)
    }

    func testImmediateMovementCancelsHoldBeforeActivation() {
        var controller = FinancialChartInspectionController()
        controller.touchBegan(at: CGPoint(x: 40, y: 40))

        XCTAssertEqual(
            controller.touchMoved(to: CGPoint(x: 40, y: 52)),
            .cancelHold
        )
        XCTAssertEqual(controller.phase, .idle)
        XCTAssertFalse(controller.holdDurationElapsed())
    }

    func testHorizontalMovementAlsoCancelsHold() {
        var controller = FinancialChartInspectionController()
        controller.touchBegan(at: CGPoint(x: 40, y: 40))

        XCTAssertEqual(
            controller.touchMoved(to: CGPoint(x: 51, y: 40)),
            .cancelHold
        )
        XCTAssertEqual(controller.phase, .idle)
    }

    func testMovementAtThresholdDoesNotCancelHold() {
        var controller = FinancialChartInspectionController()
        controller.touchBegan(at: CGPoint(x: 0, y: 0))

        XCTAssertEqual(
            controller.touchMoved(to: CGPoint(x: FinancialChartInteraction.movementThreshold, y: 0)),
            .ignore
        )
        XCTAssertEqual(controller.phase, .waitingToActivate)
        XCTAssertTrue(controller.holdDurationElapsed())
        XCTAssertEqual(controller.phase, .inspecting)
    }

    func testSmallMovementStillAllowsHoldActivation() {
        var controller = FinancialChartInspectionController()
        controller.touchBegan(at: CGPoint(x: 40, y: 40))

        XCTAssertEqual(
            controller.touchMoved(to: CGPoint(x: 46, y: 44)),
            .ignore
        )
        XCTAssertTrue(controller.holdDurationElapsed())
        XCTAssertTrue(controller.isInspecting)
    }

    func testHoldThenDragUpdatesInspectionUntilRelease() {
        var controller = FinancialChartInspectionController()
        controller.touchBegan(at: CGPoint(x: 20, y: 20))

        XCTAssertTrue(controller.holdDurationElapsed())
        XCTAssertEqual(
            controller.touchMoved(to: CGPoint(x: 180, y: 24)),
            .updateInspection
        )
        XCTAssertTrue(controller.isInspecting)

        controller.touchEnded()
        XCTAssertEqual(controller.phase, .idle)
        XCTAssertFalse(controller.isInspecting)
    }

    func testReleasingBeforeHoldDoesNotEnterInspection() {
        var controller = FinancialChartInspectionController()
        controller.touchBegan(at: CGPoint(x: 8, y: 8))
        controller.touchEnded()

        XCTAssertEqual(controller.phase, .idle)
        XCTAssertFalse(controller.holdDurationElapsed())
    }
}
