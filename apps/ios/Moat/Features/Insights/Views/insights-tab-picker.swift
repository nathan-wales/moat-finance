import SwiftUI

struct InsightsTabPicker: View {
    @Binding var selectedTab: InsightsTab

    var body: some View {
        Picker("Insights tab", selection: $selectedTab) {
            ForEach(InsightsTab.allCases) { tab in
                Text(tab.title).tag(tab)
            }
        }
        .pickerStyle(.segmented)
    }
}
