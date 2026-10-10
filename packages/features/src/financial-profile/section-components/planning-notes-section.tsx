import {
	Badge,
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
} from "@moat/ui";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import {
	createId,
	currentDateString,
	EditFieldsDialog,
	EditIconButton,
	EmptyState,
	type FieldValues,
	optionalStringValue,
	RowActions,
	SectionCard,
	stringValue,
} from "../components";
import { planningNoteFields } from "../field-options";
import type { PlanningNote } from "../types";
import type { FinancialProfileSectionProps } from "./types";

const INITIAL_VISIBLE = 6;
const LOAD_MORE_COUNT = 3;
const ALL_TAGS = "all";

function parseNoteTags(tag: string | undefined): string[] {
	if (!tag) return [];
	const seen = new Set<string>();
	const tags: string[] = [];
	for (const part of tag.split(",")) {
		const trimmed = part.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		tags.push(trimmed);
	}
	return tags;
}

function normalizeNoteTag(tag: string | undefined): string | undefined {
	const tags = parseNoteTags(tag);
	return tags.length > 0 ? tags.join(", ") : undefined;
}

function valuesToPlanningNote(
	values: FieldValues,
	fallback: PlanningNote,
): PlanningNote {
	return {
		...fallback,
		title: stringValue(values.title),
		body: stringValue(values.body),
		tag: normalizeNoteTag(optionalStringValue(values.tag)),
		lastUpdated: currentDateString(),
	};
}

function createEmptyPlanningNote(): PlanningNote {
	return {
		id: createId("note"),
		title: "New note",
		body: "",
		lastUpdated: currentDateString(),
	};
}

function collectUniqueTags(notes: PlanningNote[]): string[] {
	const seen = new Set<string>();
	const tags: string[] = [];
	for (const note of notes) {
		for (const tag of parseNoteTags(note.tag)) {
			if (seen.has(tag)) continue;
			seen.add(tag);
			tags.push(tag);
		}
	}
	return tags.sort((a, b) => a.localeCompare(b));
}

function noteMatchesFilters(
	note: PlanningNote,
	searchQuery: string,
	selectedTag: string,
): boolean {
	const tags = parseNoteTags(note.tag);

	if (selectedTag !== ALL_TAGS && !tags.includes(selectedTag)) {
		return false;
	}

	const query = searchQuery.trim().toLowerCase();
	if (!query) return true;

	if (note.title.toLowerCase().includes(query)) return true;
	if (note.body.toLowerCase().includes(query)) return true;
	return tags.some((tag) => tag.toLowerCase().includes(query));
}

const MAX_VISIBLE_TAGS = 2;

function NoteTags({ tags }: { tags: string[] }) {
	if (tags.length === 0) return null;

	const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
	const overflowCount = tags.length - visibleTags.length;

	return (
		<>
			{visibleTags.map((tag) => (
				<Badge
					className="max-w-[70%] truncate"
					key={tag}
					title={tag}
					variant="outline"
				>
					{tag}
				</Badge>
			))}
			{overflowCount > 0 ? (
				<Badge className="shrink-0" variant="secondary">
					+{overflowCount}
				</Badge>
			) : null}
		</>
	);
}

function PlanningNoteCard({
	note,
	isSaving,
	onSave,
	onDelete,
}: {
	note: PlanningNote;
	isSaving: boolean;
	onSave: (values: FieldValues) => void;
	onDelete: () => void;
}) {
	const [editOpen, setEditOpen] = useState(false);
	const tags = parseNoteTags(note.tag);

	function openEdit() {
		setEditOpen(true);
	}

	return (
		<>
			<div className="relative flex h-[260px] flex-col overflow-hidden rounded-xl border p-6 transition-colors hover:bg-muted/40">
				<button
					aria-label={`Open ${note.title}`}
					className="absolute inset-0 z-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={openEdit}
					type="button"
				/>
				<div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col">
					<div className="flex shrink-0 items-start justify-between gap-4">
						<h3 className="line-clamp-1 min-w-0 flex-1 font-semibold text-sm">
							{note.title}
						</h3>
						<div className="pointer-events-auto shrink-0">
							<RowActions
								editDialog={
									<EditIconButton itemName={note.title} onClick={openEdit} />
								}
								itemName={note.title}
								onDelete={onDelete}
							/>
						</div>
					</div>

					<div className="mt-3 flex h-8 shrink-0 items-start gap-2 overflow-hidden">
						<NoteTags tags={tags} />
					</div>

					<p className="mt-4 line-clamp-4 shrink-0 text-muted-foreground text-sm leading-6">
						{note.body}
					</p>

					<p className="mt-auto shrink-0 pt-4 text-muted-foreground text-xs">
						Last updated {note.lastUpdated}
					</p>
				</div>
			</div>

			<EditFieldsDialog
				fields={planningNoteFields}
				initialValues={note}
				isSaving={isSaving}
				onOpenChange={setEditOpen}
				onSave={onSave}
				open={editOpen}
				title={`Edit ${note.title}`}
			/>
		</>
	);
}

