import SwiftUI

struct TransactionEditGroupedCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            content
        }
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
        }
    }
}

struct TransactionEditDetailRow<Value: View>: View {
    let systemImage: String
    let label: String
    var interactive = false
    var disabled = false
    var mutedLabel = true
    var action: (() -> Void)? = nil
    @ViewBuilder var value: () -> Value

    var body: some View {
        let row = HStack(spacing: MoatTheme.Spacing.medium) {
            labelContent
            Spacer(minLength: MoatTheme.Spacing.small)
            HStack(spacing: 6) {
                value()
                if interactive {
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.textTertiary)
                }
            }
            .layoutPriority(1)
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
        .contentShape(Rectangle())
        .opacity(disabled ? 0.45 : 1)

        if let action, interactive, !disabled {
            Button(action: action) {
                row
            }
            .buttonStyle(.plain)
        } else {
            row
        }
    }

    private var labelContent: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.body)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(width: 20, alignment: .center)
            Text(label)
                .font(.subheadline)
                .foregroundStyle(
                    mutedLabel
                        ? MoatTheme.ColorToken.textSecondary
                        : MoatTheme.ColorToken.textPrimary
                )
        }
    }
}

struct TransactionEditActionRow: View {
    let systemImage: String
    let label: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        TransactionEditDetailRow(
            systemImage: systemImage,
            label: label,
            interactive: true,
            disabled: disabled,
            mutedLabel: false,
            action: action
        ) {
            EmptyView()
        }
    }
}

struct TransactionEditHashtagValue: View {
    let names: [String]

    private static let maxVisible = 3

    var body: some View {
        if names.isEmpty {
            Text("Add tags")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        } else {
            HStack(spacing: 4) {
                ForEach(visibleNames, id: \.self) { name in
                    Text("#\(name)")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(MoatTheme.ColorToken.mutedSurface)
                        .clipShape(Capsule())
                        .lineLimit(1)
                }
                if overflowCount > 0 {
                    Text("+\(overflowCount)")
                        .font(.caption)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                }
            }
            .lineLimit(1)
        }
    }

    private var visibleNames: [String] {
        Array(names.prefix(Self.maxVisible))
    }

    private var overflowCount: Int {
        max(names.count - visibleNames.count, 0)
    }
}

struct TransactionEditCategoryValue: View {
    let categoryName: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: CategoryItem.systemImage(forName: categoryName))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            Text(categoryName)
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .lineLimit(1)
        }
    }
}

struct TransactionEditMetadataBadge: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(MoatTheme.ColorToken.elevatedSurface)
            .clipShape(Capsule())
    }
}
