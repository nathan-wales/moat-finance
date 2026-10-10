"use client";

import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import { ChevronDown, List } from "lucide-react";
import { useEffect, useState } from "react";
import { useMoatNavigation } from "../navigation-context";
import {
	getTransactionsNavSelection,
	IMPORT_HREF,
	isTransactionsNavChildActive,
	RULES_HREF,
	TRANSACTIONS_HREF,
} from "./transactions-nav-paths";

const CHILD_ITEMS = [
	{ id: "rules", label: "Rules", href: RULES_HREF },
	{ id: "import", label: "Import", href: IMPORT_HREF },
] as const;

export function TransactionsNavGroup({
	pathname,
	collapsed = false,
	onNavigate,
}: {
	pathname: string;
	collapsed?: boolean;
	onNavigate?: () => void;
}) {
	const nav = useMoatNavigation();
	const selection = getTransactionsNavSelection(pathname);
	const childActive = isTransactionsNavChildActive(selection);
	const [userExpanded, setUserExpanded] = useState(childActive);
	const expanded = !collapsed && userExpanded;
	const parentActive =
		selection === "transactions" || (collapsed && childActive);

	useEffect(() => {
		if (isTransactionsNavChildActive(selection)) {
			setUserExpanded(true);
		}
	}, [selection]);

	const parentRowClassName = cn(
		"relative flex w-full items-center rounded-md",
		parentActive && "bg-primary text-primary-foreground",
	);
	const parentButtonClassName = cn(
		"flex min-w-0 items-center gap-2 py-2 text-sm transition-colors",
		collapsed ? "justify-center px-2" : "w-full pr-9 pl-2.5",
		parentActive
			? "rounded-md text-primary-foreground"
			: "rounded-md text-foreground hover:bg-muted-foreground/10",
		collapsed && parentActive && "bg-primary",
	);
	const chevronClassName = cn(
		"absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-md bg-transparent p-0",
		parentActive
			? "text-primary-foreground hover:bg-primary-foreground/10"
			: "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground",
	);
	const chevronIconClassName = cn(
		"h-4 w-4 transition-transform duration-200 ease-out",
		!expanded && "-rotate-90",
	);
	const childrenWrapClassName = cn(
		"grid transition-[grid-template-rows] duration-300 ease-out",
		expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
	);
	const expandLabel = expanded
		? "Collapse Transactions"
		: "Expand Transactions";
	const parentAriaCurrent = parentActive ? "page" : undefined;
	const parentAriaLabel = collapsed ? "Transactions" : undefined;

	function go(href: string) {
		nav.push(href);
		onNavigate?.();
	}

	const parentButton = (
		<button
			aria-current={parentAriaCurrent}
			aria-label={parentAriaLabel}
			className={parentButtonClassName}
			data-testid="nav-transactions"
			onClick={() => go(TRANSACTIONS_HREF)}
			type="button"
		>
			<List className="h-4 w-4 shrink-0" />
			{!collapsed && <span className="truncate">Transactions</span>}
		</button>
	);

	if (collapsed) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>{parentButton}</TooltipTrigger>
				<TooltipContent side="right">Transactions</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<div>
			<div className={parentRowClassName}>
				{parentButton}
				<button
					aria-expanded={expanded}
					aria-label={expandLabel}
					className={chevronClassName}
					data-testid="nav-transactions-toggle"
					onClick={() => setUserExpanded((open) => !open)}
					type="button"
				>
					<ChevronDown className={chevronIconClassName} />
				</button>
			</div>
			<div
				aria-hidden={!expanded}
				className={childrenWrapClassName}
				inert={!expanded}
			>
				<div className="min-h-0 overflow-hidden">
					<div className="mt-0.5 ml-[1.125rem] border-border border-l">
						{CHILD_ITEMS.map((item) => {
							const active = selection === item.id;
							const childAriaCurrent = active ? "page" : undefined;
							const childClassName = cn(
								"flex w-full rounded-md py-2 pr-2.5 pl-4 text-left text-sm transition-colors",
								active
									? "bg-primary text-primary-foreground"
									: "text-foreground hover:bg-muted-foreground/10",
							);

							return (
								<button
									aria-current={childAriaCurrent}
									className={childClassName}
									data-testid={`nav-${item.id}`}
									key={item.id}
									onClick={() => go(item.href)}
									type="button"
								>
									{item.label}
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
