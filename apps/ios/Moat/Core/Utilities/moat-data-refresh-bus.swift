import Foundation

enum MoatDataRefresh {
    static let transactionsDidChange = Notification.Name("moat.transactionsDidChange")
    static let dashboardDidChange = Notification.Name("moat.dashboardDidChange")
    static let setupGuideDidChange = Notification.Name("moat.setupGuideDidChange")

    static func notifyTransactionsChanged() {
        NotificationCenter.default.post(name: transactionsDidChange, object: nil)
        NotificationCenter.default.post(name: dashboardDidChange, object: nil)
    }

    static func notifySetupGuideChanged() {
        NotificationCenter.default.post(name: setupGuideDidChange, object: nil)
    }
}
