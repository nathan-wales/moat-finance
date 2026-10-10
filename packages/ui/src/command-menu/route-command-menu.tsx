"use client";

import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "../cn";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "../primitives/dialog";
import { CommandMenuFooter } from "./command-menu-footer";
import { groupRankedRoutes, rankRoutes } from "./route-command-menu-rank";

export type RouteCommandMenuItem = {
	id: string;
	label: string;
	href: string;
	icon?: LucideIcon;
	keywords?: string[];
	group?: string;
	parentLabel?: string;
};

export interface RouteCommandMenuProps {
	routes: RouteCommandMenuItem[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectRoute: (route: RouteCommandMenuItem) => void;
	onSelectRouteNewTab?: (route: RouteCommandMenuItem) => void;
	placeholder?: string;
	enableShortcut?: boolean;
}

export function RouteCommandMenu({
	routes,
	open,
	onOpenChange,
	onSelectRoute,
	onSelectRouteNewTab,
	placeholder = "Search pages...",
	enableShortcut = true,
}: RouteCommandMenuProps) {
	const listId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const activeItemRef = useRef<HTMLButtonElement>(null);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);

	const filteredRoutes = useMemo(
		() => rankRoutes(routes, query),
		[query, routes],
	);

	const groupedRoutes = useMemo(
		() => groupRankedRoutes(filteredRoutes),
		[filteredRoutes],
	);

	const selectRoute = useCallback(
		(route: RouteCommandMenuItem) => {
			onSelectRoute(route);
			onOpenChange(false);
		},
		[onOpenChange, onSelectRoute],
	);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setActiveIndex(0);
	}, [open]);

	useEffect(() => {
		if (filteredRoutes.length === 0) {
			setActiveIndex(0);
			return;
		}
		if (activeIndex >= filteredRoutes.length) {
			setActiveIndex(filteredRoutes.length - 1);
		}
	}, [activeIndex, filteredRoutes.length]);

	useEffect(() => {
		if (activeIndex < 0) return;
		activeItemRef.current?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	useEffect(() => {
		if (!enableShortcut) return;

		function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
			const isShortcut =
				(event.metaKey || event.ctrlKey) &&
				event.key.toLowerCase() === "k" &&
				!event.altKey &&
				!event.shiftKey;

			if (!isShortcut) return;

			event.preventDefault();
			onOpenChange(!open);
		}

		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [enableShortcut, onOpenChange, open]);

	function moveActiveIndex(delta: number) {
		if (filteredRoutes.length === 0) return;
		setActiveIndex((current) => {
			const next = current + delta;
			if (next < 0) return 0;
			if (next >= filteredRoutes.length) return filteredRoutes.length - 1;
			return next;
		});
	}

	function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveActiveIndex(1);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveActiveIndex(-1);
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const selected = filteredRoutes[activeIndex];
			if (!selected) return;
			const openInNewTab = event.metaKey || event.ctrlKey;
			if (openInNewTab && onSelectRouteNewTab) {
				onSelectRouteNewTab(selected);
				onOpenChange(false);
				return;
			}
			selectRoute(selected);
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			onOpenChange(false);
		}
	}

	let flatIndex = -1;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				aria-describedby={undefined}
				className="gap-0 overflow-hidden p-0 sm:max-w-lg"
				onKeyDownCapture={handleListKeyDown}
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					inputRef.current?.focus();
				}}
				showCloseButton={false}
			>
				<DialogTitle className="sr-only">Search pages</DialogTitle>
				<DialogDescription className="sr-only">
					Search and navigate to app pages
				</DialogDescription>

				<div className="flex items-center gap-3 border-b px-4">
					<Search className="size-4 shrink-0 text-muted-foreground" />
					<input
						aria-activedescendant={
							filteredRoutes[activeIndex]
								? `${listId}-option-${filteredRoutes[activeIndex]?.id}`
								: undefined
						}
						aria-autocomplete="list"
						aria-controls={listId}
						aria-expanded={open}
						className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						onChange={(event) => {
							setQuery(event.target.value);
							setActiveIndex(0);
						}}
						placeholder={placeholder}
						ref={inputRef}
						role="combobox"
						value={query}
					/>
				</div>

				<div
					className="max-h-80 overflow-y-auto py-2"
					id={listId}
					role="listbox"
				>
					{filteredRoutes.length === 0 ? (
						<p className="px-4 py-8 text-center text-muted-foreground text-sm">
							No pages found.
						</p>
					) : (
						groupedRoutes.map((group) => (
							<div key={group.group ?? "__ungrouped"}>
								{group.group ? (
									<div className="px-4 py-2 font-medium text-muted-foreground text-xs">
										{group.group}
									</div>
								) : null}
								{group.routes.map((route) => {
									flatIndex += 1;
									const index = flatIndex;
									const isActive = index === activeIndex;
									const Icon = route.icon;

									return (
										<button
											aria-selected={isActive}
											className={cn(
												"flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
												isActive
													? "bg-accent text-accent-foreground"
													: "text-foreground hover:bg-muted",
											)}
											id={`${listId}-option-${route.id}`}
											key={route.id}
											onClick={() => selectRoute(route)}
											onMouseDown={(event) => event.preventDefault()}
											onPointerMove={(event) => {
												if (event.movementX === 0 && event.movementY === 0) {
													return;
												}
												setActiveIndex(index);
											}}
											ref={isActive ? activeItemRef : undefined}
											role="option"
											tabIndex={-1}
											type="button"
										>
											{Icon ? (
												<Icon className="size-4 shrink-0 text-muted-foreground" />
											) : null}
											<span className="min-w-0 flex-1">
												<span className="block truncate">{route.label}</span>
												{route.parentLabel ? (
													<span className="block truncate text-muted-foreground text-xs">
														{route.parentLabel}
													</span>
												) : null}
											</span>
										</button>
									);
								})}
							</div>
						))
					)}
				</div>
				<CommandMenuFooter />
			</DialogContent>
		</Dialog>
	);
}
