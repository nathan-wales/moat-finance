import SwiftUI

struct MileageView: View {
    @StateObject private var viewModel = MileageViewModel()
    @ObservedObject private var tracker = MileageTracker.shared

    var body: some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            Picker("Mileage tab", selection: $viewModel.selectedTab) {
                ForEach(MileageTab.allCases) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)

            tabContent
        }
        .moatPageBackground()
        .navigationTitle("Mileage")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.loadHistory() }
        .alert("Mileage", isPresented: actionErrorBinding) {
            Button("OK", role: .cancel) { viewModel.actionError = nil }
        } message: {
            Text(viewModel.actionError ?? "Something went wrong.")
        }
        .sheet(isPresented: completingBinding) {
            MileageCompletionSheet(viewModel: viewModel, tracker: tracker)
        }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch viewModel.selectedTab {
        case .track:
            MileageTrackTab(viewModel: viewModel, tracker: tracker)
        case .history:
            MileageHistoryTab(viewModel: viewModel)
        }
    }

    private var completingBinding: Binding<Bool> {
        Binding(
            get: { tracker.phase == .completing },
            set: { isPresented in
                if isPresented == false, tracker.phase == .completing {
                    viewModel.discardCompletedTrip()
                }
            }
        )
    }

    private var actionErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.actionError != nil },
            set: { if $0 == false { viewModel.actionError = nil } }
        )
    }
}
