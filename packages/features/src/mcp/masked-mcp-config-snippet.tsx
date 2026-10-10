import { Button } from "@moat/ui";
import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";

type MaskedMcpConfigSnippetProps = {
	displayText: string;
	copied: boolean;
	onCopy: () => void;
	caption?: ReactNode;
};

const DEFAULT_CAPTION = (
	<>
		The token is masked here. Copy includes the real{" "}
		<span className="font-mono">Bearer</span> value. Paste it into your
		tool&apos;s MCP settings and follow that platform&apos;s instructions.
	</>
);

export function MaskedMcpConfigSnippet({
	displayText,
	copied,
	onCopy,
	caption = DEFAULT_CAPTION,
}: MaskedMcpConfigSnippetProps) {
	const copyLabel = copied ? "Copied" : "Copy config";

	return (
		<div className="space-y-3">
			<div className="group relative">
				<pre className="select-none overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
					{displayText}
				</pre>
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-background/70 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
					<Button onClick={onCopy} type="button" variant="secondary">
						{copied ? (
							<Check className="h-4 w-4" />
						) : (
							<Copy className="h-4 w-4" />
						)}
						{copyLabel}
					</Button>
				</div>
			</div>
			<p className="text-muted-foreground text-xs">{caption}</p>
		</div>
	);
}
