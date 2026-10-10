import SwiftUI

struct SpendingView: View {
    var body: some View {
        InsightsView(initialTab: .spending)
    }
}

#Preview {
    NavigationStack {
        SpendingView()
    }
}
