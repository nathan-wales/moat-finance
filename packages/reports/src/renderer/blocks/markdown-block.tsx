import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownBlock } from "../../schema/moat-report-document.schema";

interface Props {
	block: MarkdownBlock;
}

export function MarkdownBlock({ block }: Props) {
	return (
		<div className="prose prose-sm dark:prose-invert max-w-none">
			<ReactMarkdown
				disallowedElements={["html"]}
				remarkPlugins={[remarkGfm]}
				unwrapDisallowed
			>
				{block.body}
			</ReactMarkdown>
		</div>
	);
}
