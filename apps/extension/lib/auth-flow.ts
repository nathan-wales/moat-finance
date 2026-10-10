import { browser } from "wxt/browser";

const AUTH_FLOW_KEY = "moatRetailSyncAuthFlow";
const LEGACY_AUTH_FLOW_KEY = "finRetailSyncAuthFlow";

type AuthFlowState = {
	authTabId: number | null;
	returnTabId: number | null;
};

function isAuthFlowState(value: unknown): value is AuthFlowState {
	if (typeof value !== "object" || value === null) return false;
	if (!("authTabId" in value) || !("returnTabId" in value)) return false;
	const authTabId = value.authTabId;
	const returnTabId = value.returnTabId;
	const authTabIdValid = authTabId === null || typeof authTabId === "number";
	const returnTabIdValid =
		returnTabId === null || typeof returnTabId === "number";
	return authTabIdValid && returnTabIdValid;
}

export async function rememberExtensionAuthTabs(input: {
	authTabId: number | undefined;
	returnTabId: number | undefined;
}): Promise<void> {
	const flow: AuthFlowState = {
		authTabId: input.authTabId ?? null,
		returnTabId: input.returnTabId ?? null,
	};
	await browser.storage.local.set({ [AUTH_FLOW_KEY]: flow });
}

async function readAuthFlow(): Promise<AuthFlowState | null> {
	const result = await browser.storage.local.get([
		AUTH_FLOW_KEY,
		LEGACY_AUTH_FLOW_KEY,
	]);
	const flow = result[AUTH_FLOW_KEY] ?? result[LEGACY_AUTH_FLOW_KEY];
	if (!isAuthFlowState(flow)) return null;
	if (!result[AUTH_FLOW_KEY] && result[LEGACY_AUTH_FLOW_KEY]) {
		await browser.storage.local.set({ [AUTH_FLOW_KEY]: flow });
		await browser.storage.local.remove(LEGACY_AUTH_FLOW_KEY);
	}
	return flow;
}

export async function returnToOriginalTabAndCloseAuth(
	senderTabId: number | undefined,
): Promise<void> {
	const flow = await readAuthFlow();
	const returnTabId = flow?.returnTabId ?? null;
	const authTabId = senderTabId ?? flow?.authTabId ?? null;

	if (returnTabId !== null && returnTabId !== authTabId) {
		await browser.tabs
			.update(returnTabId, { active: true })
			.catch(() => undefined);
	}

	await browser.storage.local.remove([AUTH_FLOW_KEY, LEGACY_AUTH_FLOW_KEY]);

	if (authTabId === null) return;

	await browser.tabs.remove(authTabId).catch(() => undefined);
}
