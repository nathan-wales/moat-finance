import SwiftUI

struct CategorySectionCard: View {
    let title: String
    let description: String
    let categories: [CategoryItem]
    var emptyMessage = "No categories yet."
    let onEdit: (CategoryItem) -> Void
    let onDelete: (CategoryItem) -> Void
    let onToggleHidden: (CategoryItem) -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if categories.isEmpty {
                    Text(emptyMessage)
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, MoatTheme.Spacing.medium)
                } else {
                    VStack(spacing: 0) {
                        ForEach(categories) { category in
                            CategorySectionRow(
                                category: category,
                                onEdit: { onEdit(category) },
                                onDelete: { onDelete(category) },
                                onToggleHidden: { onToggleHidden(category) }
                            )
                            if category.id != categories.last?.id {
                                Divider()
                            }
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                            .strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
                    }
                }
            }
        }
    }
}

private struct CategorySectionRow: View {
    let category: CategoryItem
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onToggleHidden: () -> Void

    private var isVisible: Binding<Bool> {
        Binding(
            get: { !category.isHidden },
            set: { _ in onToggleHidden() }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(spacing: MoatTheme.Spacing.small) {
                Image(systemName: category.systemImage)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .frame(width: 22, alignment: .center)

                Text(category.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    .lineLimit(1)

                if let parentTitle = category.parentCategory?.title {
                    CategoryBadge(text: parentTitle)
                }
                if category.isHidden {
                    CategoryBadge(text: "Hidden", systemImage: "eye.slash", style: .outline)
                }

                Spacer(minLength: 0)
            }

            HStack(spacing: MoatTheme.Spacing.small) {
                if category.canHide {
                    HStack(spacing: MoatTheme.Spacing.small) {
                        Text("Visible")
                            .font(.subheadline)
                            .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                        Toggle("Visible", isOn: isVisible)
                            .labelsHidden()
                            .moatToggleStyle()
                    }
                    .padding(.horizontal, MoatTheme.Spacing.medium)
                    .padding(.vertical, MoatTheme.Spacing.small)
                    .overlay {
                        RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                            .strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
                    }
                }

                CategoryRowIconButton(
                    systemImage: "pencil",
                    accessibilityLabel: "Edit \(category.name)",
                    action: onEdit
                )
                if category.canDelete {
                    CategoryRowIconButton(
                        systemImage: "trash",
                        accessibilityLabel: "Delete \(category.name)",
                        action: onDelete
                    )
                }

                Spacer(minLength: 0)
            }
        }
        .opacity(category.isHidden ? 0.6 : 1)
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, MoatTheme.Spacing.medium)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct CategoryRowIconButton: View {
    let systemImage: String
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .frame(width: 40, height: 40)
                .overlay {
                    RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                        .strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}

private struct CategoryBadge: View {
    enum Style {
        case filled
        case outline
    }

    let text: String
    var systemImage: String?
    var style: Style = .filled

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.xSmall) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.caption2)
            }
            Text(text)
                .font(.caption.weight(.medium))
        }
        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        .padding(.horizontal, MoatTheme.Spacing.small)
        .padding(.vertical, 3)
        .background(style == .filled ? MoatTheme.ColorToken.elevatedSurface : Color.clear, in: Capsule())
        .overlay {
            if style == .outline {
                Capsule().strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
            }
        }
    }
}
