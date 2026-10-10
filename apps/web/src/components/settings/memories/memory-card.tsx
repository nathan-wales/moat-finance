"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { deleteMemory, type MemoryItem } from "~/lib/api/memories";
import { MemoryDialog } from "./memory-dialog";

const CATEGORY_LABELS: Record<string, string> = {
	preference: "Preference",
	financial_goal: "Financial goal",
	account_context: "Account context",
	budgeting_rule: "Budgeting rule",
	tax_context: "Tax context",
	insurance_context: "Insurance context",
	household_context: "Household context",
	business_context: "Business context",
	other: "Other",
};

const SOURCE_LABELS: Record<string, string> = {
	manual: "Manual",
	agent: "Agent",
	mcp: "MCP",
};

function formatDate(iso: string) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

interface MemoryCardProps {
	memory: MemoryItem;
}

export function MemoryCard({ memory }: MemoryCardProps) {
	const queryClient = useQueryClient();
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const deleteMutation = useMutation({
		mutationFn: () => deleteMemory({ id: memory.id }),
		onSuccess: () => {
			toast.success("Memory deleted");
			void queryClient.invalidateQueries({ queryKey: ["memories"] });
			setDeleteOpen(false);
		},
		onError: () => toast.error("Failed to delete memory"),
	});

	return (
		<>
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 space-y-1">
							<p className="font-medium text-sm leading-tight">
								{memory.title}
							</p>
							<div className="flex flex-wrap items-center gap-1.5">
								{memory.category && (
									<Badge className="text-xs" variant="secondary">
										{CATEGORY_LABELS[memory.category] ?? memory.category}
									</Badge>
								)}
								<Badge className="text-xs" variant="outline">
									{SOURCE_LABELS[memory.source] ?? memory.source}
								</Badge>
							</div>
						</div>
						<div className="flex shrink-0 gap-1">
							<Button
								className="h-7 w-7"
								onClick={() => setEditOpen(true)}
								size="icon"
								variant="ghost"
							>
								<Pencil className="h-3.5 w-3.5" />
								<span className="sr-only">Edit memory</span>
							</Button>
							<Button
								className="h-7 w-7 text-destructive hover:text-destructive"
								onClick={() => setDeleteOpen(true)}
								size="icon"
								variant="ghost"
							>
								<Trash2 className="h-3.5 w-3.5" />
								<span className="sr-only">Delete memory</span>
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-2">
					<p className="text-muted-foreground text-sm">{memory.content}</p>
					<p className="text-muted-foreground text-xs">
						Created {formatDate(memory.createdAt)}
						{memory.updatedAt !== memory.createdAt && (
							<> · Updated {formatDate(memory.updatedAt)}</>
						)}
					</p>
				</CardContent>
			</Card>

			<MemoryDialog
				memory={memory}
				onOpenChange={setEditOpen}
				open={editOpen}
			/>

			<Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete memory?</DialogTitle>
						<DialogDescription>
							"{memory.title}" will be permanently deleted.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							disabled={deleteMutation.isPending}
							onClick={() => setDeleteOpen(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={deleteMutation.isPending}
							onClick={() => deleteMutation.mutate()}
							variant="destructive"
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
