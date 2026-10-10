"use client";

import {
	Button,
	Checkbox,
	Input,
	Label,
	NumericInput,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Textarea,
} from "@moat/ui";
import { useEffect, useState } from "react";
import { formatPercentInput, HelpLabel } from "../financial-profile/components";

export interface EditInvestmentDialogInvestment {
	id: string;
	name: string;
	type: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	notes?: string | null;
	autoUpdateBalance?: boolean;
}

export interface EditInvestmentDialogSaveInput {
	id: string;
	name: string;
	startingBalance?: number;
	monthlyContribution: number;
	annualReturnRate: number;
	notes: string | null;
	autoUpdateBalance?: boolean;
}

interface EditInvestmentDialogProps {
	investment: EditInvestmentDialogInvestment | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (input: EditInvestmentDialogSaveInput) => Promise<void>;
	isPlaidAccount?: boolean;
}

function parseNumericInput(value: string): number {
	return Number(value.replace(/,/g, "")) || 0;
}

export function EditInvestmentDialog({
	investment,
	open,
	onOpenChange,
	onSave,
	isPlaidAccount = false,
}: EditInvestmentDialogProps) {
	const isOtherType = investment?.type === "OTHER";
	const [form, setForm] = useState({
		name: "",
		startingBalance: "",
		monthlyContribution: "",
		annualReturnRate: "",
		notes: "",
		autoUpdateBalance: true,
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!investment || !open) return;
		setForm({
			name: investment.name,
			startingBalance: String(investment.startingBalance),
			monthlyContribution: String(investment.monthlyContribution),
			annualReturnRate: formatPercentInput(investment.annualReturnRate * 100),
			notes: investment.notes ?? "",
			autoUpdateBalance: investment.autoUpdateBalance ?? true,
		});
		setError(null);
	}, [investment, open]);

	async function handleSave() {
		if (!investment) return;
		setSaving(true);
		setError(null);
		const trimmedNotes = form.notes.trim();
		const notes = trimmedNotes.length > 0 ? trimmedNotes : null;
		const monthlyContribution = isOtherType
			? 0
			: parseNumericInput(form.monthlyContribution);
		const annualReturnRate = (Number(form.annualReturnRate) || 0) / 100;

		try {
			await onSave(
				isPlaidAccount
					? {
							id: investment.id,
							name: form.name.trim(),
							monthlyContribution,
							annualReturnRate,
							notes,
						}
					: {
							id: investment.id,
							name: form.name.trim(),
							startingBalance: parseNumericInput(form.startingBalance),
							monthlyContribution,
							annualReturnRate,
							notes,
							autoUpdateBalance: form.autoUpdateBalance,
						},
			);
			onOpenChange(false);
		} catch {
			setError("Failed to save changes.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent size="md">
				<SidePanelHeader>
					<SidePanelTitle>Edit investment</SidePanelTitle>
				</SidePanelHeader>
				<SidePanelBody className="space-y-3">
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
					<div className="space-y-1">
						<Label htmlFor="edit-investment-name">Name</Label>
						<Input
							id="edit-investment-name"
							onChange={(event) =>
								setForm((previous) => ({
									...previous,
									name: event.target.value,
								}))
							}
							value={form.name}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="edit-investment-balance">
							{isPlaidAccount ? "Starting balance ($)" : "Balance ($)"}
						</Label>
						<NumericInput
							disabled={isPlaidAccount}
							id="edit-investment-balance"
							onChange={(value) =>
								setForm((previous) => ({
									...previous,
									startingBalance: value,
								}))
							}
							value={form.startingBalance}
						/>
					</div>
					{isOtherType ? null : (
						<div className="space-y-1">
							<Label htmlFor="edit-investment-monthly-contribution">
								Monthly contribution ($)
							</Label>
							<NumericInput
								id="edit-investment-monthly-contribution"
								onChange={(value) =>
									setForm((previous) => ({
										...previous,
										monthlyContribution: value,
									}))
								}
								value={form.monthlyContribution}
							/>
						</div>
					)}
					<div className="space-y-1">
						<Label htmlFor="edit-investment-annual-return">
							Annual return (%)
						</Label>
						<Input
							id="edit-investment-annual-return"
							onChange={(event) =>
								setForm((previous) => ({
									...previous,
									annualReturnRate: event.target.value,
								}))
							}
							placeholder="7"
							type="number"
							value={form.annualReturnRate}
						/>
					</div>
					{isPlaidAccount ? null : (
						<div className="flex items-start gap-3 text-sm">
							<Checkbox
								checked={form.autoUpdateBalance}
								className="mt-0.5"
								id="edit-investment-auto-update"
								onCheckedChange={(checked) =>
									setForm((previous) => ({
										...previous,
										autoUpdateBalance: checked === true,
									}))
								}
							/>
							<div className="flex min-w-0 flex-col gap-0.5">
								<HelpLabel
									htmlFor="edit-investment-auto-update"
									label="Auto-update my balance every month"
									text="Keeps this manual account up to date as if it were synced. On the monthly anniversary, Moat adds your contribution and expected return to the balance. Turn off to keep the balance fixed until you edit it."
								/>
							</div>
						</div>
					)}
					<div className="space-y-1">
						<Label htmlFor="edit-investment-notes">Notes</Label>
						<Textarea
							id="edit-investment-notes"
							onChange={(event) =>
								setForm((previous) => ({
									...previous,
									notes: event.target.value,
								}))
							}
							placeholder="Optional notes about this investment"
							value={form.notes}
						/>
					</div>
				</SidePanelBody>
				<SidePanelFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
					<Button
						disabled={saving || !form.name.trim()}
						onClick={() => void handleSave()}
					>
						{saving ? "Saving…" : "Save"}
					</Button>
				</SidePanelFooter>
			</SidePanelContent>
		</SidePanel>
	);
}
