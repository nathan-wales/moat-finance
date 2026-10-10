import Charts
import SwiftUI

struct FinancialChartInteractionOverlay<Point: Identifiable>: View where Point.ID: Equatable {
    let proxy: ChartProxy
    let geometry: GeometryProxy
    let points: [Point]
    let date: (Point) -> Date
    @Binding var selectedPoint: Point?

    var body: some View {
        FinancialChartHoldToInspectOverlay(
            onInspect: { location in
                updateSelection(at: location)
            },
            onEnd: {
                selectedPoint = nil
            }
        )
    }

    private func updateSelection(at location: CGPoint) {
        let plotFrame = geometry[proxy.plotAreaFrame]
        let xPosition = location.x - plotFrame.origin.x
        guard xPosition >= 0, xPosition <= plotFrame.width,
              let targetDate = proxy.value(atX: xPosition, as: Date.self),
              let nearestPoint = FinancialChartSelection.nearestPoint(
                to: targetDate,
                in: points,
                date: date
              ) else {
            return
        }

        if selectedPoint?.id != nearestPoint.id {
            if selectedPoint == nil {
                FinancialChartHaptics.prepare()
            }
            selectedPoint = nearestPoint
            FinancialChartHaptics.selectionChanged()
        }
    }
}
