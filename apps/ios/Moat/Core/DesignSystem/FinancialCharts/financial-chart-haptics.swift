import UIKit

enum FinancialChartHaptics {
    private static let selectionGenerator: UISelectionFeedbackGenerator = {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        return generator
    }()

    static func prepare() {
        selectionGenerator.prepare()
    }

    static func selectionChanged() {
        selectionGenerator.selectionChanged()
        selectionGenerator.prepare()
    }
}
