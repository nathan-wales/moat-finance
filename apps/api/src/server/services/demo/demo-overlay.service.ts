import type {
	ForecastScenario,
	Investment,
	RealEstateInvestment,
} from "../../../../generated/prisma";
import { Prisma } from "../../../../generated/prisma";
import { db } from "../../db";
import { findDemoSession } from "./demo-session.service";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OverlayInvestment = Investment & { _isOverlay?: true };
export type OverlayProperty = RealEstateInvestment & { _isOverlay?: true };
export type OverlayScenario = ForecastScenario & { _isOverlay?: true };

interface InvestmentsOverlay {
	items: OverlayInvestment[];
	deletedIds: string[];
}

interface PropertiesOverlay {
	items: OverlayProperty[];
	deletedIds: string[];
}

interface ScenariosOverlay {
	items: OverlayScenario[];
	deletedIds: string[];
	activeId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSession(sessionKey: string) {
	const session = await findDemoSession(sessionKey);
	if (!session) throw new Error("Demo session not found or expired");
	return session;
}

// ── Investments overlay ───────────────────────────────────────────────────────

export async function getInvestmentsOverlay(
	sessionKey: string,
): Promise<InvestmentsOverlay> {
	const session = await getSession(sessionKey);
	const raw = session.investmentsJson as InvestmentsOverlay | null;
	return raw ?? { items: [], deletedIds: [] };
}

export async function upsertOverlayInvestment(
	sessionKey: string,
	investment: OverlayInvestment,
) {
	const overlay = await getInvestmentsOverlay(sessionKey);
	const idx = overlay.items.findIndex((i) => i.id === investment.id);
	if (idx >= 0) {
		overlay.items[idx] = investment;
	} else {
		overlay.items.push({ ...investment, _isOverlay: true });
	}
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { investmentsJson: overlay as object },
	});
	return investment;
}

export async function deleteOverlayInvestment(sessionKey: string, id: string) {
	const overlay = await getInvestmentsOverlay(sessionKey);
	overlay.items = overlay.items.filter((i) => i.id !== id);
	if (!overlay.deletedIds.includes(id)) overlay.deletedIds.push(id);
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { investmentsJson: overlay as object },
	});
}

// ── Properties overlay ────────────────────────────────────────────────────────

export async function getPropertiesOverlay(
	sessionKey: string,
): Promise<PropertiesOverlay> {
	const session = await getSession(sessionKey);
	const raw = session.propertiesJson as PropertiesOverlay | null;
	return raw ?? { items: [], deletedIds: [] };
}

export async function upsertOverlayProperty(
	sessionKey: string,
	property: OverlayProperty,
) {
	const overlay = await getPropertiesOverlay(sessionKey);
	const idx = overlay.items.findIndex((p) => p.id === property.id);
	if (idx >= 0) {
		overlay.items[idx] = property;
	} else {
		overlay.items.push({ ...property, _isOverlay: true });
	}
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { propertiesJson: overlay as object },
	});
	return property;
}

export async function deleteOverlayProperty(sessionKey: string, id: string) {
	const overlay = await getPropertiesOverlay(sessionKey);
	overlay.items = overlay.items.filter((p) => p.id !== id);
	if (!overlay.deletedIds.includes(id)) overlay.deletedIds.push(id);
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { propertiesJson: overlay as object },
	});
}

// ── Scenarios overlay ─────────────────────────────────────────────────────────

export async function getScenariosOverlay(
	sessionKey: string,
): Promise<ScenariosOverlay> {
	const session = await getSession(sessionKey);
	const raw = session.scenariosJson as ScenariosOverlay | null;
	return raw ?? { items: [], deletedIds: [], activeId: null };
}

export async function upsertOverlayScenario(
	sessionKey: string,
	scenario: OverlayScenario,
) {
	const overlay = await getScenariosOverlay(sessionKey);
	const idx = overlay.items.findIndex((s) => s.id === scenario.id);
	if (idx >= 0) {
		overlay.items[idx] = scenario;
	} else {
		overlay.items.push({ ...scenario, _isOverlay: true });
	}
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { scenariosJson: overlay as object },
	});
	return scenario;
}

export async function deleteOverlayScenario(sessionKey: string, id: string) {
	const overlay = await getScenariosOverlay(sessionKey);
	overlay.items = overlay.items.filter((s) => s.id !== id);
	if (!overlay.deletedIds.includes(id)) overlay.deletedIds.push(id);
	if (overlay.activeId === id) overlay.activeId = null;
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { scenariosJson: overlay as object },
	});
}

export async function setActiveOverlayScenario(
	sessionKey: string,
	id: string | null,
) {
	const overlay = await getScenariosOverlay(sessionKey);
	overlay.activeId = id;
	// Mark the active state in items too
	overlay.items = overlay.items.map((s) => ({ ...s, isActive: s.id === id }));
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { scenariosJson: overlay as object },
	});
}

// ── Reset overlay ─────────────────────────────────────────────────────────────

export async function resetDemoOverlay(sessionKey: string) {
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: {
			investmentsJson: Prisma.DbNull,
			propertiesJson: Prisma.DbNull,
			scenariosJson: Prisma.DbNull,
			uiStateJson: Prisma.DbNull,
		},
	});
}

// ── UI state ──────────────────────────────────────────────────────────────────

interface UiState {
	noticeDismissed?: boolean;
	financialProfile?: unknown;
}

export async function getUiState(sessionKey: string): Promise<UiState> {
	const session = await findDemoSession(sessionKey);
	if (!session) return {};
	return (session.uiStateJson as UiState | null) ?? {};
}

export async function updateUiState(
	sessionKey: string,
	patch: Partial<UiState>,
) {
	const current = await getUiState(sessionKey);
	await db.demoOverlaySession.update({
		where: { sessionKey },
		data: { uiStateJson: { ...current, ...patch } as object },
	});
}

export async function getFinancialProfileOverlay(
	sessionKey: string,
): Promise<unknown | null> {
	const current = await getUiState(sessionKey);
	return current.financialProfile ?? null;
}

export async function updateFinancialProfileOverlay(
	sessionKey: string,
	financialProfile: unknown,
) {
	await updateUiState(sessionKey, { financialProfile });
	return financialProfile;
}

export async function hasUnsavedChanges(sessionKey: string): Promise<boolean> {
	const session = await findDemoSession(sessionKey);
	if (!session) return false;
	const inv = session.investmentsJson as InvestmentsOverlay | null;
	const props = session.propertiesJson as PropertiesOverlay | null;
	const scen = session.scenariosJson as ScenariosOverlay | null;
	const ui = session.uiStateJson as UiState | null;
	return (
		(inv?.items?.length ?? 0) > 0 ||
		(inv?.deletedIds?.length ?? 0) > 0 ||
		(props?.items?.length ?? 0) > 0 ||
		(props?.deletedIds?.length ?? 0) > 0 ||
		(scen?.items?.length ?? 0) > 0 ||
		(scen?.deletedIds?.length ?? 0) > 0 ||
		ui?.financialProfile !== undefined
	);
}
