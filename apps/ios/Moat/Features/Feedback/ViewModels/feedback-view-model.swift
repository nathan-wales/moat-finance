import Foundation
import UIKit

@MainActor
final class FeedbackViewModel: ObservableObject {
    enum SubmitState {
        case idle
        case submitting
        case success
        case error(String)
    }

    @Published var message = ""
    @Published private(set) var submitState: SubmitState = .idle

    let route: String

    private let service: FeedbackService

    init(
        route: String,
        initialMessage: String = "",
        service: FeedbackService = FeedbackService()
    ) {
        self.route = route
        self.service = service
        self.message = initialMessage
    }

    var canSubmit: Bool {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        guard trimmed.count <= FeedbackConstants.maxMessageLength else { return false }

        switch submitState {
        case .submitting, .success:
            return false
        case .idle, .error:
            break
        }

        return true
    }

    var characterCountLabel: String {
        "\(message.count) / \(FeedbackConstants.maxMessageLength)"
    }

    func submit() async {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard canSubmit else { return }

        submitState = .submitting

        let request = CreateFeedbackRequest(
            source: FeedbackConstants.source,
            message: String(trimmed.prefix(FeedbackConstants.maxMessageLength)),
            route: route,
            platform: FeedbackConstants.platform,
            appVersion: Environment.appVersion,
            userAgent: "MoatApp-iOS/\(Environment.appVersion)",
            metadata: Self.buildMetadata()
        )

        do {
            _ = try await service.createFeedback(request)
            submitState = .success
        } catch {
            AppLogger.error(
                "Failed to submit feedback",
                metadata: ["operation": "feedback.create", "route": route]
            )
            submitState = .error("Couldn't send feedback. Please try again.")
        }
    }

    private static func buildMetadata() -> [String: String] {
        let device = UIDevice.current
        let idiom: String
        switch device.userInterfaceIdiom {
        case .phone:
            idiom = "phone"
        case .pad:
            idiom = "pad"
        case .mac:
            idiom = "mac"
        case .tv:
            idiom = "tv"
        case .carPlay:
            idiom = "carPlay"
        case .unspecified:
            idiom = "unspecified"
        default:
            idiom = "unknown"
        }

        return [
            "deviceModel": device.model,
            "machine": Self.machineIdentifier(),
            "systemName": device.systemName,
            "systemVersion": device.systemVersion,
            "idiom": idiom,
            "locale": Locale.current.identifier,
            "buildNumber": Environment.buildNumber,
        ]
    }

    private static func machineIdentifier() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        return withUnsafePointer(to: &systemInfo.machine) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: 1) { cString in
                String(cString: cString)
            }
        }
    }
}
