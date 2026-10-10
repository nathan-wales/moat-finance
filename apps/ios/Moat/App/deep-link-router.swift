import SwiftUI
import UIKit

@MainActor
final class DeepLinkRouter: ObservableObject {
    func handle(_ url: URL) {
        if PlaidLinkCoordinator.continueFromRedirect(url) {
            AppLogger.info("Handled Plaid Link redirect")
            return
        }

        guard isHouseholdInvite(url) else {
            AppLogger.info("Unhandled deep link", metadata: ["scheme": url.scheme ?? "unknown"])
            return
        }

        UIApplication.shared.open(webHouseholdInviteURL(from: url))
    }

    private func isHouseholdInvite(_ url: URL) -> Bool {
        let path = url.path.lowercased()
        let host = url.host?.lowercased()

        if path == "/household/accept" { return true }
        return host == "household" && path == "/accept"
    }

    private func webHouseholdInviteURL(from url: URL) -> URL {
        guard var components = URLComponents(url: Environment.webBaseURL.appendingPathComponent("household/accept"), resolvingAgainstBaseURL: false) else {
            return Environment.webBaseURL
        }

        components.queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        return components.url ?? Environment.webBaseURL
    }
}
