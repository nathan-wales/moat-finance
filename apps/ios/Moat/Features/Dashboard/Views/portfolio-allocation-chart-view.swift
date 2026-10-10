import Charts
import SwiftUI

struct PortfolioAllocationChartView: View {
    let sections: [DashboardPortfolioAllocationSection]
    let total: Double
    let borderColor: Color
    let borderWidth: CGFloat

    @State private var selectedSectionKey: String?

    init(
        sections: [DashboardPortfolioAllocationSection],
        total: Double,
        borderColor: Color = MoatTheme.ColorToken.border,
        borderWidth: CGFloat = 1
    ) {
        self.sections = sections
        self.total = total
        self.borderColor = borderColor
        self.borderWidth = borderWidth
    }

    var body: some View {
        MoatCard(borderColor: borderColor, borderWidth: borderWidth) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack {
                    Text("Portfolio allocation")
                        .font(.headline)
                    Spacer()
                    Text(CurrencyFormatter.formatCompact(total))
                        .font(.subheadline.weight(.bold).monospacedDigit())
                }

                AllocationBreakdownBar(
                    sections: sections,
                    total: total,
                    selectedSectionKey: selectedSectionKey,
                    onSelectSection: selectSection,
                    onClearSelection: clearSelection
                )
                .zIndex(1)

                VStack(spacing: MoatTheme.Spacing.xLarge) {
                    ForEach(Array(sections.enumerated()), id: \.element.id) { index, section in
                        AllocationRow(
                            section: section,
                            total: total,
                            tint: portfolioAllocationColor(for: index),
                            isSelected: selectedSectionKey == section.key,
                            hasSelection: selectedSectionKey != nil,
                            onTap: { toggleSelection(section.key) }
                        )
                    }
                }
                .padding(.top, MoatTheme.Spacing.small)
                .clipped()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func selectSection(_ key: String) {
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedSectionKey = key
        }
    }

    private func toggleSelection(_ key: String) {
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedSectionKey = selectedSectionKey == key ? nil : key
        }
    }

    private func clearSelection() {
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedSectionKey = nil
        }
    }
}

private struct AllocationBreakdownBar: View {
    let sections: [DashboardPortfolioAllocationSection]
    let total: Double
    let selectedSectionKey: String?
    let onSelectSection: (String) -> Void
    let onClearSelection: () -> Void

    private var segments: [AllocationSegment] {
        var runningTotal = 0.0
        return sections.enumerated().map { index, section in
            let start = runningTotal
            runningTotal += max(section.value, 0)
            return AllocationSegment(
                id: section.key,
                label: section.label,
                start: start,
                end: runningTotal,
                value: section.value,
                color: portfolioAllocationColor(for: index)
            )
        }
    }

