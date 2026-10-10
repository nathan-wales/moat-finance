import {
	InlineRuleSuggestInput,
	type InlineRuleSuggestOption,
	inlineRuleUnderlineClass,
} from "@moat/ui";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import type { HashtagEntry } from "./types";
import { suggestHashtags } from "./utils";

export function HashtagToken({
	entries,
	hashtags,
	onAdd,
	onRemove,
}: {
	entries: HashtagEntry[];
	hashtags: { id: string | null; name: string }[];
	onAdd: (entry: HashtagEntry) => void;
	onRemove: (name: string) => void;
}) {
	const [draft, setDraft] = useState("");

	const query = draft.trim().replace(/^#/, "");

	const options = useMemo<InlineRuleSuggestOption[]>(() => {
		const selected = new Set(entries.map((e) => e.name.toLowerCase()));
		const available = hashtags
			.filter((h) => !selected.has(h.name.toLowerCase()))
			.map((h) => h.name);
		return suggestHashtags(available, query).map((name) => ({
			label: `#${name}`,
			value: name,
		}));
	}, [entries, hashtags, query]);

	function commit(name: string) {
		const cleanName = name.trim().replace(/^#/, "");
		if (!cleanName) return;
		const existing = hashtags.find(
			(h) => h.name.toLowerCase() === cleanName.toLowerCase(),
		);
		const alreadySelected = entries.some(
			(e) => e.name.toLowerCase() === cleanName.toLowerCase(),
		);
		if (!alreadySelected) onAdd({ name: cleanName, id: existing?.id ?? null });
		setDraft("");
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Backspace" && !draft && entries.length > 0) {
			const last = entries.at(-1);
			if (last) onRemove(last.name);
			return;
		}
		if (event.key === ",") {
			event.preventDefault();
			commit(draft);
		}
	}

	const alreadyExists = hashtags.some(
		(h) => h.name.toLowerCase() === query.toLowerCase(),
	);
	const footerAction =
		query && !alreadyExists
			? {
					label: `+ Create "#${query}"`,
					onSelect: () => commit(query),
				}
			: undefined;

	return (
		<>
			{entries.map((entry) => (
				<span
					className="inline-flex items-baseline gap-0.5 py-1.5 align-baseline text-foreground text-sm leading-7"
					key={entry.name}
				>
					<span className={inlineRuleUnderlineClass()}>#{entry.name}</span>
					<button
						aria-label={`Remove hashtag ${entry.name}`}
						className="-m-1 inline-flex size-6 items-center justify-center self-center rounded-xs p-1 text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/70 motion-reduce:transition-none"
						onClick={() => onRemove(entry.name)}
						type="button"
					>
						<X aria-hidden="true" className="size-3" />
					</button>
				</span>
			))}
			<InlineRuleSuggestInput
				ariaLabel="Hashtag to add"
				autoActivateFirstOption
				autoCapitalize="off"
				autoCorrect="off"
				footerAction={footerAction}
				onCommit={() => setDraft("")}
				onKeyDown={handleKeyDown}
				onSelectOption={commit}
				onValueChange={setDraft}
				options={options}
				placeholder={entries.length > 0 ? "add another" : "tagname"}
				value={draft}
			/>
		</>
	);
}
