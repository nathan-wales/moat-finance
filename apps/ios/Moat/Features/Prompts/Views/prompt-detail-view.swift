import SwiftUI

struct PromptDetailView: View {
    @ObservedObject var viewModel: PromptsViewModel
    let prompt: AiPrompt

    private let dispatchService = AskAIDispatchService()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    Text(prompt.title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                    FlowLayout(spacing: MoatTheme.Spacing.xSmall) {
                        ForEach(prompt.tags) { tag in
                            Text(tag.displayTitle)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                                .padding(.horizontal, MoatTheme.Spacing.small)
                                .padding(.vertical, 4)
                                .background(MoatTheme.ColorToken.mutedSurface)
                                .clipShape(Capsule())
                        }
                    }
                }

                MoatCard {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Prompt text")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                        Text(viewModel.assembledPrompt(for: prompt))
                            .font(.body)
                            .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                VStack(spacing: MoatTheme.Spacing.small) {
                    Button {
                        copyPrompt()
                    } label: {
                        Label("Copy Prompt", systemImage: "doc.on.doc")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)

                    Button {
                        openProvider(.chatGPT)
                    } label: {
                        Label("Open in ChatGPT", systemImage: "arrow.up.right.square")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)

                    Button {
                        openProvider(.claude)
                    } label: {
                        Label("Open in Claude", systemImage: "arrow.up.right.square")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, MoatTheme.Spacing.xLarge)
        }
        .moatPageBackground()
        .navigationTitle("Prompt")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: actionMessageBinding) { message in
            MoatActionResultSheet(
                title: message.title,
                message: message.message
            ) {
                viewModel.clearActionMessage()
            }
        }
    }

    private var actionMessageBinding: Binding<PromptActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil {
                    viewModel.clearActionMessage()
                }
            }
        )
    }

    private func copyPrompt() {
        let text = viewModel.assembledPrompt(for: prompt)
        dispatchService.copyToClipboard(text)
        Task {
            await viewModel.recordLaunch(source: .curated, promptId: prompt.id)
        }
        viewModel.actionMessage = PromptActionMessage(
            title: "Copied",
            message: "Prompt copied to clipboard."
        )
    }

    private func openProvider(_ provider: AskAIProvider) {
        let text = viewModel.assembledPrompt(for: prompt)
        do {
            try dispatchService.openProvider(provider, prompt: text)
            Task {
                await viewModel.recordLaunch(source: .curated, promptId: prompt.id)
            }
        } catch {
            viewModel.actionMessage = PromptActionMessage(
                title: "Could not open link",
                message: error.localizedDescription
            )
        }
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, frame) in result.frames.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var frames: [CGRect] = []

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }

            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return (CGSize(width: maxWidth, height: y + rowHeight), frames)
    }
}
