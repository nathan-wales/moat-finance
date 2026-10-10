import SwiftUI

struct ForecastHorizonPicker: View {
    @Binding var selectedYears: Int

    var body: some View {
        Menu {
            Picker("Forecast horizon", selection: $selectedYears) {
                ForEach(ForecastHorizon.options, id: \.self) { years in
                    Text(ForecastHorizon.label(for: years)).tag(years)
                }
            }
            .pickerStyle(.inline)
        } label: {
            HStack(spacing: MoatTheme.Spacing.small) {
                Image(systemName: "calendar")
                    .font(.subheadline.weight(.semibold))

                Text(ForecastHorizon.label(for: selectedYears))
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(MoatTheme.ColorToken.textPrimary)
            .padding(.horizontal, MoatTheme.Spacing.medium)
            .padding(.vertical, MoatTheme.Spacing.small)
            .moatGlass(cornerRadius: MoatTheme.Radius.pill)
        }
        .accessibilityLabel("Forecast horizon")
    }
}
