import {
	Button,
	Checkbox,
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

type SaveMappingTemplateDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (name: string, makeDefault: boolean) => void;
};

export function SaveMappingTemplateDialog({
	open,
	onOpenChange,
	onSave,
}: SaveMappingTemplateDialogProps) {
	const [name, setName] = useState("");
	const [makeDefault, setMakeDefault] = useState(false);

	useEffect(() => {
		if (open) {
			setName("");
			setMakeDefault(false);
		}
	}, [open]);

	function submit() {
		const trimmed = name.trim();
		if (!trimmed) return;
		onSave(trimmed, makeDefault);
		onOpenChange(false);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Save template</DialogTitle>
					<DialogDescription>
						Reuse these column mappings the next time you import a similar CSV.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="import-template-name">Name</Label>
						<Input
							id="import-template-name"
							maxLength={80}
							onChange={(event) => setName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") submit();
							}}
							placeholder="Chase checking"
							value={name}
						/>
					</div>
					<label
						className="flex cursor-pointer items-start gap-3 text-sm"
						htmlFor="import-template-default"
					>
						<Checkbox
							checked={makeDefault}
							className="mt-0.5"
							id="import-template-default"
							onCheckedChange={(checked) => setMakeDefault(checked === true)}
						/>
						<span>Make this the default template</span>
					</label>
				</div>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button
						onClick={() => onOpenChange(false)}
						size="sm"
						variant="outline"
					>
						Cancel
					</Button>
					<Button disabled={!name.trim()} onClick={submit} size="sm">
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
