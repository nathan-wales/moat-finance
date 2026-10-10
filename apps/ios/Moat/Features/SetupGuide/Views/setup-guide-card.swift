import Combine
import SwiftUI

struct SetupGuideCard: View {
    @StateObject private var viewModel = SetupGuideViewModel()
    @ObservedObject private var connectionStore = AIAccessConnectionStore.shared
    @AppStorage(DemoModeDefaults.sessionKey) private var demoSessionKey = ""
    @SwiftUI.Environment(\.scenePhase) private var scenePhase

    private var isDemoMode: Bool {
        !demoSessionKey.isEmpty
    }

    var body: some View {
        Group {
            if viewModel.isVisible, !isDemoMode {
                card
            }
        }
        .task {
            guard !isDemoMode else { return }
            await viewModel.load()
        }
        .onChange(of: scenePhase) { phase in
            guard phase == .active, !isDemoMode else { return }
            Task { await viewModel.load() }
        }
        .onReceive(NotificationCenter.default.publisher(for: MoatDataRefresh.setupGuideDidChange)) { _ in
            guard !isDemoMode else { return }
            Task { await viewModel.load() }
        }
        .onChange(of: connectionStore.state) { _ in
            guard !isDemoMode else { return }
            Task { await viewModel.load() }
        }
        .sheet(isPresented: $viewModel.isEditPresented) {
            SetupGuideEditSheet(
                selectedGoals: viewModel.state?.goals ?? [],
                onSave: { goals in
                    await viewModel.saveGoals(goals)
                }
            )
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack {
                Text("Setup guide")
                    .font(.headline)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                Spacer()
                Button("Edit") {
                    viewModel.isEditPresented = true
                }
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.accent)
                Button {
                    withAnimation(.easeInOut(duration: 0.28)) {
                        viewModel.isExpanded.toggle()
                    }
                } label: {
                    Image(systemName: viewModel.isExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                }
                .accessibilityLabel(viewModel.isExpanded ? "Collapse setup guide" : "Expand setup guide")
                Button {
                    Task { await viewModel.dismiss() }
                } label: {
                    Image(systemName: "xmark")
                }
                .accessibilityLabel("Dismiss setup guide")
            }
            .buttonStyle(.plain)
            .foregroundStyle(MoatTheme.ColorToken.textPrimary)

            ProgressView(value: viewModel.progress)
                .tint(MoatTheme.ColorToken.accent)

            Group {
                if viewModel.isExpanded {
                    ScrollView {
                        expandedList
                    }
                    .frame(maxHeight: 280)
                    .transition(.opacity)
                } else {
                    Button {
                        Task { await viewModel.openNextStep() }
                    } label: {
                        HStack(spacing: 4) {
                            Text("Next:")
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                            Text(viewModel.nextTitle)
                                .foregroundStyle(MoatTheme.ColorToken.accent)
                        }
                        .font(.subheadline)
                    }
                    .buttonStyle(.plain)
                    .transition(.opacity)
                }
            }
            .clipped()
        }
        .padding(MoatTheme.Spacing.large)
        .frame(maxWidth: 320, alignment: .leading)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
        .animation(.easeInOut(duration: 0.28), value: viewModel.isExpanded)
        .shadow(color: .black.opacity(0.12), radius: 16, x: 0, y: 8)
        .padding(.horizontal, MoatTheme.Spacing.large)
        .padding(.bottom, 64)
    }

    private var expandedList: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(viewModel.state?.steps ?? []) { step in
                DisclosureGroup(isExpanded: expandedBinding(for: step.id)) {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text(step.description)
                            .font(.caption)
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        Button("Continue") {
                            Task { await viewModel.openStep(step) }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(MoatTheme.ColorToken.accent)
                    }
                    .padding(.bottom, MoatTheme.Spacing.small)
                } label: {
                    HStack(spacing: MoatTheme.Spacing.small) {
                        if step.completed {
                            Image(systemName: "checkmark")
                                .foregroundStyle(MoatTheme.ColorToken.accent)
                        }
                        Text(step.title)
                            .font(.body)
                            .foregroundStyle(step.completed ? MoatTheme.ColorToken.textSecondary : MoatTheme.ColorToken.textPrimary)
                    }
                }
            }
        }
    }

    private func expandedBinding(for stepId: String) -> Binding<Bool> {
        Binding(
            get: { viewModel.expandedStepId == stepId },
            set: { isOpen in
                viewModel.expandedStepId = isOpen ? stepId : nil
            }
        )
    }
}
