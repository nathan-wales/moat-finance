import {
	Button,
	ConfirmDestructiveDialog,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@moat/ui";
import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";
import { describeRetirementLever } from "../lever-catalog";
import { useRetirementCapture } from "../retirement-analytics";
import {
	leversFromScenario,
	toLeverInputs,
	useRetirementStore,
} from "../retirement-store";
import {
	useRetirementMutations,
	useRetirementScenarios,
} from "../use-retirement-queries";
import { SaveScenarioDialog } from "./save-scenario-dialog";

const BASELINE_VALUE = "baseline";
const UNSAVED_VALUE = "unsaved";

export function ScenarioBar() {
	const draftLevers = useRetirementStore((state) => state.draftLevers);
	const savedScenarioId = useRetirementStore((state) => state.savedScenarioId);
	const isDirty = useRetirementStore((state) => state.isDirty);
	const isComparing = useRetirementStore((state) => state.isComparing);
	const compareIds = useRetirementStore((state) => state.compareIds);
	const hydrateDraft = useRetirementStore((state) => state.hydrateDraft);
	const clearDraft = useRetirementStore((state) => state.clearDraft);
	const markSaved = useRetirementStore((state) => state.markSaved);
	const setTab = useRetirementStore((state) => state.setTab);
	const setComparing = useRetirementStore((state) => state.setComparing);
	const toggleCompareId = useRetirementStore((state) => state.toggleCompareId);
	const removeCompareId = useRetirementStore((state) => state.removeCompareId);
	const { data: scenarios = [] } = useRetirementScenarios();
	const mutations = useRetirementMutations();
	const capture = useRetirementCapture();
	const [saveOpen, setSaveOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const savedScenario = scenarios.find(
		(scenario) => scenario.id === savedScenarioId,
	);
	const hasLevers = draftLevers.length > 0;
	const pickerValue = savedScenarioId
		? savedScenarioId
		: hasLevers
			? UNSAVED_VALUE
			: BASELINE_VALUE;
	const pickerLabel = savedScenario?.name
		? savedScenario.name
		: hasLevers
			? "Unsaved"
			: "Baseline";
	const canSave = hasLevers && (isDirty || !savedScenarioId);
	const showCompare =
		scenarios.length > 0 && (pickerValue !== BASELINE_VALUE || isComparing);
	const savePending =
		mutations.createScenario.isPending || mutations.updateScenario.isPending;
	const saveLabel = savePending ? "Saving…" : "Save";
	const defaultName = defaultScenarioName(draftLevers);

	function selectScenario(value: string) {
		if (value === BASELINE_VALUE) {
			capture("retirement_baseline_restored", {
				hadScenario: Boolean(savedScenarioId),
				leverCount: draftLevers.length,
			});
			clearDraft();
			return;
		}
		if (value === UNSAVED_VALUE) return;
		const match = scenarios.find((scenario) => scenario.id === value);
		if (!match) return;
		hydrateDraft(leversFromScenario(match), match.id);
	}

	function persistCurrent(name: string) {
		const levers = toLeverInputs(draftLevers);
		if (savedScenarioId) {
			mutations.updateScenario.mutate(
				{ id: savedScenarioId, name, levers },
				{
					onSuccess: (scenario) => {
						markSaved(scenario.id);
						capture("retirement_scenario_saved", {
							leverCount: levers.length,
							isNew: false,
						});
						setSaveOpen(false);
					},
				},
			);
			return;
		}
		mutations.createScenario.mutate(
			{ name, levers },
			{
				onSuccess: (scenario) => {
					markSaved(scenario.id);
					capture("retirement_scenario_saved", {
						leverCount: levers.length,
						isNew: true,
					});
					setSaveOpen(false);
				},
			},
		);
	}

	function handleSave() {
		if (savedScenarioId && isDirty) {
			persistCurrent(savedScenario?.name ?? defaultName);
			return;
		}
		setSaveOpen(true);
	}

	function handleCompare() {
		if (isComparing) {
			setComparing(false);
			return;
		}
		setTab("plan");
		setComparing(true);
		if (compareIds.length === 0 && savedScenarioId) {
			toggleCompareId(savedScenarioId);
		}
	}

	function handleDuplicate() {
		if (!savedScenarioId) return;
		mutations.duplicateScenario.mutate(
			{ id: savedScenarioId },
			{
				onSuccess: (scenario) => {
					hydrateDraft(leversFromScenario(scenario), scenario.id);
				},
			},
		);
	}

	function handleDelete() {
		if (!savedScenarioId) return;
		const id = savedScenarioId;
		mutations.deleteScenario.mutate(id, {
			onSuccess: () => {
				removeCompareId(id);
				clearDraft();
				setDeleteOpen(false);
			},
		});
	}

	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="sm" variant="outline">
						<FileText />
						<span className="max-w-48 truncate">Scenario: {pickerLabel}</span>
						<ChevronDown className="size-4 opacity-50" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="center" className="w-56">
					<DropdownMenuRadioGroup
						onValueChange={selectScenario}
						value={pickerValue}
					>
						<DropdownMenuRadioItem value={BASELINE_VALUE}>
							Baseline
						</DropdownMenuRadioItem>
						{hasLevers && !savedScenarioId ? (
							<DropdownMenuRadioItem value={UNSAVED_VALUE}>
								Unsaved
							</DropdownMenuRadioItem>
						) : null}
						{scenarios.map((scenario) => (
							<DropdownMenuRadioItem key={scenario.id} value={scenario.id}>
								{scenario.name}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					{savedScenarioId ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleDuplicate}>
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setDeleteOpen(true)}
								variant="destructive"
							>
								Delete
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
			{canSave ? (
				<Button
					disabled={savePending}
					onClick={handleSave}
					size="sm"
					variant="outline"
				>
					{saveLabel}
				</Button>
			) : null}
			{showCompare ? (
				<Button
					onClick={handleCompare}
					size="sm"
					variant={isComparing ? "default" : "outline"}
				>
					Compare
				</Button>
			) : null}
			<SaveScenarioDialog
				initialName={savedScenario?.name ?? defaultName}
				isPending={savePending}
				onOpenChange={setSaveOpen}
				onSave={persistCurrent}
				open={saveOpen}
			/>
			<ConfirmDestructiveDialog
				confirmLabel="Delete"
				description="This removes the saved scenario. The live baseline is unchanged."
				isPending={mutations.deleteScenario.isPending}
				onConfirm={handleDelete}
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
				pendingLabel="Deleting…"
				title={
					savedScenario?.name
						? `Delete the scenario "${savedScenario.name}"?`
						: "Delete this scenario?"
				}
			/>
		</div>
	);
}

function defaultScenarioName(
	draftLevers: { lever: Parameters<typeof describeRetirementLever>[0] }[],
): string {
	const first = draftLevers[0];
	if (!first) return "Untitled scenario";
	return describeRetirementLever(first.lever).slice(0, 80);
}
