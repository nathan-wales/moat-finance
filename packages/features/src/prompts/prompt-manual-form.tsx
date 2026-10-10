import type {
	CreateUserPromptInput,
	UpdateUserPromptInput,
	UserPromptDetail,
} from "@moat/contracts";
import {
	Button,
	Input,
	Label,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Textarea,
} from "@moat/ui";
import { useEffect, useState } from "react";
import {
	fromCategorySelectValue,
	PROMPT_CATEGORY_NONE,
	toCategorySelectValue,
} from "./prompt-category-select";
import {
	PromptCategoryField,
	PromptVisibilitySection,
	type VisibilityChoice,
} from "./prompt-visibility-section";
import type { PromptLibraryMode, PromptLibraryNotifications } from "./types";

function createSubmitLabel(
	mode: PromptLibraryMode,
	visibility: VisibilityChoice,
): string {
	if (mode === "private-only") return "Save private prompt";
	if (visibility === "community") return "Save and submit for review";
	return "Save private prompt";
}

type PromptManualFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode?: PromptLibraryMode;
	categories: Array<{
		id: string;
		slug: string;
		label: string;
		sortOrder?: number;
	}>;
	initialValues?: Partial<CreateUserPromptInput>;
	editPrompt?: UserPromptDetail | null;
	onSubmit: (input: CreateUserPromptInput) => Promise<void>;
	onUpdate?: (input: UpdateUserPromptInput) => Promise<void>;
	isSubmitting?: boolean;
	notifications?: PromptLibraryNotifications;
};

export function PromptManualForm({
	open,
	onOpenChange,
	mode = "community",
	categories,
	initialValues,
	editPrompt,
	onSubmit,
	onUpdate,
	isSubmitting,
}: PromptManualFormProps) {
	const isEditing = editPrompt !== null && editPrompt !== undefined;
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [categorySlug, setCategorySlug] =
		useState<string>(PROMPT_CATEGORY_NONE);
	const [tags, setTags] = useState("");
	const [visibility, setVisibility] = useState<VisibilityChoice>("private");

	useEffect(() => {
		if (!open) return;
		if (editPrompt) {
			setTitle(editPrompt.title);
			setBody(editPrompt.body);
			setCategorySlug(toCategorySelectValue(editPrompt.categorySlug));
			setTags(editPrompt.tags.join(", "));
			setVisibility("private");
			return;
		}
		setTitle(initialValues?.title ?? "");
		setBody(initialValues?.body ?? "");
		setCategorySlug(toCategorySelectValue(initialValues?.categorySlug));
		setTags((initialValues?.tags ?? []).join(", "));
		setVisibility("private");
	}, [open, initialValues, editPrompt]);

	const panelTitle = isEditing ? "Edit prompt" : "Create prompt";
	const submitLabel = isEditing
		? "Save changes"
		: createSubmitLabel(mode, visibility);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!title.trim() || !body.trim()) return;

		const parsedTags = tags
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
		const resolvedCategorySlug = fromCategorySelectValue(categorySlug);

		if (isEditing && editPrompt && onUpdate) {
			await onUpdate({
				promptId: editPrompt.id,
				title: title.trim(),
				body: body.trim(),
				categorySlug: resolvedCategorySlug,
				tags: parsedTags,
			});
			return;
		}

		await onSubmit({
			title: title.trim(),
			description: null,
			body: body.trim(),
			categorySlug: resolvedCategorySlug,
			tags: parsedTags,
			submitForReview: mode === "community" && visibility === "community",
		});
	}

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent size="lg">
				<form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
					<SidePanelHeader>
						<SidePanelTitle>{panelTitle}</SidePanelTitle>
					</SidePanelHeader>
					<SidePanelBody className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="prompt-title">Title</Label>
							<Input
								id="prompt-title"
								onChange={(e) => setTitle(e.target.value)}
								required
								value={title}
							/>
						</div>
						<PromptCategoryField
							categories={categories}
							onChange={setCategorySlug}
							value={categorySlug}
						/>
						<div className="space-y-2">
							<Label htmlFor="prompt-body">Prompt body</Label>
							<Textarea
								className="min-h-64"
								id="prompt-body"
								onChange={(e) => setBody(e.target.value)}
								required
								rows={14}
								value={body}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="prompt-tags">Tags (comma-separated)</Label>
							<Input
								id="prompt-tags"
								onChange={(e) => setTags(e.target.value)}
								placeholder="budgeting, cash-flow"
								value={tags}
							/>
						</div>
						{!isEditing && (
							<PromptVisibilitySection
								mode={mode}
								onChange={setVisibility}
								value={visibility}
							/>
						)}
					</SidePanelBody>
					<SidePanelFooter>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button disabled={isSubmitting} type="submit">
							{submitLabel}
						</Button>
					</SidePanelFooter>
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}
