import type {
	RetirementMissingInput,
	RetirementPlanSettings,
} from "@moat/contracts";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Label,
	NumericInput,
} from "@moat/ui";
import { PiggyBank } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useMoatNavigation } from "../navigation-context";
import { useRetirementCapture } from "./retirement-analytics";
import { dataStatusCopy } from "./retirement-copy";
import { followRetirementHref } from "./url-state";
import { useRetirementMutations } from "./use-retirement-queries";

const REQUIRED_INTRO = "Must be in place before we can project.";
const ENCOURAGED_INTRO =
	"These help dial in the exact numbers so the forecast is more accurate.";

export function RetirementSetupEmptyState({
	dataStatus,
	missingInputs,
	plan,
	onOpenPlanSettings,
}: {
	dataStatus: string;
	missingInputs: RetirementMissingInput[];
	plan?: RetirementPlanSettings;
	onOpenPlanSettings?: () => void;
}) {
	const copy = dataStatusCopy(dataStatus);
	const required = missingInputs.filter(
		(input) => input.urgency === "required",
	);
	const encouraged = missingInputs.filter(
		(input) => input.urgency === "encouraged",
	);

	return (
		<div className="space-y-6">
			<div className="flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
					<PiggyBank className="size-5 text-muted-foreground" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-sm">{copy.title}</p>
					{copy.description ? (
						<p className="text-muted-foreground text-sm">{copy.description}</p>
					) : null}
				</div>
			</div>

			{required.length > 0 ? (
				<SetupSectionCard description={REQUIRED_INTRO} title="Required">
					<SetupChecklist
						inputs={required}
						onOpenPlanSettings={onOpenPlanSettings}
						plan={plan}
					/>
				</SetupSectionCard>
			) : null}

			{encouraged.length > 0 ? (
				<SetupSectionCard description={ENCOURAGED_INTRO} title="Encouraged">
					<SetupChecklist
						inputs={encouraged}
						onOpenPlanSettings={onOpenPlanSettings}
						plan={plan}
					/>
				</SetupSectionCard>
			) : null}

			{onOpenPlanSettings ? (
				<Button
					className="h-auto px-0 text-xs"
					onClick={onOpenPlanSettings}
					size="sm"
					variant="link"
				>
					More plan settings
				</Button>
			) : null}
		</div>
	);
}

function SetupSectionCard({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<Card className="gap-0">
			<CardHeader className="border-b">
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="p-0">{children}</CardContent>
		</Card>
	);
}

function SetupChecklist({
	inputs,
	plan,
	onOpenPlanSettings,
}: {
	inputs: RetirementMissingInput[];
	plan?: RetirementPlanSettings;
	onOpenPlanSettings?: () => void;
}) {
	return (
		<ul className="divide-y">
			{inputs.map((input) => (
				<li key={input.id}>
					<SetupChecklistRow
						input={input}
						onOpenPlanSettings={onOpenPlanSettings}
						plan={plan}
					/>
				</li>
			))}
		</ul>
	);
}

