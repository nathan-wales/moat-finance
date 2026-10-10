import SwiftUI

struct InsightsPeriodPicker: View {
    @Binding var selectedPeriod: InsightsPeriod
    var periods: [InsightsPeriod] = InsightsPeriod.allCases

    var body: some View {
        Menu {
            Picker("Period", selection: $selectedPeriod) {
                ForEach(periods) { period in
                    Text(period.label).tag(period)
                }
            }
            .pickerStyle(.inline)
        } label: {
            HStack(spacing: MoatTheme.Spacing.small) {
                Image(systemName: "calendar")
                    .font(.subheadline.weight(.semibold))

                Text(selectedPeriod.label)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(MoatTheme.ColorToken.textPrimary)
            .padding(.horizontal, MoatTheme.Spacing.medium)
            .padding(.vertical, MoatTheme.Spacing.small)
            .moatGlass(cornerRadius: MoatTheme.Radius.pill)
        }
    }
}
