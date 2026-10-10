import SwiftUI

struct InsightsChartRequestCtas: View {
    let tab: InsightsTab

    @State private var isFeedbackPresented = false
    @State private var feedbackMessage = ""
    @State private var isGatePresented = false
    @State private var isReportPresented = false
    @State private var reportPrompt = ""
    @State private var isCheckingConnection = false
    @State private var actionMessage: InsightsChartCtaActionMessage?

    private let promptsService = PromptsService()
    private let dispatchService = AskAIDispatchService()

    private var ctaMarkdown: AttributedString {
        var text = AttributedString(
            "Don't see the charts you want? Submit a feature request, or generate a custom report with your AI assistant."
        )
        text.font = .body
        text.foregroundColor = MoatTheme.ColorToken.textSecondary

        if let featureRange = text.range(of: "Submit a feature request") {
            text[featureRange].link = URL(string: "moat-insights://feature-request")
            text[featureRange].underlineStyle = .single
            text[featureRange].foregroundColor = MoatTheme.ColorToken.textPrimary
        }

        if let reportRange = text.range(of: "generate a custom report with your AI assistant") {
            text[reportRange].link = URL(string: "moat-insights://custom-report")
            text[reportRange].underlineStyle = .single
            text[reportRange].foregroundColor = MoatTheme.ColorToken.textPrimary
        }

        return text
    }

    var body: some View {
        Text(ctaMarkdown)
            .frame(maxWidth: .infinity, alignment: .leading)
            .environment(\.openURL, OpenURLAction { url in
                handleCTALink(url)
                return .handled
            })
            .sheet(isPresented: $isFeedbackPresented) {
                FeedbackSheet(
                    route: "insights/\(tab.rawValue)",
                    initialMessage: feedbackMessage
                )
            }
            .sheet(isPresented: $isGatePresented) {
                InsightsAiConnectionGateSheet(
                    onConnectAssistant: {
                        isGatePresented = false
                        AppNavigationCoordinator.shared.openAIAccess()
                    }
                )
            }
            .sheet(isPresented: $isReportPresented) {
                InsightsCustomReportSheet(
                    prompt: $reportPrompt,
                    onOpenChatGPT: { openProvider(.chatGPT) },
                    onOpenClaude: { openProvider(.claude) }
                )
            }
            .sheet(item: $actionMessage) { message in
                MoatActionResultSheet(title: message.title, message: message.message) {
                    actionMessage = nil
                }
            }
            .disabled(isCheckingConnection)
            .opacity(isCheckingConnection ? 0.6 : 1)
    }

    private func handleCTALink(_ url: URL) {
        switch url.host {
        case "feature-request":
            openFeatureRequest()
        case "custom-report":
            Task { await openCustomReport() }
        default:
            break
        }
    }

    private func openFeatureRequest() {
        feedbackMessage = InsightsChartCtaCopy.featureRequestMessage(for: tab)
        isFeedbackPresented = true
    }

    private func openCustomReport() async {
        isCheckingConnection = true
        defer { isCheckingConnection = false }

        do {
            let connected = try await promptsService.hasAiConnection()
            if connected {
                reportPrompt = InsightsChartCtaCopy.customReportPrompt(for: tab)
                isReportPresented = true
            } else {
                isGatePresented = true
            }
        } catch {
            isGatePresented = true
        }
    }

    private func openProvider(_ provider: AskAIProvider) {
        do {
            try dispatchService.openProvider(provider, prompt: reportPrompt)
            isReportPresented = false
        } catch {
            actionMessage = InsightsChartCtaActionMessage(
                title: "Could not open link",
                message: error.localizedDescription
            )
        }
    }
}

private struct InsightsChartCtaActionMessage: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

private struct InsightsAiConnectionGateSheet: View {
    let onConnectAssistant: () -> Void

    var body: some View {
        MoatGlassSheet(title: "Connect an AI assistant first") {
            Text("To generate a custom report with AI, connect an assistant to Moat first.")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        } footer: {
            Button(action: onConnectAssistant) {
                Text("Connect an assistant")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
        }
    }
}

private struct InsightsCustomReportSheet: View {
    @Binding var prompt: String
    let onOpenChatGPT: () -> Void
    let onOpenClaude: () -> Void
    @SwiftUI.Environment(\.dismiss) private var dismiss

    var body: some View {
        MoatGlassSheet(title: "Generate a custom report") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                Text("Edit the prompt below, then open it in your connected AI assistant.")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                MoatTextEditor(text: $prompt, minHeight: 160)
            }
        } footer: {
            VStack(spacing: MoatTheme.Spacing.medium) {
                Button(action: onOpenChatGPT) {
                    Label("Open in ChatGPT", systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)

                Button(action: onOpenClaude) {
                    Label("Open in Claude", systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)

                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(.moatSecondary)
            }
        }
    }
}
