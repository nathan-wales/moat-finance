export type PrimaryActionClick = () => void;

export type PrimaryActionEntry = {
	id: number;
	overlayScopeId: number | null;
	form: HTMLElement | null;
	enabled: boolean;
	click: PrimaryActionClick;
};

const overlayScopes: number[] = [];
const entries: PrimaryActionEntry[] = [];
const subscribers = new Set<() => void>();

let nextId = 1;
let keyListenerCount = 0;
let focusListenerCount = 0;

function emit(): void {
	for (const subscriber of subscribers) {
		subscriber();
	}
}

function isModEnter(event: KeyboardEvent): boolean {
	if (event.key !== "Enter") return false;
	if (event.repeat) return false;
	if (event.isComposing) return false;
	if (event.shiftKey || event.altKey) return false;
	return event.metaKey || event.ctrlKey;
}

function lastMatching(
	predicate: (entry: PrimaryActionEntry) => boolean,
): PrimaryActionEntry | null {
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index];
		if (!entry?.enabled || !predicate(entry)) continue;
		return entry;
	}
	return null;
}

function getActiveElement(): Element | null {
	if (typeof document === "undefined") return null;
	return document.activeElement;
}

export function getActivePrimaryAction(): PrimaryActionEntry | null {
	const topOverlayId = overlayScopes.at(-1);
	if (topOverlayId !== undefined) {
		return lastMatching((entry) => entry.overlayScopeId === topOverlayId);
	}

	const activeElement = getActiveElement();
	if (activeElement) {
		const formEntry = lastMatching(
			(entry) =>
				entry.form !== null &&
				(entry.form === activeElement || entry.form.contains(activeElement)),
		);
		if (formEntry) return formEntry;
	}

	return lastMatching(
		(entry) => entry.overlayScopeId === null && entry.form === null,
	);
}

export function getActivePrimaryActionId(): number | null {
	return getActivePrimaryAction()?.id ?? null;
}

export function subscribePrimaryAction(listener: () => void): () => void {
	subscribers.add(listener);
	return () => {
		subscribers.delete(listener);
	};
}

export function handlePrimaryActionKeyDown(event: KeyboardEvent): boolean {
	if (!isModEnter(event)) return false;
	const entry = getActivePrimaryAction();
	if (!entry) return false;
	event.preventDefault();
	entry.click();
	return true;
}

function onWindowKeyDown(event: KeyboardEvent): void {
	handlePrimaryActionKeyDown(event);
}

function onFocusChange(): void {
	emit();
}

function addWindowKeyListener(): void {
	if (typeof window === "undefined") return;
	if (keyListenerCount === 0) {
		window.addEventListener("keydown", onWindowKeyDown, true);
	}
	keyListenerCount += 1;
}

function removeWindowKeyListener(): void {
	if (typeof window === "undefined") return;
	keyListenerCount = Math.max(0, keyListenerCount - 1);
	if (keyListenerCount === 0) {
		window.removeEventListener("keydown", onWindowKeyDown, true);
	}
}

function addFocusListener(): void {
	if (typeof document === "undefined") return;
	if (focusListenerCount === 0) {
		document.addEventListener("focusin", onFocusChange, true);
		document.addEventListener("focusout", onFocusChange, true);
	}
	focusListenerCount += 1;
}

function removeFocusListener(): void {
	if (typeof document === "undefined") return;
	focusListenerCount = Math.max(0, focusListenerCount - 1);
	if (focusListenerCount === 0) {
		document.removeEventListener("focusin", onFocusChange, true);
		document.removeEventListener("focusout", onFocusChange, true);
	}
}

export function pushOverlayScope(): number {
	const id = nextId;
	nextId += 1;
	overlayScopes.push(id);
	addWindowKeyListener();
	emit();
	return id;
}

export function popOverlayScope(id: number): void {
	const index = overlayScopes.lastIndexOf(id);
	if (index === -1) return;
	overlayScopes.splice(index, 1);
	removeWindowKeyListener();
	emit();
}

export function registerPrimaryAction(options: {
	overlayScopeId: number | null;
	form: HTMLElement | null;
	enabled: boolean;
	click: PrimaryActionClick;
}): number {
	const id = nextId;
	nextId += 1;
	entries.push({
		id,
		overlayScopeId: options.overlayScopeId,
		form: options.form,
		enabled: options.enabled,
		click: options.click,
	});
	addWindowKeyListener();
	if (options.form) addFocusListener();
	emit();
	return id;
}

export function unregisterPrimaryAction(id: number): void {
	const index = entries.findIndex((item) => item.id === id);
	if (index === -1) return;
	const [removed] = entries.splice(index, 1);
	removeWindowKeyListener();
	if (removed?.form) removeFocusListener();
	emit();
}

export function resetPrimaryActionRegistry(): void {
	overlayScopes.length = 0;
	entries.length = 0;
	if (typeof window !== "undefined" && keyListenerCount > 0) {
		window.removeEventListener("keydown", onWindowKeyDown, true);
	}
	if (typeof document !== "undefined" && focusListenerCount > 0) {
		document.removeEventListener("focusin", onFocusChange, true);
		document.removeEventListener("focusout", onFocusChange, true);
	}
	keyListenerCount = 0;
	focusListenerCount = 0;
	emit();
}
