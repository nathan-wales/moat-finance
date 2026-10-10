"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	type ProfileAccessOption,
	ProfileAccessPicker,
} from "./profile-access-picker";

type EditMemberAccessDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	memberName: string;
	profiles: ProfileAccessOption[];
	initialSelectedIds: string[];
	isSubmitting: boolean;
	onSave: (profileLinkIds: string[]) => void;
};

export function EditMemberAccessDialog({
	open,
	onOpenChange,
	memberName,
	profiles,
	initialSelectedIds,
	isSubmitting,
	onSave,
}: EditMemberAccessDialogProps) {
	const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setSelectedIds(initialSelectedIds);
			setError(null);
		}
	}, [open, initialSelectedIds]);

	function handleSave() {
		if (selectedIds.length === 0) {
			setError("Select at least one profile.");
			return;
		}
		setError(null);
		onSave(selectedIds);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit access</DialogTitle>
					<DialogDescription>
						Choose which profiles {memberName} can open and manage.
					</DialogDescription>
				</DialogHeader>

				<ProfileAccessPicker
					disabled={isSubmitting}
					onChange={setSelectedIds}
					profiles={profiles}
					selectedIds={selectedIds}
				/>

				{error ? <p className="text-destructive text-sm">{error}</p> : null}

				<DialogFooter>
					<Button
						disabled={isSubmitting}
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button disabled={isSubmitting} onClick={handleSave} type="button">
						{isSubmitting ? "Saving..." : "Save access"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
