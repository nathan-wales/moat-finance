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
} from "@moat/ui";
import { useEffect, useState } from "react";

export function SaveScenarioDialog({
	open,
	onOpenChange,
	initialName,
	isPending,
	onSave,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialName: string;
	isPending: boolean;
	onSave: (name: string) => void;
}) {
	const [name, setName] = useState(initialName);

	useEffect(() => {
		if (open) setName(initialName);
	}, [initialName, open]);

	function submit() {
		const trimmed = name.trim();
		if (!trimmed) return;
		onSave(trimmed);
	}

	const saveLabel = isPending ? "Saving…" : "Save";

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Save scenario</DialogTitle>
					<DialogDescription>
						Named scenarios re-derive from your live accounts whenever you open
						them.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="retirement-scenario-name">Name</Label>
					<Input
						id="retirement-scenario-name"
						maxLength={80}
						onChange={(event) => setName(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") submit();
						}}
						value={name}
					/>
				</div>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button
						onClick={() => onOpenChange(false)}
						size="sm"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || isPending}
						onClick={submit}
						size="sm"
					>
						{saveLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
