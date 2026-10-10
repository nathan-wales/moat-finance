import SwiftUI

struct BudgetView: View {
    @StateObject private var viewModel = BudgetViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading budget...")
            case .loaded, .refreshing:
                if let pageData = viewModel.pageData {
                    loadedContent(pageData)
                }
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Budget")
        .sheet(item: editingBinding) { category in
            BudgetEditSheet(viewModel: viewModel, category: category)
        }
        .task {
            await viewModel.load()
        }
    }

    private var editingBinding: Binding<BudgetEditingCategory?> {
        Binding(
            get: { viewModel.editingCategory },
            set: { newValue in
                if newValue == nil {
                    viewModel.clearEditing()
                } else {
                    viewModel.editingCategory = newValue
                }
            }
        )
    }

    private func loadedContent(_ pageData: BudgetPageData) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Text("Set monthly targets and track whether you are overspending.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                BudgetOverviewCard(pageData: pageData)

                CategoryBudgetsCard(
                    categories: pageData.categories,
                    reportingPeriod: pageData.reportingPeriod,
                    onEdit: { category in
                        viewModel.beginEditing(category)
                    }
                )
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }
}

#Preview {
    NavigationStack {
        BudgetView()
    }
}