    var body: some View {
        Chart {
            ForEach(segments) { segment in
                BarMark(
                    xStart: .value("Start", segment.start),
                    xEnd: .value("End", segment.end),
                    y: .value("Allocation", "Portfolio")
                )
                .foregroundStyle(segment.color)
                .opacity(segmentOpacity(for: segment.id))
                .cornerRadius(7)
                .accessibilityLabel(segment.label)
                .accessibilityValue(CurrencyFormatter.formatCompact(segment.value))
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartXScale(domain: 0...max(total, 1))
        .chartPlotStyle { plotArea in
            plotArea
                .background(MoatTheme.ColorToken.surface)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        }
        .chartOverlay { proxy in
            GeometryReader { geometry in
                FinancialChartHoldToInspectOverlay(
                    onInspect: { location in
                        selectSegment(at: location, proxy: proxy, geometry: geometry)
                    },
                    onEnd: onClearSelection
                )
            }
        }
        .frame(height: 22)
        .accessibilityLabel("Portfolio allocation chart")
        .accessibilityHint(FinancialChartInteraction.accessibilityHint)
    }

    private func selectSegment(at location: CGPoint, proxy: ChartProxy, geometry: GeometryProxy) {
        let plotFrame = geometry[proxy.plotAreaFrame]
        let xPosition = location.x - plotFrame.origin.x
        guard xPosition >= 0,
              xPosition <= plotFrame.width,
              let selectedValue = proxy.value(atX: xPosition, as: Double.self),
              let segment = segments.first(where: { selectedValue >= $0.start && selectedValue <= $0.end }),
              selectedSectionKey != segment.id else {
            return
        }
        onSelectSection(segment.id)
        FinancialChartHaptics.selectionChanged()
    }

    private func segmentOpacity(for key: String) -> Double {
        guard let selectedSectionKey else { return 1 }
        return selectedSectionKey == key ? 1 : 0.45
    }
}

private struct AllocationSegment: Identifiable {
    let id: String
    let label: String
    let start: Double
    let end: Double
    let value: Double
    let color: Color
}

private struct AllocationRow: View {
    let section: DashboardPortfolioAllocationSection
    let total: Double
    let tint: Color
    let isSelected: Bool
    let hasSelection: Bool
    let onTap: () -> Void

    private var percent: Double {
        total > 0 ? section.value / total : 0
    }

    private var holdingsLabel: String {
        section.items.count == 1 ? "1 holding" : "\(section.items.count) holdings"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button(action: onTap) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(tint)
                            .frame(width: 10, height: 10)

                        Text(section.label)
                            .font(.subheadline.weight(.medium))

                        if !section.items.isEmpty {
                            Text(holdingsLabel)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer(minLength: 8)

                        HStack(spacing: 0) {
                            Text(String(format: "%.1f", percent * 100))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: true, vertical: false)

                            Text("%")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: true, vertical: false)
                        }

                        Text(CurrencyFormatter.formatCompact(section.value))
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                            .fixedSize(horizontal: true, vertical: false)
                    }

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(MoatTheme.ColorToken.chartMuted)
                            Capsule()
                                .fill(tint)
                                .frame(width: max(4, geo.size.width * percent))
                        }
                    }
                    .frame(height: 5)
                }
            }
            .buttonStyle(.plain)

            if isSelected, !section.items.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(section.items) { item in
                        HStack(alignment: .top, spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 0) {
                                    Text(item.name)
                                        .font(.subheadline.weight(.medium))

                                    if let lastSynced = item.lastSynced, !lastSynced.isEmpty {
                                        Text(" · ")
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                        Text(formatDateString(lastSynced))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }

                                if let subtitle = item.subtitle {
                                    Text(subtitle)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            Spacer()

                            Text(CurrencyFormatter.formatCompact(item.value))
                                .font(.subheadline.weight(.semibold).monospacedDigit())
                        }
                    }
                }
                .padding(.leading, 18)
                .padding(.top, MoatTheme.Spacing.small)
                .padding(.bottom, 2)
                .clipped()
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .clipped()
        .opacity(hasSelection && !isSelected ? 0.4 : 1)
    }
}

func portfolioAllocationColor(for index: Int) -> Color {
    let palette: [Color] = [
        Color(red: 0.98, green: 0.42, blue: 0.07),
        MoatTheme.ColorToken.chartPrimary,
        Color(red: 0.10, green: 0.72, blue: 0.52),
        Color(red: 0.96, green: 0.63, blue: 0.06),
        Color(red: 0.53, green: 0.35, blue: 0.90),
        Color(red: 0.09, green: 0.68, blue: 0.65),
    ]

    return palette[index % palette.count]
}

#Preview("Portfolio allocation chart") {
    PortfolioAllocationChartView(
        sections: [
            DashboardPortfolioAllocationSection(
                key: "retirement",
                label: "Retirement",
                value: 120_000,
                items: [
                    PortfolioAllocationItem(
                        id: "401k",
                        name: "401(k)",
                        value: 120_000,
                        subtitle: "Brokerage",
                        lastSynced: nil
                    ),
                ]
            ),
            DashboardPortfolioAllocationSection(key: "cash", label: "Cash", value: 28_000, items: []),
            DashboardPortfolioAllocationSection(key: "brokerage", label: "Brokerage", value: 64_000, items: []),
        ],
        total: 212_000
    )
    .padding()
}
