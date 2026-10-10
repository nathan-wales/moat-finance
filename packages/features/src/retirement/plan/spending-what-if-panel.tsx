import {
	Button,
	SidePanel,
	SidePanelBody,
	SidePanelClose,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	createWhatIfStore,
	useWhatIfStore,
	WhatIfStoreProvider,
} from "../../what-if/what-if-store";
import { WhatIfView } from "../../what-if/what-if-view";
import { useRetirementCapture } from "../retirement-analytics";
import { toLeverInputs, useRetirementStore } from "../retirement-store";
import { useRetirementMutations } from "../use-retirement-queries";
import {
	compileSpendingMixLevers,
	enabledSpendingMixLevers,
	nextSpendingMixLevers,
	rehydrateSpendingMixAdjustments,
	spendingMixHasUnsavedEdits,
	spendingMixLeversSignature,
} from "./spending-mix-levers";

const spendingMixStore = createWhatIfStore("RetirementSpendingMix");
const MAX_SCENARIO_LEVERS = 40;

function notifyWhatIf(message: string, type?: "success" | "error") {
	if (type === "error") {
		toast.error(message);
		return;
	}
	toast.success(message);
}

function SpendingMixPanelBody({
	onOpenChange,
}: {
	onOpenChange: (open: boolean) => void;
}) {
	const capture = useRetirementCapture();
	const { updateScenario } = useRetirementMutations();
	const draftLevers = useRetirementStore((state) => state.draftLevers);
	const replaceSpendingMixLevers = useRetirementStore(
		(state) => state.replaceSpendingMixLevers,
	);
	const markSaved = useRetirementStore((state) => state.markSaved);
	const [saving, setSaving] = useState(false);
	const mixScenario = useWhatIfStore((state) => state.scenario);
	const mixLevers = useMemo(
		() => enabledSpendingMixLevers(draftLevers),
		[draftLevers],
	);
	const hasUnsavedEdits = mixScenario
		? spendingMixHasUnsavedEdits(mixScenario, draftLevers)
		: false;
	const applyLabel = saving || updateScenario.isPending ? "Saving…" : "Apply";
	const applyPending = saving || updateScenario.isPending;
	const seedKey = spendingMixLeversSignature(mixLevers);
	const getSeedAdjustments = useCallback(
		(baselineItems: Parameters<typeof rehydrateSpendingMixAdjustments>[0]) =>
			rehydrateSpendingMixAdjustments(baselineItems, mixLevers),
		[mixLevers],
	);

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) return;
		spendingMixStore.getState().clearScenario();
		onOpenChange(false);
	}

	async function handleApply() {
		const scenario = spendingMixStore.getState().scenario;
		if (!scenario) {
			toast.error("Couldn't read your spending mix. Try again.");
			return;
		}
		const { draftLevers: currentDraft, savedScenarioId } =
			useRetirementStore.getState();
		if (!spendingMixHasUnsavedEdits(scenario, currentDraft)) {
			spendingMixStore.getState().clearScenario();
			onOpenChange(false);
			return;
		}
		const nextMix = nextSpendingMixLevers({
			draft: currentDraft,
			compiled: compileSpendingMixLevers(scenario),
			baselineItems: scenario.baselineItems,
		});
		const otherCount = currentDraft.filter(
			(entry) => entry.lever.type !== "spending_category_change",
		).length;
		if (otherCount + nextMix.length > MAX_SCENARIO_LEVERS) {
			toast.error(
				"This scenario already has too many changes. Remove one and try again.",
			);
			return;
		}
		replaceSpendingMixLevers(nextMix);
		setSaving(true);
		try {
			if (savedScenarioId) {
				await updateScenario.mutateAsync({
					id: savedScenarioId,
					levers: toLeverInputs(useRetirementStore.getState().draftLevers),
				});
				markSaved(savedScenarioId);
			}
			capture("retirement_spending_mix_applied", {
				leverCount: nextMix.length,
			});
			spendingMixStore.getState().clearScenario();
			onOpenChange(false);
		} catch {
			toast.error("Couldn't save your spending mix. Try again.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<SidePanel
			confirmDiscardOnClose={hasUnsavedEdits}
			onOpenChange={handleOpenChange}
			open
		>
			<SidePanelContent size="lg">
				<SidePanelHeader>
					<SidePanelTitle>Spending mix</SidePanelTitle>
					<SidePanelDescription>
						Adjust monthly expenses for this scenario. Apply does not change
						your live budget or the What If page.
					</SidePanelDescription>
				</SidePanelHeader>
				<SidePanelBody>
					<WhatIfView
						allowBudgetNavigation={false}
						elevatedEditor
						getSeedAdjustments={getSeedAdjustments}
						onCapture={(event, properties) => capture(event, properties)}
						onNotify={notifyWhatIf}
						seedKey={seedKey}
					/>
				</SidePanelBody>
				<SidePanelFooter>
					<SidePanelClose asChild>
						<Button type="button" variant="ghost">
							Back
						</Button>
					</SidePanelClose>
					<Button
						disabled={applyPending}
						onClick={() => void handleApply()}
						type="button"
					>
						{applyLabel}
					</Button>
				</SidePanelFooter>
			</SidePanelContent>
		</SidePanel>
	);
}

export function SpendingWhatIfPanel({
	onOpenChange,
	open,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	if (!open) return null;

	return (
		<WhatIfStoreProvider store={spendingMixStore}>
			<SpendingMixPanelBody onOpenChange={onOpenChange} />
		</WhatIfStoreProvider>
	);
}