function SetupChecklistRow({
	input,
	plan,
	onOpenPlanSettings,
}: {
	input: RetirementMissingInput;
	plan?: RetirementPlanSettings;
	onOpenPlanSettings?: () => void;
}) {
	const nav = useMoatNavigation();

	return (
		<div className="px-6 py-4 text-left">
			<p className="font-medium text-sm">{input.label}</p>
			<p className="mt-0.5 text-muted-foreground text-sm">
				{input.description}
			</p>
			<div className="mt-3">
				{input.actionKind === "birth_year" ? (
					<InlineBirthYearField plan={plan} />
				) : null}
				{input.actionKind === "social_security" ? (
					<InlineSocialSecurityField plan={plan} />
				) : null}
				{input.actionKind === "link" ? (
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={() => followRetirementHref(nav, input.actionHref)}
							size="sm"
							variant="outline"
						>
							{input.actionLabel}
						</Button>
						{input.actionHref === "/retirement?edit=plan" &&
						onOpenPlanSettings ? (
							<Button onClick={onOpenPlanSettings} size="sm" variant="ghost">
								Open plan settings
							</Button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}

function InlineBirthYearField({ plan }: { plan?: RetirementPlanSettings }) {
	const capture = useRetirementCapture();
	const { updatePlan } = useRetirementMutations();
	const [value, setValue] = useState(
		plan?.primaryBirthYear !== null && plan?.primaryBirthYear !== undefined
			? String(plan.primaryBirthYear)
			: "",
	);
	const [error, setError] = useState<string | null>(null);

	async function handleSave() {
		const trimmed = value.trim().replace(/,/g, "");
		const parsed = Number.parseInt(trimmed, 10);
		if (
			trimmed === "" ||
			Number.isNaN(parsed) ||
			parsed < 1900 ||
			parsed > 2100
		) {
			setError("Birth year must be between 1900 and 2100.");
			return;
		}
		setError(null);
		try {
			await updatePlan.mutateAsync({ primaryBirthYear: parsed });
			capture("retirement_plan_edited", { field: "birth_year" });
		} catch {
			setError("Couldn't save your birth year. Try again.");
		}
	}

	return (
		<div className="flex max-w-xs flex-col gap-2 sm:flex-row sm:items-end">
			<div className="min-w-0 flex-1 space-y-1">
				<Label htmlFor="setup-birth-year">Birth year</Label>
				<Input
					id="setup-birth-year"
					inputMode="numeric"
					onChange={(event) => setValue(event.target.value)}
					placeholder="1985"
					value={value}
				/>
			</div>
			<Button
				disabled={updatePlan.isPending}
				onClick={() => void handleSave()}
				size="sm"
				type="button"
			>
				{updatePlan.isPending ? "Saving…" : "Save"}
			</Button>
			{error ? (
				<p className="text-destructive text-xs sm:basis-full">{error}</p>
			) : null}
		</div>
	);
}

function InlineSocialSecurityField({
	plan,
}: {
	plan?: RetirementPlanSettings;
}) {
	const capture = useRetirementCapture();
	const { updatePlan } = useRetirementMutations();
	const [value, setValue] = useState(
		plan?.socialSecurityMonthlyAtFra !== null &&
			plan?.socialSecurityMonthlyAtFra !== undefined
			? String(plan.socialSecurityMonthlyAtFra)
			: "",
	);
	const [error, setError] = useState<string | null>(null);

	async function handleSave() {
		const trimmed = value.trim().replace(/,/g, "");
		if (trimmed === "") {
			setError("Enter a monthly amount from your SSA statement.");
			return;
		}
		const parsed = Number(trimmed);
		if (Number.isNaN(parsed) || parsed < 0 || parsed > 100_000) {
			setError("Social Security estimate must be between $0 and $100,000.");
			return;
		}
		setError(null);
		try {
			await updatePlan.mutateAsync({ socialSecurityMonthlyAtFra: parsed });
			capture("retirement_plan_edited", { field: "social_security" });
		} catch {
			setError("Couldn't save your estimate. Try again.");
		}
	}

	return (
		<div className="flex max-w-sm flex-col gap-2 sm:flex-row sm:items-end">
			<div className="min-w-0 flex-1 space-y-1">
				<Label htmlFor="setup-ss-monthly">Social Security at FRA ($/mo)</Label>
				<NumericInput
					id="setup-ss-monthly"
					onChange={setValue}
					placeholder="2,400"
					value={value}
				/>
			</div>
			<Button
				disabled={updatePlan.isPending}
				onClick={() => void handleSave()}
				size="sm"
				type="button"
			>
				{updatePlan.isPending ? "Saving…" : "Save"}
			</Button>
			{error ? (
				<p className="text-destructive text-xs sm:basis-full">{error}</p>
			) : null}
		</div>
	);
}
