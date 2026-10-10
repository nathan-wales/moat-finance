import type { MoatTransaction, UpdateTransactionInput } from "@moat/contracts";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import { useEffect, useRef, useState } from "react";

interface EditTransactionDialogProps {
	transaction: MoatTransaction | null;
	categories: string[];
	allHashtags: string[];
	onClose: () => void;
	onSave: (input: UpdateTransactionInput) => void;
	isSaving?: boolean;
}

export function EditTransactionDialog({
	transaction,
	categories,
	allHashtags,
	onClose,
	onSave,
	isSaving,
}: EditTransactionDialogProps): React.ReactElement | null {
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
	const [category, setCategory] = useState("");
	const [hashtags, setHashtags] = useState("");
	const hasSelectedDescriptionRef = useRef(false);

	// Sync form state when transaction changes
	useEffect(() => {
		if (transaction) {
			hasSelectedDescriptionRef.current = false;
			setDescription(transaction.description ?? "");
			setAmount(String(Math.abs(transaction.amount)));
			setType(transaction.type);
			setCategory(transaction.category ?? "");
			setHashtags((transaction.hashtags ?? []).join(", "));
		}
	}, [transaction]);

	const handleSave = () => {
		if (!transaction) return;
		const parsedAmount = parseFloat(amount.replace(/,/g, ""));
		const parsedHashtags = hashtags
			.split(",")
			.map((tag) => tag.replace(/^#/, "").trim())
			.filter(Boolean);
		onSave({
			id: transaction.id,
			description: description || undefined,
			amount: Number.isFinite(parsedAmount) ? parsedAmount : undefined,
			type,
			category: category || undefined,
			hashtags: parsedHashtags,
		});
		onClose();
	};

	const open = !!transaction;

	return (
		<Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Transaction</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-1.5">
						<Label htmlFor="edit-description">Description</Label>
						<Input
							id="edit-description"
							onChange={(e) => setDescription(e.target.value)}
							onFocus={(e) => {
								if (hasSelectedDescriptionRef.current) return;
								hasSelectedDescriptionRef.current = true;
								e.currentTarget.select();
							}}
							placeholder="Transaction description"
							value={description}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="edit-amount">Amount</Label>
							<Input
								id="edit-amount"
								inputMode="decimal"
								min="0"
								onChange={(e) => setAmount(e.target.value)}
								placeholder="0.00"
								step="0.01"
								type="number"
								value={amount}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="edit-type">Type</Label>
							<Select
								onValueChange={(v) => setType(v as "INCOME" | "EXPENSE")}
								value={type}
							>
								<SelectTrigger id="edit-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="EXPENSE">Expense</SelectItem>
									<SelectItem value="INCOME">Income</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="edit-category">Category</Label>
						<Select
							onValueChange={(v) => setCategory(v === "__none__" ? "" : v)}
							value={category || "__none__"}
						>
							<SelectTrigger id="edit-category">
								<SelectValue placeholder="Select category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none__">No category</SelectItem>
								{categories.map((cat) => (
									<SelectItem key={cat} value={cat}>
										{cat}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="edit-hashtags">Hashtags</Label>
						<Input
							id="edit-hashtags"
							list="transaction-hashtags"
							onChange={(e) => setHashtags(e.target.value)}
							placeholder="tax, recurring"
							value={hashtags}
						/>
						<datalist id="transaction-hashtags">
							{allHashtags.map((tag) => (
								<option key={tag} value={tag} />
							))}
						</datalist>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={onClose} variant="outline">
						Cancel
					</Button>
					<Button disabled={isSaving} onClick={handleSave}>
						{isSaving ? "Saving…" : "Save changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
