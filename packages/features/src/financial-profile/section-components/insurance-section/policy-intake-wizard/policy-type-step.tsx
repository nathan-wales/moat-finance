import {
	type InsurancePolicyType,
	insurancePolicyTypeLabels,
	isHealthFamilyInsuranceType,
} from "@moat/contracts";
import { cn } from "@moat/ui";
import {
	Activity,
	Car,
	CircleHelp,
	Eye,
	Heart,
	HeartPulse,
	Home,
	KeyRound,
	type LucideIcon,
	Sailboat,
	ShieldCheck,
	Smile,
	Umbrella,
} from "lucide-react";
import type { InsuranceStorageMode } from "../../types";
import type { PolicyTypeCard } from "./types";

const policyTypeCards: PolicyTypeCard[] = [
	{ type: "auto", description: "Vehicles, drivers, and liability" },
	{ type: "health", description: "Plan costs and care exposure" },
	{ type: "dental", description: "Dental benefits and annual maximums" },
	{ type: "vision", description: "Exams, frames, contacts, and lenses" },
	{ type: "life", description: "Death benefit, term, and riders" },
	{ type: "disability", description: "Income protection and benefits" },
	{ type: "homeowners", description: "Home structure and liability" },
	{ type: "renters", description: "Personal property and liability" },
	{ type: "longTermCare", description: "Care benefits and benefit pools" },
	{ type: "umbrella", description: "Extra liability coverage" },
	{ type: "boat", description: "Watercraft and liability" },
	{ type: "other", description: "A policy that does not fit above" },
];

const policyTypeIcons: Record<InsurancePolicyType, LucideIcon> = {
	auto: Car,
	health: HeartPulse,
	dental: Smile,
	vision: Eye,
	life: Heart,
	disability: Activity,
	homeowners: Home,
	renters: KeyRound,
	longTermCare: ShieldCheck,
	umbrella: Umbrella,
	boat: Sailboat,
	other: CircleHelp,
};

export function PolicyTypeStep({
	onSelect,
	selectedType,
	storageMode,
}: {
	onSelect: (type: InsurancePolicyType) => void;
	selectedType?: InsurancePolicyType;
	storageMode: InsuranceStorageMode;
}) {
	return (
		<div className="space-y-5">
			<div className="space-y-2 text-center">
				<h3 className="font-semibold text-xl">What type of policy is this?</h3>
				<p className="text-muted-foreground text-sm">
					Choose the category first so Moat Finance can show the right fields.
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{policyTypeCards.map((card) => {
					const Icon = policyTypeIcons[card.type];
					const isSelected = selectedType === card.type;
					const showPrivateHint =
						storageMode === "cloud" && isHealthFamilyInsuranceType(card.type);
					return (
						<button
							className={cn(
								"flex min-h-28 min-w-0 flex-col items-start gap-3 rounded-lg border-2 bg-card p-4 text-left transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								isSelected ? "border-primary bg-primary/5" : "border-border",
							)}
							key={card.type}
							onClick={() => onSelect(card.type)}
							type="button"
						>
							<div className="flex w-full items-start justify-between gap-2">
								<Icon
									className={cn(
										"size-5 shrink-0",
										isSelected ? "text-primary" : "text-muted-foreground",
									)}
								/>
								{showPrivateHint ? (
									<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900">
										Private
									</span>
								) : null}
							</div>
							<div className="min-w-0 space-y-1">
								<div className="break-words font-medium text-sm">
									{insurancePolicyTypeLabels[card.type]}
								</div>
								<div className="text-muted-foreground text-xs leading-5">
									{card.description}
								</div>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
