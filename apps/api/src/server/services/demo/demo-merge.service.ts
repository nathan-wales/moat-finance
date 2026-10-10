import type {
	ForecastScenario,
	Investment,
	RealEstateInvestment,
} from "../../../../generated/prisma";
import type {
	OverlayInvestment,
	OverlayProperty,
	OverlayScenario,
} from "./demo-overlay.service";

/**
 * Merges seeded demo investments with overlay investments.
 * - Overlay items override seeded items by ID.
 * - Deleted IDs are removed from the result.
 * - New overlay items (not in seeded list) are appended.
 */
export function mergeInvestments(
	seeded: Investment[],
	overlay: { items: OverlayInvestment[]; deletedIds: string[] },
): Investment[] {
	const deletedSet = new Set(overlay.deletedIds);
	const overlayMap = new Map(overlay.items.map((i) => [i.id, i]));

	const base = seeded
		.filter((i) => !deletedSet.has(i.id))
		.map((i) => overlayMap.get(i.id) ?? i);

	// Append overlay-only items (not in seeded list)
	const seededIds = new Set(seeded.map((i) => i.id));
	const newItems = overlay.items.filter((i) => !seededIds.has(i.id));

	return [...base, ...newItems];
}

/**
 * Merges seeded demo properties with overlay properties.
 */
export function mergeProperties(
	seeded: RealEstateInvestment[],
	overlay: { items: OverlayProperty[]; deletedIds: string[] },
): RealEstateInvestment[] {
	const deletedSet = new Set(overlay.deletedIds);
	const overlayMap = new Map(overlay.items.map((p) => [p.id, p]));

	const base = seeded
		.filter((p) => !deletedSet.has(p.id))
		.map((p) => overlayMap.get(p.id) ?? p);

	const seededIds = new Set(seeded.map((p) => p.id));
	const newItems = overlay.items.filter((p) => !seededIds.has(p.id));

	return [...base, ...newItems];
}

/**
 * Merges seeded demo forecast scenarios with overlay scenarios.
 * Also applies overlay activeId to determine isActive flag.
 */
export function mergeScenarios(
	seeded: ForecastScenario[],
	overlay: {
		items: OverlayScenario[];
		deletedIds: string[];
		activeId: string | null;
	},
): ForecastScenario[] {
	const deletedSet = new Set(overlay.deletedIds);
	const overlayMap = new Map(overlay.items.map((s) => [s.id, s]));

	// If overlay has an activeId, use it to override isActive on all records
	const hasActiveOverride = overlay.activeId !== null;

	const base = seeded
		.filter((s) => !deletedSet.has(s.id))
		.map((s) => {
			const overlayVersion = overlayMap.get(s.id) ?? s;
			if (hasActiveOverride) {
				return {
					...overlayVersion,
					isActive: overlayVersion.id === overlay.activeId,
				};
			}
			return overlayVersion;
		});

	const seededIds = new Set(seeded.map((s) => s.id));
	const newItems = overlay.items
		.filter((s) => !seededIds.has(s.id))
		.map((s) => ({
			...s,
			isActive: hasActiveOverride ? s.id === overlay.activeId : s.isActive,
		}));

	return [...base, ...newItems];
}

/**
 * Finds a property by ID from either the overlay or seeded list.
 * Overlay takes precedence.
 */
export function resolveProperty(
	id: string,
	seeded: RealEstateInvestment[],
	overlayItems: OverlayProperty[],
): RealEstateInvestment | undefined {
	return (
		overlayItems.find((p) => p.id === id) ?? seeded.find((p) => p.id === id)
	);
}
