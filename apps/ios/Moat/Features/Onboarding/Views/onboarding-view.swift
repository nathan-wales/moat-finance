import SwiftUI

struct OnboardingView: View {
    @StateObject private var viewModel = OnboardingViewModel()
    let onComplete: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    LoadingView("Preparing setup...")
                case .loaded, .saving:
                    content
                case .error(let error):
                    ErrorStateView(error: error) {
                        viewModel.retryAfterError()
                    }
                }
            }
            .navigationTitle("Setup")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Skip") {
                        viewModel.skipToFinish()
                    }
                    .disabled(viewModel.isBusy)
                }
            }
        }
        .task {
            await viewModel.load()
        }
        .onChange(of: viewModel.completed) { completed in
            if completed {
                onComplete()
            }
        }
        .sheet(item: onboardingActionMessageBinding) { message in
            MoatActionResultSheet(
                title: message.title,
                message: message.message
            ) {
                viewModel.clearActionMessage()
            }
        }
        .onChange(of: viewModel.currentStep) { step in
            if step == .profile {
                Task { await viewModel.onProfileStepAppeared() }
            }
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            progressHeader

            ZStack(alignment: .bottom) {
                Group {
                    if viewModel.currentStep == .finish {
                        finishStep
                    } else {
                        ScrollView {
                            VStack(spacing: MoatTheme.Spacing.xLarge) {
                                stepHeader
                                stepContent
                            }
                            .padding(MoatTheme.Spacing.large)
                            .padding(.bottom, bottomBarScrollInset)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .moatPageBackground()

                bottomChrome
            }
        }
    }

    private var progressHeader: some View {
        VStack(spacing: MoatTheme.Spacing.small) {
            HStack {
                Text("Step \(viewModel.currentStep.rawValue) of \(OnboardingStep.allCases.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Spacer()
            }

            ProgressView(value: Double(viewModel.currentStep.rawValue), total: Double(OnboardingStep.allCases.count))
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
        .padding(.vertical, MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.appBackground)
    }

    private var stepHeader: some View {
        VStack(spacing: MoatTheme.Spacing.small) {
            Text(viewModel.currentStep.title)
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)

            Text(viewModel.currentStep.subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.currentStep {
        case .goals:
            goalsStep
        case .profile:
            profileStep
        case .referral:
            referralStep
        case .finish:
            EmptyView()
        }
    }

    private var goalsStep: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
            ForEach(OnboardingGoalOption.all) { goal in
                let selected = viewModel.goals.contains(goal.id)

                Button {
                    viewModel.toggleGoal(goal)
                } label: {
                    VStack(spacing: MoatTheme.Spacing.small) {
                        Image(systemName: goal.systemImage)
                            .font(.title3.weight(.semibold))
                        Text(goal.label)
                            .font(.subheadline.weight(.semibold))
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, minHeight: 92)
                    .padding(MoatTheme.Spacing.medium)
                    .foregroundStyle(selected ? MoatTheme.ColorToken.accent : .primary)
                    .background(selected ? MoatTheme.ColorToken.accent.opacity(0.12) : MoatTheme.ColorToken.surface)
                    .overlay {
                        RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                            .stroke(selected ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.gray200, lineWidth: 4)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var profileStep: some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                OnboardingAllocationCard(
                    sections: viewModel.allocationSections,
                    total: viewModel.totalAllocationValue,
                    isLoading: viewModel.isLoadingAllocation
                )

                Text("You can add all your assets, including real estate, in your financial profile after onboarding.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            MoatCard(borderColor: MoatTheme.ColorToken.gray200) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                    if viewModel.isLoadingInstitutions, viewModel.connectedInstitutions.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    }

                    ForEach(viewModel.connectedInstitutions) { institution in
                        OnboardingConnectedInstitutionRow(institution: institution)
                    }

                    Button {
                        Task { await viewModel.connectWithLink() }
                    } label: {
                        Label("Connect account", systemImage: "link")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)
                    .disabled(viewModel.isBusy)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var referralStep: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            ForEach(OnboardingReferralSource.all) { source in
                let selected = viewModel.referralSource == source.id

                Button {
                    viewModel.referralSource = source.id
                } label: {
                    HStack {
                        Text(source.label)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(selected ? MoatTheme.ColorToken.accent : .secondary)
                    }
                    .padding(MoatTheme.Spacing.large)
                    .foregroundStyle(selected ? MoatTheme.ColorToken.accent : .primary)
                    .background(selected ? MoatTheme.ColorToken.accent.opacity(0.12) : MoatTheme.ColorToken.surface)
                    .overlay {
                        RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                            .stroke(selected ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.gray200, lineWidth: 4)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                }
                .buttonStyle(.plain)
            }

            if viewModel.referralSource == "other" {
                labeledTextField("Tell us more", text: $viewModel.referralSourceOther, placeholder: "Optional", keyboardType: .default)
            }
        }
    }

    private var finishStep: some View {
        ZStack {
            MoatSideConfettiView()

            VStack(spacing: MoatTheme.Spacing.large) {
                Image(systemName: "checkmark")
                    .font(.system(size: 52, weight: .semibold))
                    .foregroundStyle(MoatTheme.ColorToken.positive)

                VStack(spacing: MoatTheme.Spacing.small) {
                    Text("Moat is ready")
                        .font(.title3.weight(.bold))
                    Text("Your preferences are saved. The dashboard will fill in as your accounts and transactions sync.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: 300)
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.bottom, bottomBarScrollInset)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .id(viewModel.currentStep)
    }

    private var bottomChrome: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [
                    MoatTheme.ColorToken.appBackground.opacity(0),
                    MoatTheme.ColorToken.appBackground,
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 56)
            .allowsHitTesting(false)

            navigationBar
        }
    }

    private var bottomBarScrollInset: CGFloat {
        56 + MoatTheme.Size.buttonHeight + MoatTheme.Spacing.large * 2
    }

    private var navigationBar: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Button("Back") {
                viewModel.goBack()
            }
            .buttonStyle(.moatSecondary)
            .disabled(viewModel.currentStep == .goals || viewModel.isBusy)

            Button {
                Task { await viewModel.goNext() }
            } label: {
                if case .saving = viewModel.state {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text(viewModel.currentStep == .finish ? "Go to Dashboard" : "Continue")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.moatPrimary)
            .disabled(!viewModel.canContinue || viewModel.isBusy)
        }
        .padding(MoatTheme.Spacing.large)
        .background(MoatTheme.ColorToken.appBackground)
    }

    private func labeledTextField(
        _ title: String,
        text: Binding<String>,
        placeholder: String,
        keyboardType: UIKeyboardType
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.medium))
            MoatTextField(
                placeholder: placeholder,
                text: text,
                keyboardType: keyboardType
            )
        }
    }

    private var onboardingActionMessageBinding: Binding<OnboardingActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }
}

#Preview {
    OnboardingView {}
}