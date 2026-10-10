import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cn,
} from "@moat/ui";
import { Monitor, Moon, Sun } from "lucide-react";
import type React from "react";
import {
	type Appearance,
	useAppearanceStore,
} from "../../lib/stores/appearance-store";

const APPEARANCE_OPTIONS: Array<{
	value: Appearance;
	label: string;
	icon: typeof Monitor;
}> = [
	{ value: "system", label: "System", icon: Monitor },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
];

export function AppearanceSettingsCard(): React.ReactElement {
	const appearance = useAppearanceStore((state) => state.appearance);
	const setAppearance = useAppearanceStore((state) => state.setAppearance);

	return (
		<Card className="scroll-mt-20" id="settings-appearance">
			<CardHeader>
				<CardTitle className="text-base">Appearance</CardTitle>
				<CardDescription>
					Choose how Moat Finance looks. System matches your device setting.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="inline-flex rounded-lg border bg-muted p-1">
					{APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => {
						const active = appearance === value;
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
								onClick={() => setAppearance(value)}
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
	);
}
