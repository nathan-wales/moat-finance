import Foundation
import LinkKit
import UIKit

private func plaidLinkRemoteLogLevel(forEventName eventName: String) -> RemoteLogLevel {
    let normalized = eventName.uppercased()
    if normalized.contains("ERROR") || normalized.contains("FAIL") {
        return .error
    }
    return .info
}

@MainActor
final class PlaidLinkCoordinator {
    private static var activeHandler: Handler?

    private var handler: Handler?
    private var continuation: CheckedContinuation<PlaidLinkCompletion, Error>?

    static func continueFromRedirect(_ url: URL) -> Bool {
        guard let activeHandler else { return false }
        activeHandler.resumeAfterTermination(from: url)
        return true
    }

    func open(linkToken: String) async throws -> PlaidLinkCompletion {
        guard continuation == nil else {
            throw PlaidLinkError.alreadyPresenting
        }

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                self.createAndOpenHandler(linkToken: linkToken)
            }
        } onCancel: {
            Task { @MainActor in
                self.finish(.failure(PlaidLinkError.cancelled))
            }
        }
    }

    private func createAndOpenHandler(linkToken: String) {
        var configuration = LinkTokenConfiguration(token: linkToken) { [weak self] success in
            Task { @MainActor in
                self?.finish(
                    .success(
                        PlaidLinkCompletion(
                            publicToken: success.publicToken,
                            metadata: Self.metadata(from: success.metadata.metadataJSON)
                        )
                    )
                )
            }
        }

        configuration.onExit = { [weak self] exit in
            Task { @MainActor in
                if let error = exit.error {
                    self?.finish(.failure(PlaidLinkError.linkExited(error.localizedDescription)))
                } else {
                    self?.finish(.failure(PlaidLinkError.cancelled))
                }
            }
        }

        configuration.onEvent = { event in
            let eventName = String(describing: event.eventName)
            AppLogger.logRemote(
                level: plaidLinkRemoteLogLevel(forEventName: eventName),
                message: "Plaid Link event",
                event: "plaid.link_event",
                feature: "plaid",
                operation: "link",
                metadata: ["eventName": eventName]
            )
        }
        configuration.noLoadingState = false
        configuration.showGradientBackground = false

        let result = Plaid.create(configuration, onLoad: {
            AppLogger.info("Plaid Link loaded")
            if PlaidLinkPresentationHost.isSimulator {
                AppLogger.info(
                    "Plaid Link opened on iOS Simulator",
                    metadata: [
                        "note": "WebKit GPU process crashes are a known simulator issue and are usually non-fatal"
                    ]
                )
            }
        })

        switch result {
        case .failure(let error):
            finish(.failure(PlaidLinkError.createFailed(String(describing: error))))
        case .success(let handler):
            self.handler = handler
            Self.activeHandler = handler
            handler.open(
                presentUsing: .custom(
                    { linkViewController in
                        PlaidLinkPresentationHost.shared.present(linkViewController)
                    },
                    { _ in
                        PlaidLinkPresentationHost.shared.dismissPresented()
                    }
                )
            )
        }
    }

    private func finish(_ result: Result<PlaidLinkCompletion, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        Self.activeHandler = nil
        handler = nil
        PlaidLinkPresentationHost.shared.dismissPresented()

        switch result {
        case .success(let completion):
            continuation.resume(returning: completion)
        case .failure(let error):
            continuation.resume(throwing: error)
        }
    }

    private static func metadata(from rawMetadata: String?) -> PlaidLinkMetadata? {
        guard
            let rawMetadata,
            let data = rawMetadata.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let institution = object["institution"] as? [String: Any]
        else {
            return nil
        }

        let name = institution["name"] as? String
        let institutionId = institution["institution_id"] as? String
        guard name != nil || institutionId != nil else { return nil }

        return PlaidLinkMetadata(institutionName: name, institutionId: institutionId)
    }
}

enum PlaidLinkError: LocalizedError, Equatable {
    case alreadyPresenting
    case noPresenter
    case createFailed(String)
    case linkExited(String)
    case cancelled

    var errorDescription: String? {
        switch self {
        case .alreadyPresenting:
            return "A bank connection is already in progress."
        case .noPresenter:
            return "Unable to open the bank connection sheet."
        case .createFailed(let message):
            return "Unable to start bank connection. \(message)"
        case .linkExited(let message):
            return "Bank connection closed. \(message)"
        case .cancelled:
            return "Bank connection canceled."
        }
    }
}

@MainActor
private final class PlaidLinkPresentationHost {
    static let shared = PlaidLinkPresentationHost()

    static var isSimulator: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    private var overlayWindow: UIWindow?
    private weak var previousKeyWindow: UIWindow?

    func present(_ viewController: UIViewController) {
        dismissPresented(animated: false)

        guard let windowScene = activeWindowScene else {
            presentFromRootViewController(viewController)
            return
        }

        let window = UIWindow(windowScene: windowScene)
        window.windowLevel = .alert
        window.backgroundColor = .clear

        let root = UIViewController()
        root.view.backgroundColor = .clear
        window.rootViewController = root

        previousKeyWindow = windowScene.windows.first(where: \.isKeyWindow)
        overlayWindow = window
        window.makeKeyAndVisible()

        viewController.modalPresentationStyle = .fullScreen
        root.present(viewController, animated: true)
    }

    func dismissPresented(animated: Bool = true) {
        guard let window = overlayWindow else { return }

        let finish = { [weak self] in
            window.isHidden = true
            self?.overlayWindow = nil
            self?.previousKeyWindow?.makeKeyAndVisible()
            self?.previousKeyWindow = nil
        }

        guard let root = window.rootViewController, root.presentedViewController != nil else {
            finish()
            return
        }

        root.dismiss(animated: animated, completion: finish)
    }

    private var activeWindowScene: UIWindowScene? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
    }

    private func presentFromRootViewController(_ viewController: UIViewController) {
        guard let presenter = UIApplication.shared.moatPlaidPresenterViewController else {
            AppLogger.warn("Plaid Link could not resolve a presenter view controller")
            return
        }

        viewController.modalPresentationStyle = .fullScreen
        presenter.present(viewController, animated: true)
    }
}

private extension UIApplication {
    var moatPlaidPresenterViewController: UIViewController? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .rootViewController
    }
}
