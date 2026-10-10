export const suggestedPrompts = [
	"What should I prioritize this month?",
	"Can I afford a bigger savings goal?",
	"Compare debt payoff and investing",
];

export const CONVERSATION_ID_KEY = "moat-ai-conversation-id";

export function createClientId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getActivePage(pathname: string): string {
	const page = pathname.split("/").filter(Boolean).at(-1);
	return page ?? "dashboard";
}

export function loadStoredConversationId(): string | undefined {
	if (typeof window === "undefined") return undefined;
	return window.localStorage.getItem(CONVERSATION_ID_KEY) ?? undefined;
}

export function persistConversationId(id: string | undefined) {
	if (typeof window === "undefined") return;
	if (id) window.localStorage.setItem(CONVERSATION_ID_KEY, id);
	else window.localStorage.removeItem(CONVERSATION_ID_KEY);
}

export function focusChatInput() {
	const inputEl = document.getElementById("moat-ai-input");
	inputEl?.focus();
}
