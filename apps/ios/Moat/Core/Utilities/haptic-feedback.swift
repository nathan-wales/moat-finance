import UIKit

enum HapticFeedback {
    private static let saveOrSubmitGenerator = UIImpactFeedbackGenerator(style: .medium)
    private static let selectionGenerator = UISelectionFeedbackGenerator()

    static func saveOrSubmit() {
        saveOrSubmitGenerator.prepare()
        saveOrSubmitGenerator.impactOccurred()
    }

    static func multiSelectBegan() {
        saveOrSubmit()
    }

    static func selectionChanged() {
        selectionGenerator.selectionChanged()
        selectionGenerator.prepare()
    }
}
