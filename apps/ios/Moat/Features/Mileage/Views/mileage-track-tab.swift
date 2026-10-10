import SwiftUI

struct MileageTrackTab: View {
    @ObservedObject var viewModel: MileageViewModel
    @ObservedObject var tracker: MileageTracker

    var body: some View {
        VStack(spacing: MoatTheme.Spacing.xLarge) {
            Spacer(minLength: MoatTheme.Spacing.large)
            stats
            Text(tracker.explanation)
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, MoatTheme.Spacing.xLarge)

            if let locationError = tracker.locationError {
                Text(locationError)
                    .font(.footnote)
                    .foregroundStyle(MoatTheme.ColorToken.destructive)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, MoatTheme.Spacing.xLarge)
            }

            controls
            Spacer()
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
        .padding(.bottom, 112)
    }

    private var stats: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            Text(MileageFormatting.milesLabel(tracker.distanceMeters))
                .font(.system(size: 48, weight: .semibold, design: .rounded))
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
            Text(MileageFormatting.elapsedLabel(tracker.elapsedSeconds))
                .font(.title2.monospacedDigit())
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        }
    }

    @ViewBuilder
    private var controls: some View {
        switch tracker.phase {
        case .idle:
            Button("Start", action: tracker.start)
                .buttonStyle(.moatPrimary)
        case .completing:
            EmptyView()
        case .tracking:
            HStack(spacing: MoatTheme.Spacing.medium) {
                Button("Pause", action: tracker.pause)
                    .buttonStyle(.moatSecondary)
                Button("Stop", action: tracker.stop)
                    .buttonStyle(.moatPrimary)
            }
        case .paused:
            HStack(spacing: MoatTheme.Spacing.medium) {
                Button("Resume", action: tracker.resume)
                    .buttonStyle(.moatPrimary)
                Button("Stop", action: tracker.stop)
                    .buttonStyle(.moatSecondary)
            }
        }
    }
}

struct MileageCompletionSheet: View {
    @ObservedObject var viewModel: MileageViewModel
    @ObservedObject var tracker: MileageTracker
    @State private var confirmDiscard = false

    var body: some View {
        MoatGlassSheet(title: "Save trip") {
            if let draft = tracker.completedDraft {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    stats(for: draft)
                    MileageRouteMapView(routes: [draft.mapRoute])
                        .frame(height: 180)
                        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("What was this trip for?")
                            .font(.headline)
                        MoatTextField(placeholder: "Client meeting", text: $viewModel.businessPurpose)
                    }
                }
            }
        } footer: {
            MoatSheetActionBar {
                Button("Discard") { confirmDiscard = true }
                    .buttonStyle(.moatSecondary)
                Button("Save Trip") {
                    Task { await viewModel.saveCompletedTrip() }
                }
                .buttonStyle(.moatPrimary)
                .disabled(viewModel.canSaveCompletedTrip == false)
            }
        }
        .interactiveDismissDisabled()
        .confirmationDialog("Discard this trip?", isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button("Discard trip", role: .destructive) {
                viewModel.discardCompletedTrip()
            }
            Button("Keep editing", role: .cancel) {}
        } message: {
            Text("This mileage log will be deleted and cannot be recovered.")
        }
    }

    private func stats(for draft: MileageTrip) -> some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                metric("Miles", MileageFormatting.milesLabel(draft.distanceMeters))
                metric("Duration", MileageFormatting.elapsedLabel(draft.trackedDurationSeconds))
                metric("Date", DateFormatterProvider.fullDate(draft.startedAt))
            }
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
    }
}
