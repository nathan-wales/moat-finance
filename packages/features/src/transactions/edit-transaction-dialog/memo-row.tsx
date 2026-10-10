"use client";

import { Button, cn } from "@moat/ui";
import { FileText } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

type MemoRowProps = {
	value: string;
};

export function MemoRow({ value }: MemoRowProps) {
	const textRef = useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [isTruncated, setIsTruncated] = useState(false);

	useLayoutEffect(() => {
		const element = textRef.current;
		if (!element || expanded) return;

		function updateTruncation() {
			if (!element) return;
			setIsTruncated(element.scrollHeight > element.clientHeight + 1);
		}

		if (value.length === 0) {
			setIsTruncated(false);
			return;
		}

		updateTruncation();
		const observer = new ResizeObserver(updateTruncation);
		observer.observe(element);
		return () => observer.disconnect();
	}, [expanded, value]);

	const showToggle = isTruncated || expanded;
	const toggleLabel = expanded ? "show less" : "… show more";
	const rowClassName =
		"flex min-h-12 w-full items-start justify-between gap-3 px-4 py-2.5";
	const valueWrapClassName = cn(
		"relative min-w-0",
		showToggle ? "flex-1" : "flex items-center",
		expanded && "flex flex-col items-end",
	);
	const memoClassName = cn(
		"min-w-0 break-words text-foreground text-sm leading-5",
		!expanded && "line-clamp-2",
		expanded && "w-full",
	);
	const toggleClassName = cn(
		"h-auto px-0 py-0 font-normal text-sm leading-5",
		expanded ? "mt-0.5" : "absolute right-0 bottom-0 z-10 bg-background pl-1",
	);

	return (
		<div className={rowClassName}>
			<span className="flex h-5 items-center gap-2.5 text-muted-foreground text-sm">
				<FileText className="size-4" />
				Memo
			</span>
			<div className={valueWrapClassName}>
				<p className={memoClassName} ref={textRef}>
					{value}
				</p>
				{showToggle ? (
					<Button
						aria-expanded={expanded}
						className={toggleClassName}
						onClick={() => setExpanded((current) => !current)}
						size="sm"
						type="button"
						variant="link"
					>
						{toggleLabel}
					</Button>
				) : null}
			</div>
		</div>
	);
}
