import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@moat/ui";
import { ChevronDown, PenLine, Plus, Sparkles } from "lucide-react";
import type { PromptLibraryMode } from "./types";

type PromptsPageHeaderProps = {
	mode?: PromptLibraryMode;
	onCreateWithAi?: () => void;
	onWriteManually?: () => void;
	createDisabled?: boolean;
};

export function PromptsPageHeader({
	mode = "community",
	onCreateWithAi,
	onWriteManually,
	createDisabled = false,
}: PromptsPageHeaderProps) {
	const subtitle =
		mode === "private-only"
			? "Browse curated prompts or create private prompts stored on this device."
			: "Curated prompts, your personal library, and community prompts reviewed by Moat.";
	const showCreateMenu = onCreateWithAi != null && onWriteManually != null;

	return (
		<div className="flex items-start justify-between gap-4">
			<div>
				<h2 className="font-bold text-2xl tracking-tight">Prompts</h2>
				<p className="mt-1 text-muted-foreground text-sm">{subtitle}</p>
			</div>
			{showCreateMenu ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							aria-label="Add prompt"
							className="shrink-0 gap-2"
							disabled={createDisabled}
							size="sm"
						>
							<Plus className="h-4 w-4" />
							Add prompt
							<ChevronDown className="h-3.5 w-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => onCreateWithAi()}>
							<Sparkles className="h-4 w-4" />
							Make with AI
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={onWriteManually}>
							<PenLine className="h-4 w-4" />
							Write manually
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}
