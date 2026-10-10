"use client";

import type { ThemeSource } from "@moat/contracts";
import { cn } from "@moat/ui";
import { Check, ChevronRight, SunMoon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { APPEARANCE_OPTIONS, getAppearanceLabel } from "./appearance-options";

interface ProfileAppearanceMenuItemProps {
	value: ThemeSource;
	onChange: (value: ThemeSource) => void;
	submenuSide?: "left" | "right";
}

export function ProfileAppearanceMenuItem({
	value,
	onChange,
	submenuSide = "right",
}: ProfileAppearanceMenuItemProps): React.ReactElement {
	const [submenuOpen, setSubmenuOpen] = useState(false);
	const currentLabel = getAppearanceLabel(value);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover bridge keeps submenu open while moving pointer
		<div
			className="relative"
			onMouseEnter={() => setSubmenuOpen(true)}
			onMouseLeave={() => setSubmenuOpen(false)}
		>
			<button
				aria-expanded={submenuOpen}
				aria-haspopup="menu"
				className={cn(
					"flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted",
					submenuOpen && "bg-muted",
				)}
				onClick={() => setSubmenuOpen((open) => !open)}
				type="button"
			>
				<SunMoon className="h-4 w-4 shrink-0" />
				<span>Appearance</span>
				<span className="ml-auto text-muted-foreground text-xs">
					{currentLabel}
				</span>
				<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
			</button>
			{submenuOpen ? (
				<>
					<div
						aria-hidden
						className={cn(
							"absolute top-0 h-full w-2",
							submenuSide === "right" ? "left-full" : "right-full",
						)}
					/>
					<div
						className={cn(
							"absolute top-0 z-50 w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg",
							submenuSide === "right" ? "left-full ml-1" : "right-full mr-1",
						)}
						role="menu"
					>
						{APPEARANCE_OPTIONS.map(
							({ value: optionValue, label, icon: Icon }) => {
								const active = value === optionValue;
								return (
									<button
										className={cn(
											"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
											active && "bg-muted",
										)}
										key={optionValue}
										onClick={() => onChange(optionValue)}
										role="menuitem"
										type="button"
									>
										<Icon className="h-4 w-4 shrink-0" />
										{label}
										{active ? (
											<Check className="ml-auto h-4 w-4 shrink-0" />
										) : null}
									</button>
								);
							},
						)}
					</div>
				</>
			) : null}
		</div>
	);
}
