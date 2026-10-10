import SwiftUI

struct MileageHistoryTab: View {
    @ObservedObject var viewModel: MileageViewModel

    var body: some View {
        Group {
            switch viewModel.historyState {
            case .idle, .loading:
                LoadingView("Loading mileage...")
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refreshHistory() }
                }
            case .loaded, .refreshing:
                loadedContent
            }
        }
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                yearAndSummary
                Picker("History view", selection: $viewModel.historyMode) {
                    ForEach(MileageHistoryMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                historyBody
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .refreshable { await viewModel.refreshHistory() }
        .sheet(item: $viewModel.selectedTrip) { trip in
            NavigationStack {
                MileageTripDetailView(viewModel: viewModel, trip: trip)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Close") { viewModel.selectedTrip = nil }
                        }
                    }
            }
        }
    }

    private var yearAndSummary: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Picker("Year", selection: yearBinding) {
                ForEach(viewModel.yearOptions, id: \.self) { year in
                    Text(String(year)).tag(year)
                }
            }
            .pickerStyle(.menu)

            MoatCard {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    metric("Business miles", MileageFormatting.milesLabel(viewModel.summary.totalDistanceMeters))
                    metric("Estimated deduction", MileageFormatting.deductionLabel(viewModel.summary.estimatedDeductionCents))
                }
            }
        }
    }

    @ViewBuilder
    private var historyBody: some View {
        if viewModel.trips.isEmpty {
            MoatCard {
                Text("No business trips saved for \(String(viewModel.selectedYear)) yet.")
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else if viewModel.historyMode == .list {
            VStack(spacing: MoatTheme.Spacing.small) {
                ForEach(viewModel.trips) { stored in
                    Button {
                        viewModel.selectedTrip = stored
                    } label: {
                        tripRow(stored)
                    }
                    .buttonStyle(.plain)
                }
            }
        } else {
            MileageRouteMapView(
                routes: viewModel.trips.map(\.trip.mapRoute),
                selectedRouteId: viewModel.selectedTrip?.id,
                onSelectRoute: { tripId in
                    viewModel.selectedTrip = viewModel.trips.first(where: { $0.id == tripId })
                }
            )
            .frame(height: 360)
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
        }
    }

    private func tripRow(_ stored: StoredMileageTrip) -> some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                HStack {
                    Text(DateFormatterProvider.fullDate(stored.trip.startedAt))
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    Spacer()
                    Text(MileageFormatting.milesLabel(stored.trip.distanceMeters))
                        .fontWeight(.semibold)
                }
                Text(stored.trip.businessPurpose)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                Text(MileageFormatting.deductionLabel(stored.trip.estimatedDeductionCents))
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
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

    private var yearBinding: Binding<Int> {
        Binding(
            get: { viewModel.selectedYear },
            set: { viewModel.changeYear($0) }
        )
    }
}

struct MileageTripDetailView: View {
    @ObservedObject var viewModel: MileageViewModel
    let trip: StoredMileageTrip
    @State private var purpose: String
    @FocusState private var purposeFocused: Bool

    init(viewModel: MileageViewModel, trip: StoredMileageTrip) {
        self.viewModel = viewModel
        self.trip = trip
        _purpose = State(initialValue: trip.trip.businessPurpose)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                MileageRouteMapView(routes: [currentTrip.mapRoute])
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))

                MoatCard {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        metric("Miles", MileageFormatting.milesLabel(currentTrip.distanceMeters))
                        metric("Duration", MileageFormatting.elapsedLabel(currentTrip.trackedDurationSeconds))
                        metric("Started", timeLabel(currentTrip.startedAt))
                        metric("Ended", timeLabel(currentTrip.endedAt))
                        metric("Estimated deduction", MileageFormatting.deductionLabel(currentTrip.estimatedDeductionCents))
                    }
                }

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    Text("Business purpose")
                        .font(.headline)
                    MoatTextField(placeholder: "Client meeting", text: $purpose)
                        .focused($purposeFocused)
                    Button("Save purpose") {
                        Task { await viewModel.updatePurpose(trip, purpose: purpose) }
                    }
                    .buttonStyle(.moatPrimarySmall)
                    .disabled(purpose.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(MoatTheme.Spacing.large)
        }
        .moatPageBackground()
        .navigationTitle("Trip")
        .navigationBarTitleDisplayMode(.inline)
        .moatKeyboardDismissToolbar()
        .onChange(of: viewModel.selectedTrip) { updated in
            if let updated {
                purpose = updated.trip.businessPurpose
            }
        }
    }

    private var currentTrip: MileageTrip {
        viewModel.selectedTrip?.trip ?? trip.trip
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

    private func timeLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
