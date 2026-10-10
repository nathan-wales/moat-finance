"use client";

import Link from "next/link";
import { cn } from "~/lib/utils";

export function SettingsTabNav({ activeTab }: { activeTab: string }) {
	const tabs = [
		{ id: "account", label: "Account", href: "/settings" },
		{ id: "mcp", label: "MCP", href: "/settings?tab=mcp" },
	];

	return (
		<div className="border-b">
			<nav className="-mb-px flex gap-6">
				{tabs.map((tab) => (
					<Link
						className={cn(
							"border-b-2 pb-3 font-medium text-sm transition-colors",
							activeTab === tab.id
								? "border-foreground text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
						href={tab.href}
						key={tab.id}
					>
						{tab.label}
					</Link>
				))}
			</nav>
		</div>
	);
}
