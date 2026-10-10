"use client";

import { useEffect, useState } from "react";

export function getScrollRoot(element: HTMLElement): HTMLElement | null {
	let parent = element.parentElement;

	while (parent) {
		const { overflowY } = getComputedStyle(parent);
		if (
			overflowY === "auto" ||
			overflowY === "scroll" ||
			overflowY === "overlay"
		) {
			return parent;
		}
		parent = parent.parentElement;
	}

	return null;
}

export function useScrollSpy(sectionIds: readonly string[]) {
	const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

	useEffect(() => {
		const elements = sectionIds
			.map((id) => document.getElementById(id))
			.filter((element): element is HTMLElement => element !== null);

		if (elements.length === 0) return;

		const firstElement = elements[0];
		if (!firstElement) return;

		const scrollRoot = getScrollRoot(firstElement);
		const visibleSections = new Set<string>();

		function setActiveFromVisible() {
			const nextActive = sectionIds.find((id) => visibleSections.has(id));
			if (nextActive) {
				setActiveId(nextActive);
			}
		}

		function handleScrollEnd() {
			if (!scrollRoot) return;

			const atBottom =
				scrollRoot.scrollTop + scrollRoot.clientHeight >=
				scrollRoot.scrollHeight - 48;

			if (atBottom) {
				const lastSection = sectionIds.at(-1);
				if (lastSection) {
					setActiveId(lastSection);
				}
			}
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						visibleSections.add(entry.target.id);
					} else {
						visibleSections.delete(entry.target.id);
					}
				}

				setActiveFromVisible();
			},
			{
				root: scrollRoot,
				rootMargin: "-15% 0px -60% 0px",
				threshold: 0,
			},
		);

		for (const element of elements) {
			observer.observe(element);
		}

		scrollRoot?.addEventListener("scroll", handleScrollEnd, { passive: true });

		return () => {
			observer.disconnect();
			scrollRoot?.removeEventListener("scroll", handleScrollEnd);
		};
	}, [sectionIds]);

	return { activeId, setActiveId };
}
