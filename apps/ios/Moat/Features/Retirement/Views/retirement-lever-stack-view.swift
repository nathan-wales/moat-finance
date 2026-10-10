import SwiftUI

struct RetirementLeverStackView: View {
    let levers: [RetirementLeverInput]
    let onRemove: (String) -> Void
    let onEdit: (RetirementLeverInput) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Exploring")
                .font(.headline)
            if levers.isEmpty {
                Text("The baseline is unchanged. Add a suggestion to start exploring.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(levers) { entry in
                    MoatCard {
                        HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.lever.displayTitle)
                                    .font(.subheadline.weight(.semibold))
                                if let age = entry.lever.ageParam {
                                    Text("Age \(Int(age))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Menu {
                                Button("Edit") { onEdit(entry) }
                                Button("Remove", role: .destructive) { onRemove(entry.id) }
                            } label: {
                                MoatMoreMenuIcon()
                            }
                        }
                    }
                }
            }
        }
    }
}
