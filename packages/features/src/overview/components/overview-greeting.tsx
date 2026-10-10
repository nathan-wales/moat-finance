import { Button } from "@moat/ui";
import { BarChart, IdCard, List, type LucideIcon, Target } from "lucide-react";
import { useMoatNavigation } from "../../navigation-context";
import { overviewGreeting } from "../overview-greeting";

const shortcuts: {
	label: string;
	href: string;
	icon: LucideIcon;
}[] = [
	{
		label: "Review recent transactions",
		href: "/transactions",
		icon: List,
	},
	{
		label: "Manage your financial profile",
		href: "/financial-profile",
		icon: IdCard,
	},
	{
		label: "Review budget",
		href: "/budget",
		icon: Target,
	},
	{
		label: "View monthly insights",
		href: "/insights",
		icon: BarChart,
	},
];

export function OverviewGreeting({
	viewerName,
}: {
	viewerName?: string | null;
}) {
	const nav = useMoatNavigation();
	const greeting = overviewGreeting(viewerName, new Date());

	return (
		<div>
			<h1 className="py-6 font-bold text-2xl tracking-tight">{greeting}</h1>
			<div className="flex flex-wrap gap-2">
				{shortcuts.map((shortcut) => (
					<OverviewShortcutButton
						href={shortcut.href}
						icon={shortcut.icon}
						key={shortcut.href}
						label={shortcut.label}
						onNavigate={nav.push}
					/>
				))}
			</div>
		</div>
	);
}

function OverviewShortcutButton({
	label,
	href,
	icon: Icon,
	onNavigate,
}: {
	label: string;
	href: string;
	icon: LucideIcon;
	onNavigate: (path: string) => void;
}) {
	return (
		<Button
			className="rounded-full"
			onClick={() => onNavigate(href)}
			size="sm"
			type="button"
			variant="secondary"
		>
			<Icon />
			{label}
		</Button>
	);
}
