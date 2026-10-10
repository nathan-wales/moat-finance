import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "~/lib/utils";

export type MoatAiChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	tone?: "default" | "error";
};

export function MoatAiMessage({ message }: { message: MoatAiChatMessage }) {
	const isUser = message.role === "user";
	const isError = message.tone === "error";

	return (
		<div
			className={cn(
				"max-w-[82%] rounded-xl border px-3 py-2 text-sm leading-6",
				isUser
					? "bg-primary/50 text-primary-foreground"
					: "bg-card text-card-foreground",
				isError && "border-destructive/30 bg-destructive/10 text-destructive",
			)}
		>
			{isUser || isError ? (
				<div className="whitespace-pre-wrap break-words">{message.content}</div>
			) : (
				<MarkdownContent content={message.content} />
			)}
		</div>
	);
}

function MarkdownContent({ content }: { content: string }) {
	return (
		<div className="moat-ai-markdown break-words text-sm leading-6">
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
		</div>
	);
}
