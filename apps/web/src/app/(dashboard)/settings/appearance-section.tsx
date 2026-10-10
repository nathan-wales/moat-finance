"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

const APPEARANCE_OPTIONS = [
	{ value: "system", label: "System", icon: Monitor },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
] as const;

export function AppearanceSection() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<div className="scroll-mt-20 space-y-3" id="settings-appearance">
			<h2 className="font-semibold text-base">Appearance</h2>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Theme</CardTitle>
					<CardDescription>
						Choose how Moat Finance looks. System matches your device setting.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="inline-flex rounded-lg border bg-muted p-1">
						{APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => {
							const active = mounted && theme === value;
							return (
								<button
									aria-pressed={active}
									className={cn(
										"inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
										active
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground",
									)}
									key={value}
									onClick={() => setTheme(value)}
									type="button"
								>
									<Icon className="h-4 w-4" />
									{label}
								</button>
							);
						})}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
