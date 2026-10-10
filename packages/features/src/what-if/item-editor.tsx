import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	NumericInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@moat/ui";
import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MonthlyItemType } from "./calculator";
import { formatCurrency } from "./calculator";
import {
	useEditorState,
	useScenarioActions,
	useWhatIfStore,
} from "./what-if-store";

interface ItemEditorProps {
	elevated?: boolean;
	onNotify?: (message: string, type?: "success" | "error") => void;
	onCapture?: (
		event: string,
		properties?: Record<string, string | number | boolean | null>,
	) => void;
}

export function ItemEditor({
	elevated = false,
	onNotify,
	onCapture,
}: ItemEditorProps) {
	const { editingItemId, editorOpen } = useEditorState();
	const initialType = useWhatIfStore((state) => state.initialType);
	const { closeEditor, addNewItem, updateItem, removeItem, revertItem } =
		useScenarioActions();
	const editingItem = useWhatIfStore((state) =>
		editingItemId ? state.getItem(editingItemId) : undefined,
	);
	const adjustment = useWhatIfStore((state) =>
		editingItemId ? state.getAdjustment(editingItemId) : undefined,
	);

	const displayedRef = useRef({
		editingItemId,
		editingItem,
		adjustment,
	});
	if (editorOpen && (editingItemId === null || editingItem)) {
		displayedRef.current = { editingItemId, editingItem, adjustment };
	}

	const displayedItemId = displayedRef.current.editingItemId;
	const displayedItem = displayedRef.current.editingItem;
	const displayedAdjustment = displayedRef.current.adjustment;
	const isNewItem = displayedAdjustment?.isNew ?? false;
	const isEditing = displayedItemId !== null && displayedItem !== undefined;
	const isAdding = displayedItemId === null;
	const [name, setName] = useState("");
	const [type, setType] = useState<MonthlyItemType>("expense");
	const [monthlyAmount, setMonthlyAmount] = useState("");
	const [category, setCategory] = useState("");
	const [note, setNote] = useState("");
	const editorContentClass = elevated
		? "z-[70] max-h-[85vh] overflow-y-auto"
		: "max-h-[85vh] overflow-y-auto";

	useEffect(() => {
		if (!editorOpen) return;

		if (editingItem) {
			setName(editingItem.name);
			setType(editingItem.type);
			setMonthlyAmount(
				Math.round(
					adjustment?.newMonthlyAmount ?? editingItem.monthlyAmount,
				).toString(),
			);
			setCategory(editingItem.category ?? "");
			setNote("");
			return;
		}

		setName("");
		setType(initialType ?? "expense");
		setMonthlyAmount("");
		setCategory("");
		setNote("");
	}, [editorOpen, editingItem, initialType, adjustment]);

	function handleSave() {
		const trimmedName = name.trim();
		const amount = Math.round(
			Number.parseFloat(monthlyAmount.replace(/,/g, "")),
		);
		if (!trimmedName) {
			onNotify?.("Please enter a name", "error");
			return;
		}
		if (Number.isNaN(amount) || amount <= 0) {
			onNotify?.("Please enter a valid monthly amount", "error");
			return;
		}

		if (isAdding) {
			addNewItem({
				name: trimmedName,
				type,
				monthlyAmount: amount,
				category: category.trim() || undefined,
			});
			onCapture?.("what_if_item_added", { itemType: type });
			onNotify?.("Item added to scenario");
		} else if (editingItemId) {
			updateItem(editingItemId, amount);
			onCapture?.("what_if_item_updated", {
				isNew: isNewItem,
				itemType: type,
			});
			onNotify?.("Item updated");
		}
		closeEditor();
	}

	function handleRevert() {
		if (!editingItemId) return;
		revertItem(editingItemId);
		onNotify?.("Changes reverted");
		closeEditor();
	}

	function handleRemove() {
		if (!editingItemId) return;
		removeItem(editingItemId);
		onNotify?.(isNewItem ? "Item removed" : "Item removed from scenario");
		closeEditor();
	}

	const baselineAmount =
		isEditing && displayedItem?.isBaseline
			? displayedItem.monthlyAmount
			: undefined;

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) closeEditor();
			}}
			open={editorOpen}
		>
			<DialogContent
				className={editorContentClass}
				overlayClassName={elevated ? "z-[70]" : undefined}
			>
				<DialogHeader>
					<DialogTitle>
						{isAdding ? "Add Item" : isNewItem ? "Edit New Item" : "Edit Item"}
					</DialogTitle>
					<DialogDescription>
						{isAdding
							? "Add a new hypothetical monthly item to your scenario"
							: "Adjust the monthly amount for this item"}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{(isAdding || isNewItem) && (
						<div className="space-y-2">
							<Label htmlFor="type">Type</Label>
							<Select
								onValueChange={(value) => setType(value as MonthlyItemType)}
								value={type}
							>
								<SelectTrigger id="type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="income">Income</SelectItem>
									<SelectItem value="expense">Expense</SelectItem>
									<SelectItem value="savings">Savings or Investment</SelectItem>
									<SelectItem value="debt">Debt Payment</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}

					{(isAdding || isNewItem) && (
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								onChange={(event) => setName(event.target.value)}
								placeholder="Car payment"
								value={name}
							/>
						</div>
					)}

					{!isAdding && !isNewItem && baselineAmount !== undefined && (
						<div className="space-y-2">
							<Label>Current Monthly Amount</Label>
							<div className="font-semibold text-2xl">
								{formatCurrency(baselineAmount)}
							</div>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="amount">
							{isAdding || isNewItem ? "Monthly Amount" : "New Monthly Amount"}
						</Label>
						<div className="relative">
							<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
								$
							</span>
							<NumericInput
								className="pl-7"
								id="amount"
								onChange={(value) => setMonthlyAmount(value)}
								placeholder="0"
								value={monthlyAmount}
							/>
						</div>
					</div>

					{(isAdding || isNewItem) && (
						<div className="space-y-2">
							<Label htmlFor="category">Category</Label>
							<Input
								id="category"
								onChange={(event) => setCategory(event.target.value)}
								placeholder="Transportation"
								value={category}
							/>
						</div>
					)}

					{(isAdding || isNewItem) && (
						<div className="space-y-2">
							<Label htmlFor="note">Note</Label>
							<Textarea
								id="note"
								onChange={(event) => setNote(event.target.value)}
								placeholder="Add any details"
								rows={3}
								value={note}
							/>
						</div>
					)}
				</div>

				<DialogFooter className="flex-row flex-wrap sm:justify-between">
					<div className="flex flex-wrap gap-2">
						{!isAdding && !isNewItem && displayedAdjustment && (
							<Button onClick={handleRevert} variant="outline">
								<RotateCcw className="mr-2 h-4 w-4" />
								Revert to Baseline
							</Button>
						)}
						{!isAdding && (
							<Button
								className="text-red-600 hover:text-red-700"
								onClick={handleRemove}
								variant="outline"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								{isNewItem ? "Remove Item" : "Remove from Scenario"}
							</Button>
						)}
					</div>
					<div className="flex gap-2">
						<Button onClick={closeEditor} variant="outline">
							Cancel
						</Button>
						<Button onClick={handleSave}>
							{isAdding ? "Add to Scenario" : "Save Changes"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
