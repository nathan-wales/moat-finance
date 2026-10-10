import { Label } from "@moat/ui";
import { PromptCategorySelect } from "./prompt-category-select";
import type { PromptLibraryMode } from "./types";

type VisibilityChoice = "private" | "community";

type PromptVisibilitySectionProps = {
	mode?: PromptLibraryMode;
	value: VisibilityChoice;
	onChange: (value: VisibilityChoice) => void;
};

export function PromptVisibilitySection({
	mode = "community",
	value,
	onChange,
}: PromptVisibilitySectionProps) {
	if (mode === "private-only") return null;

	return (
		<div className="space-y-3 rounded-lg border p-4">
			<p className="font-medium text-sm">Who is this prompt for?</p>
			<div className="grid gap-3">
				<label className="flex cursor-pointer gap-3 rounded-md border p-3">
					<input
						checked={value === "private"}
						className="mt-1"
						name="prompt-visibility"
						onChange={() => onChange("private")}
						type="radio"
					/>
					<span>
						<span className="font-medium text-sm">🔒 Just me</span>
						<span className="mt-0.5 block text-muted-foreground text-xs">
							Save it privately in your library.
						</span>
					</span>
				</label>
				<label className="flex cursor-pointer gap-3 rounded-md border p-3">
					<input
						checked={value === "community"}
						className="mt-1"
						name="prompt-visibility"
						onChange={() => onChange("community")}
						type="radio"
					/>
					<span>
						<span className="font-medium text-sm">
							🌎 Submit to the community
						</span>
						<span className="mt-0.5 block text-muted-foreground text-xs">
							Send it for review. It will remain available privately while it is
							reviewed.
						</span>
					</span>
				</label>
			</div>
		</div>
	);
}

export function PromptCategoryField({
	categories,
	value,
	onChange,
}: {
	categories: Array<{
		id: string;
		slug: string;
		label: string;
		sortOrder?: number;
	}>;
	value: string;
	onChange: (slug: string) => void;
}) {
	return (
		<div className="space-y-2">
			<Label>Category</Label>
			<PromptCategorySelect
				categories={categories}
				onChange={onChange}
				showNone
				triggerClassName="w-full"
				value={value}
			/>
		</div>
	);
}

export type { VisibilityChoice };
