export const FIND_MATCH_HIGHLIGHT = "find-match";
export const FIND_ACTIVE_HIGHLIGHT = "find-active";
export const FIND_IN_PAGE_ROOT_ATTR = "data-find-in-page";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

function highlightRegistry(): HighlightRegistry | null {
	if (typeof CSS === "undefined" || !("highlights" in CSS)) {
		return null;
	}
	return CSS.highlights;
}

function isHidden(element: Element): boolean {
	const style = getComputedStyle(element);
	if (style.display === "none" || style.visibility === "hidden") {
		return true;
	}
	if (element.getAttribute("aria-hidden") === "true") {
		return true;
	}
	return false;
}

function acceptTextNode(node: Node): number {
	const parent = node.parentElement;
	if (!parent) {
		return NodeFilter.FILTER_REJECT;
	}
	if (parent.closest(`[${FIND_IN_PAGE_ROOT_ATTR}]`)) {
		return NodeFilter.FILTER_REJECT;
	}
	if (SKIP_TAGS.has(parent.tagName)) {
		return NodeFilter.FILTER_REJECT;
	}

	let ancestor: Element | null = parent;
	while (ancestor) {
		if (isHidden(ancestor)) {
			return NodeFilter.FILTER_REJECT;
		}
		ancestor = ancestor.parentElement;
	}

	if (!node.textContent) {
		return NodeFilter.FILTER_REJECT;
	}
	return NodeFilter.FILTER_ACCEPT;
}

export function collectMatchRanges(
	query: string,
	root: Node = document.body,
): Range[] {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return [];
	}

	const ranges: Range[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: acceptTextNode,
	});

	let current = walker.nextNode();
	while (current) {
		const text = current.textContent ?? "";
		const haystack = text.toLowerCase();
		let from = 0;
		while (from <= haystack.length - needle.length) {
			const index = haystack.indexOf(needle, from);
			if (index === -1) {
				break;
			}
			const range = document.createRange();
			range.setStart(current, index);
			range.setEnd(current, index + needle.length);
			ranges.push(range);
			from = index + needle.length;
		}
		current = walker.nextNode();
	}

	return ranges;
}

function scrollRangeIntoView(range: Range): void {
	const node = range.startContainer;
	const element = node instanceof Element ? node : node.parentElement;
	element?.scrollIntoView({ block: "center", inline: "nearest" });
}

export function applyFindHighlights(
	ranges: Range[],
	activeIndex: number,
): void {
	clearFindHighlights();
	const registry = highlightRegistry();
	if (!registry || ranges.length === 0) {
		return;
	}

	const matchHighlight = new Highlight();
	for (const range of ranges) {
		matchHighlight.add(range);
	}
	matchHighlight.priority = 0;
	registry.set(FIND_MATCH_HIGHLIGHT, matchHighlight);

	const active = ranges.at(activeIndex);
	if (!active) {
		return;
	}

	const activeHighlight = new Highlight(active);
	activeHighlight.priority = 1;
	registry.set(FIND_ACTIVE_HIGHLIGHT, activeHighlight);
	scrollRangeIntoView(active);
}

export function clearFindHighlights(): void {
	highlightRegistry()?.delete(FIND_MATCH_HIGHLIGHT);
	highlightRegistry()?.delete(FIND_ACTIVE_HIGHLIGHT);
}

export function getPageSelection(): string | null {
	const selection = window.getSelection();
	if (!selection || selection.isCollapsed) {
		return null;
	}
	const text = selection.toString().trim();
	if (!text) {
		return null;
	}
	const anchor = selection.anchorNode;
	const element = anchor instanceof Element ? anchor : anchor?.parentElement;
	if (element?.closest(`[${FIND_IN_PAGE_ROOT_ATTR}]`)) {
		return null;
	}
	return text;
}
