"use client";

import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../cn";
import { getScrollRoot, useScrollSpy } from "./use-scroll-spy";

export type SectionTableOfContentsItem = {
	id: string;
	label: string;
};

function scrollToSection(sectionId: string) {
	document.getElementById(sectionId)?.scrollIntoView({
		behavior: "smooth",
		block: "start",
	});
}

export function SectionTableOfContents({
	items,
	className,
	stickyTopClassName = "top-8",
}: {
	items: SectionTableOfContentsItem[];
	className?: string;
	stickyTopClassName?: string;
}) {
	const sectionIds = items.map((item) => item.id);
	const { activeId, setActiveId } = useScrollSpy(sectionIds);
	const navRef = useRef<HTMLElement>(null);
	const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
	const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 });

	useLayoutEffect(() => {
		const navElement = navRef.current;
		const activeElement = itemRefs.current.get(activeId);

		if (!navElement || !activeElement) return;

		function updateIndicator() {
			const nav = navRef.current;
			const activeItem = itemRefs.current.get(activeId);
			if (!nav || !activeItem) return;

			const navRect = nav.getBoundingClientRect();
			const itemRect = activeItem.getBoundingClientRect();

			setIndicatorStyle({
				top: itemRect.top - navRect.top,
				height: itemRect.height,
			});
		}

		updateIndicator();

		const firstSection = document.getElementById(items[0]?.id ?? "");
		const scrollRoot = firstSection ? getScrollRoot(firstSection) : null;
		scrollRoot?.addEventListener("scroll", updateIndicator, { passive: true });
		window.addEventListener("resize", updateIndicator);

		return () => {
			scrollRoot?.removeEventListener("scroll", updateIndicator);
			window.removeEventListener("resize", updateIndicator);
		};
	}, [activeId, items]);

	function handleSectionClick(
		event: React.MouseEvent<HTMLAnchorElement>,
		sectionId: string,
	) {
		event.preventDefault();
		setActiveId(sectionId);
		scrollToSection(sectionId);
	}

	if (items.length === 0) return null;

	return (
		<nav
			className={cn(
				"hidden min-w-0 shrink-0 lg:block lg:w-44 xl:w-48",
				`lg:sticky ${stickyTopClassName}`,
				className,
			)}
			ref={navRef}
		>
			<div className="relative pl-4">
				<div
					aria-hidden
					className="absolute top-0 bottom-0 left-0 w-px bg-border"
				/>
				<div
					aria-hidden
					className="absolute left-0 w-0.5 rounded-full bg-foreground transition-[top,height] duration-200 ease-out"
					style={{
						top: indicatorStyle.top,
						height: indicatorStyle.height,
					}}
				/>
				<ul className="space-y-0.5">
					{items.map((item) => {
						const isActive = item.id === activeId;

						return (
							<li key={item.id}>
								<a
									className={cn(
										"block py-1.5 text-sm leading-snug transition-colors",
										isActive
											? "font-medium text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
									href={`#${item.id}`}
									onClick={(event) => handleSectionClick(event, item.id)}
									ref={(element) => {
										if (element) {
											itemRefs.current.set(item.id, element);
											return;
										}
										itemRefs.current.delete(item.id);
									}}
								>
									{item.label}
								</a>
							</li>
						);
					})}
				</ul>
			</div>
		</nav>
	);
}