export function PlanningNotesSection({
	data,
	onChange,
	isSaving,
	isLoading = false,
}: FinancialProfileSectionProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTag, setSelectedTag] = useState(ALL_TAGS);
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
	const [filterResetKey, setFilterResetKey] = useState(
		() => `${searchQuery}\0${selectedTag}`,
	);

	const nextFilterKey = `${searchQuery}\0${selectedTag}`;
	if (filterResetKey !== nextFilterKey) {
		setFilterResetKey(nextFilterKey);
		setVisibleCount(INITIAL_VISIBLE);
	}

	const showToolbar = data.planningNotes.length > INITIAL_VISIBLE;
	const availableTags = collectUniqueTags(data.planningNotes);
	const filteredNotes = data.planningNotes.filter((note) =>
		noteMatchesFilters(note, searchQuery, selectedTag),
	);
	const visibleNotes = filteredNotes.slice(0, visibleCount);
	const hasMore = visibleCount < filteredNotes.length;

	function upsertNote(note: PlanningNote) {
		const exists = data.planningNotes.some((item) => item.id === note.id);
		onChange({
			...data,
			planningNotes: exists
				? data.planningNotes.map((item) => (item.id === note.id ? note : item))
				: [...data.planningNotes, note],
		});
	}

	function deleteNote(noteId: string) {
		onChange({
			...data,
			planningNotes: data.planningNotes.filter((note) => note.id !== noteId),
		});
	}

	function handleSearchChange(value: string) {
		setSearchQuery(value);
	}

	function handleTagChange(value: string) {
		setSelectedTag(value);
	}

	function handleLoadMore() {
		setVisibleCount((count) =>
			Math.min(count + LOAD_MORE_COUNT, filteredNotes.length),
		);
	}

	return (
		<SectionCard
			action={
				<EditFieldsDialog
					fields={planningNoteFields}
					initialValues={createEmptyPlanningNote()}
					isSaving={isSaving}
					onSave={(values) =>
						upsertNote(valuesToPlanningNote(values, createEmptyPlanningNote()))
					}
					title="Add Note"
					trigger={
						<Button disabled={isLoading} size="sm">
							<Plus className="h-4 w-4" />
							Note
						</Button>
					}
				/>
			}
			description="Unstructured context and preferences Moat can use for personalized assistance."
			icon={FileText}
			id="planning-notes"
			title="Planning Notes"
		>
			{isLoading ? (
				<div className="grid gap-3 md:grid-cols-2">
					{["skeleton-a", "skeleton-b"].map((skeletonKey) => (
						<div
							className="flex h-[260px] flex-col overflow-hidden rounded-xl border p-6"
							key={skeletonKey}
						>
							<Skeleton className="h-4 w-32" />
							<div className="mt-3 h-8">
								<Skeleton className="h-5 w-20" />
							</div>
							<div className="mt-4 space-y-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-5/6" />
								<Skeleton className="h-4 w-4/5" />
							</div>
							<Skeleton className="mt-auto h-3 w-28" />
						</div>
					))}
				</div>
			) : data.planningNotes.length === 0 ? (
				<EmptyState label="Add preferences, constraints, and life context that should guide Moat Finance's projections and LLM assistance." />
			) : (
				<div className="space-y-4">
					{showToolbar ? (
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<Input
								className="h-9 w-full max-w-sm flex-1 text-sm"
								onChange={(e) => handleSearchChange(e.target.value)}
								placeholder="Search notes…"
								value={searchQuery}
							/>
							<Select onValueChange={handleTagChange} value={selectedTag}>
								<SelectTrigger className="h-9 w-fit text-sm">
									<span className="text-muted-foreground">Tag:</span>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_TAGS}>All tags</SelectItem>
									{availableTags.map((tag) => (
										<SelectItem key={tag} value={tag}>
											{tag}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}

					{filteredNotes.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No notes match your search or tag filter.
						</p>
					) : (
						<>
							<div className="grid gap-3 md:grid-cols-2">
								{visibleNotes.map((note) => (
									<PlanningNoteCard
										isSaving={isSaving}
										key={note.id}
										note={note}
										onDelete={() => deleteNote(note.id)}
										onSave={(values) =>
											upsertNote(valuesToPlanningNote(values, note))
										}
									/>
								))}
							</div>

							{hasMore ? (
								<div className="flex justify-center">
									<Button onClick={handleLoadMore} size="sm" variant="outline">
										Load more
									</Button>
								</div>
							) : null}
						</>
					)}
				</div>
			)}
		</SectionCard>
	);
}
