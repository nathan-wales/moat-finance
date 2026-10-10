"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { deleteAllMemories } from "~/lib/api/memories";

interface DeleteAllMemoriesDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteAllMemoriesDialog({
	open,
	onOpenChange,
}: DeleteAllMemoriesDialogProps) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: deleteAllMemories,
		onSuccess: () => {
			toast.success("All memories deleted");
			void queryClient.invalidateQueries({ queryKey: ["memories"] });
			onOpenChange(false);
		},
		onError: () => toast.error("Failed to delete memories"),
	});

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete all memories?</DialogTitle>
					<DialogDescription>
						This will permanently delete every saved memory, including those
						created by the agent. This cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						disabled={mutation.isPending}
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={mutation.isPending}
						onClick={() => mutation.mutate()}
						variant="destructive"
					>
						{mutation.isPending ? "Deleting…" : "Delete all memories"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
