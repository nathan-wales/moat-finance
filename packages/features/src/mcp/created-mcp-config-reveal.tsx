"use client";

import { cn, Skeleton } from "@moat/ui";
import { useEffect, useRef, useState } from "react";
import { MaskedMcpConfigSnippet } from "./masked-mcp-config-snippet";

const CONFIG_SKELETON_MS = 300;
const FADE_CLASS =
	"transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";

type CreatedMcpConfigRevealProps = {
	displayText: string | null;
	copied: boolean;
	onCopy: () => void;
};

function ConfigSkeletonLine({
	indentClassName,
	widthClassName,
}: {
	indentClassName?: string;
	widthClassName: string;
}) {
	return (
		<div className={cn("flex h-4 items-center", indentClassName)}>
			<Skeleton className={cn("h-2.5", widthClassName)} />
		</div>
	);
}

function McpConfigSnippetSkeleton() {
	return (
		<div className="space-y-3">
			<div className="rounded-md border bg-muted/40 p-3 font-mono text-xs leading-4">
				<ConfigSkeletonLine widthClassName="w-36" />
				<ConfigSkeletonLine indentClassName="pl-4" widthClassName="w-[92%]" />
				<ConfigSkeletonLine indentClassName="pl-4" widthClassName="w-24" />
				<ConfigSkeletonLine indentClassName="pl-8" widthClassName="w-[88%]" />
				<ConfigSkeletonLine indentClassName="pl-4" widthClassName="w-2.5" />
				<ConfigSkeletonLine widthClassName="w-2.5" />
			</div>
			<div className="text-xs leading-4">
				<ConfigSkeletonLine widthClassName="w-full" />
				<ConfigSkeletonLine widthClassName="w-[72%]" />
			</div>
		</div>
	);
}

export function CreatedMcpConfigReveal({
	displayText,
	copied,
	onCopy,
}: CreatedMcpConfigRevealProps) {
	const [revealed, setRevealed] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const mountedAtRef = useRef(Date.now());

	useEffect(() => {
		containerRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
		});
	}, []);

	useEffect(() => {
		if (!displayText || revealed) return;

		const remaining = Math.max(
			0,
			CONFIG_SKELETON_MS - (Date.now() - mountedAtRef.current),
		);
		const timeout = window.setTimeout(() => setRevealed(true), remaining);
		return () => window.clearTimeout(timeout);
	}, [displayText, revealed]);

	const skeletonClassName = cn(
		FADE_CLASS,
		"col-start-1 row-start-1",
		revealed ? "pointer-events-none z-0 opacity-0" : "z-10 opacity-100",
	);
	const snippetClassName = cn(
		FADE_CLASS,
		"col-start-1 row-start-1",
		revealed ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0",
	);

	return (
		<div className="space-y-3" ref={containerRef}>
			<p className="font-medium text-sm">MCP config</p>
			<div aria-busy={!revealed} aria-live="polite" className="grid">
				<div aria-hidden={revealed} className={skeletonClassName}>
					<McpConfigSnippetSkeleton />
				</div>
				{displayText ? (
					<div aria-hidden={!revealed} className={snippetClassName}>
						<MaskedMcpConfigSnippet
							copied={copied}
							displayText={displayText}
							onCopy={onCopy}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
