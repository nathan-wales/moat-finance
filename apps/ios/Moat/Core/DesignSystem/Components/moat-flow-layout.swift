import SwiftUI

/// Lays subviews out left to right, wrapping onto a new row when the proposed
/// width runs out. Rows align on the first text baseline so a mix of pickers,
/// text fields and plain words reads as one sentence.
struct MoatFlowLayout: Layout {
    var horizontalSpacing: CGFloat = InlineRuleTokenMetrics.tokenSpacing
    var verticalSpacing: CGFloat = 2

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let rows = arrange(subviews: subviews, maxWidth: maxWidth)
        let widest = rows.map(\.width).max() ?? 0
        return CGSize(width: min(widest, maxWidth), height: totalHeight(of: rows))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(subviews: subviews, maxWidth: bounds.width)
        var y = bounds.minY

        for row in rows {
            var x = bounds.minX
            for item in row.items {
                subviews[item.index].place(
                    at: CGPoint(x: x, y: y + row.baseline - item.baseline),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(item.size)
                )
                x += item.size.width + horizontalSpacing
            }
            y += row.height + verticalSpacing
        }
    }

    private struct Item {
        let index: Int
        let size: CGSize
        let baseline: CGFloat
    }

    private struct Row {
        var items: [Item] = []
        var width: CGFloat = 0
        var baseline: CGFloat = 0
        var belowBaseline: CGFloat = 0

        var height: CGFloat { baseline + belowBaseline }
    }

    private func totalHeight(of rows: [Row]) -> CGFloat {
        let spacing = verticalSpacing * CGFloat(max(rows.count - 1, 0))
        return rows.reduce(0) { $0 + $1.height } + spacing
    }

    private func arrange(subviews: Subviews, maxWidth: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()

        for index in subviews.indices {
            let subview = subviews[index]
            var size = subview.sizeThatFits(.unspecified)

            // A token wider than the whole row (a long typed value) is allowed to
            // wrap inside itself rather than being clipped.
            if size.width > maxWidth {
                size = subview.sizeThatFits(ProposedViewSize(width: maxWidth, height: nil))
            }

            let baseline = subview.dimensions(in: ProposedViewSize(size))[.firstTextBaseline]
            let widthWithItem = current.items.isEmpty
                ? size.width
                : current.width + horizontalSpacing + size.width

            if !current.items.isEmpty, widthWithItem > maxWidth {
                rows.append(current)
                current = Row()
            }

            current.width = current.items.isEmpty
                ? size.width
                : current.width + horizontalSpacing + size.width
            current.baseline = max(current.baseline, baseline)
            current.belowBaseline = max(current.belowBaseline, size.height - baseline)
            current.items.append(Item(index: index, size: size, baseline: baseline))
        }

        if !current.items.isEmpty {
            rows.append(current)
        }

        return rows
    }
}
