import SwiftUI

struct FinancialProfileSectionActionLabel: View {
    let title: String
    var systemImage: String = "plus"

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(MoatTheme.ColorToken.textPrimary)
            .labelStyle(.titleAndIcon)
            .padding(.vertical, MoatTheme.Spacing.xSmall)
            .padding(.leading, MoatTheme.Spacing.xSmall)
            .contentShape(Rectangle())
    }
}

struct FinancialProfileSectionActionButton: View {
    let title: String
    var systemImage: String = "plus"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            FinancialProfileSectionActionLabel(title: title, systemImage: systemImage)
        }
        .buttonStyle(FinancialProfileSectionActionButtonStyle())
    }
}

struct FinancialProfileSectionActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.55 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct FinancialProfileSectionCard<Action: View, Content: View>: View {
    let icon: String
    let title: String
    let description: String
    let isLoading: Bool
    @ViewBuilder let action: () -> Action
    @ViewBuilder let content: () -> Content

    var body: some View {
        financialProfileSectionCardContainer {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
                    Image(systemName: icon)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.accent)
                        .frame(width: 36, height: 36)
                        .background(MoatTheme.ColorToken.accent.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))

                    Text(title)
                        .font(.headline)
                        .lineLimit(1)
                        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

                    action()
                }

                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

                content()
                    .redacted(reason: isLoading ? .placeholder : [])
            }
        }
    }
}

struct FinancialProfileDetailRow: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
    }
}

struct FinancialProfileAssetTypeLabel: View {
    let type: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: assetTypeSystemImage(for: type))
            Text(type)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }
}

struct FinancialProfileStatusBadge: View {
    let active: Bool
    var activeLabel: String = "Included"
    var inactiveLabel: String = "Excluded"

    var body: some View {
        Text(active ? activeLabel : inactiveLabel)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(active ? MoatTheme.ColorToken.positive : .secondary)
            .padding(.horizontal, MoatTheme.Spacing.small)
            .padding(.vertical, MoatTheme.Spacing.xSmall)
            .background(
                (active ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.mutedSurface)
                    .opacity(active ? 0.12 : 1)
            )
            .clipShape(Capsule())
    }
}

struct FinancialProfileSourceBadge: View {
    let source: String

    var body: some View {
        Text(source)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(source == "Synced" ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.warning)
            .padding(.horizontal, MoatTheme.Spacing.small)
            .padding(.vertical, MoatTheme.Spacing.xSmall)
            .background(
                (source == "Synced" ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.warning)
                    .opacity(0.12)
            )
            .clipShape(Capsule())
    }
}

struct FinancialProfileEmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.large)
    }
}

func financialProfileSectionCardContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    content()
        .padding(MoatTheme.Spacing.large)
        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous)
                .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
        }
        .shadow(color: MoatTheme.Shadow.soft, radius: 1, x: 0, y: 1)
        .shadow(color: MoatTheme.Shadow.card, radius: 16, x: 0, y: 8)
}

func financialProfileDetailGrid<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    LazyVGrid(
        columns: [
            GridItem(.flexible(minimum: 0), spacing: MoatTheme.Spacing.medium),
            GridItem(.flexible(minimum: 0), spacing: MoatTheme.Spacing.medium),
        ],
        spacing: MoatTheme.Spacing.medium
    ) {
        content()
    }
    .padding(MoatTheme.Spacing.medium)
    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
    .background(MoatTheme.ColorToken.surface)
    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    .overlay {
        RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
            .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
    }
}

func financialProfileItemCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    content()
        .padding(MoatTheme.Spacing.medium)
        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
        }
        .shadow(color: MoatTheme.Shadow.soft, radius: 1, x: 0, y: 1)
        .shadow(color: MoatTheme.Shadow.card, radius: 16, x: 0, y: 8)
}

struct FinancialProfileClickableItemCard<Content: View>: View {
    let onTap: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button(action: onTap) {
            content()
                .padding(MoatTheme.Spacing.medium)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
        }
    }
}

struct FinancialProfileSheetDeleteSection: View {
    let action: () -> Void

    var body: some View {
        Section {
            Button(role: .destructive, action: action) {
                Text("Delete")
                    .frame(maxWidth: .infinity)
            }
        }
    }
}
