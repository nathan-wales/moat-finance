import { Button, cn, WithTooltip } from "@moat/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import {
	TITLEBAR_HEIGHT_PX,
	TRAFFIC_LIGHT_CONTENT_INSET_PX,
} from "../../../shared/titlebar";

const isMac = navigator.userAgent.includes("Mac");

function isTextEditingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tagName = target.tagName;
	return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function isHistoryNavigationShortcut(
	event: KeyboardEvent,
): "back" | "forward" | null {
	const modifierPressed = isMac ? event.metaKey : event.ctrlKey;
	if (!modifierPressed || event.altKey || event.shiftKey || event.repeat) {
		return null;
	}
	if (event.key === "ArrowLeft") return "back";
	if (event.key === "ArrowRight") return "forward";
	return null;
}

function HistoryNavButton({
	direction,
	disabled,
	onClick,
}: {
	direction: "back" | "forward";
	disabled: boolean;
	onClick: () => void;
}): React.ReactElement {
	const isBack = direction === "back";
	const arrowKey = isBack ? "ArrowLeft" : "ArrowRight";

	return (
		<WithTooltip
			keys={["Mod", arrowKey]}
			side="bottom"
			text={isBack ? "Back" : "Forward"}
		>
			<span className="inline-flex">
				<Button
					aria-keyshortcuts={isMac ? `Meta+${arrowKey}` : `Control+${arrowKey}`}
					aria-label={isBack ? "Go back" : "Go forward"}
					className="size-8 text-muted-foreground hover:text-foreground disabled:text-muted-foreground/40"
					disabled={disabled}
					onClick={onClick}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					{isBack ? (
						<ChevronLeft className="size-5" />
					) : (
						<ChevronRight className="size-5" />
					)}
				</Button>
			</span>
		</WithTooltip>
	);
}

interface WindowTitleBarProps {
	canGoBack: boolean;
	canGoForward: boolean;
	onBack: () => void;
	onForward: () => void;
	showNavigation?: boolean;
}

export function WindowTitleBar({
	canGoBack,
	canGoForward,
	onBack,
	onForward,
	showNavigation = true,
}: WindowTitleBarProps): React.ReactElement {
	useEffect(() => {
		if (!showNavigation) return;

		function handleKeyDown(event: KeyboardEvent) {
			const direction = isHistoryNavigationShortcut(event);
			if (!direction) return;
			if (isTextEditingTarget(event.target)) return;

			if (direction === "back" && canGoBack) {
				event.preventDefault();
				onBack();
				return;
			}
			if (direction === "forward" && canGoForward) {
				event.preventDefault();
				onForward();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showNavigation, canGoBack, canGoForward, onBack, onForward]);

	return (
		<header
			className={cn(
				"flex shrink-0 items-center bg-muted/70 [-webkit-app-region:drag]",
				isMac ? undefined : "pl-3",
			)}
			style={{
				height: TITLEBAR_HEIGHT_PX,
				paddingLeft: isMac ? TRAFFIC_LIGHT_CONTENT_INSET_PX : undefined,
			}}
		>
			{showNavigation ? (
				<div className="flex items-center gap-1 px-1.5 [-webkit-app-region:no-drag]">
					<HistoryNavButton
						direction="back"
						disabled={!canGoBack}
						onClick={onBack}
					/>
					<HistoryNavButton
						direction="forward"
						disabled={!canGoForward}
						onClick={onForward}
					/>
				</div>
			) : null}
		</header>
	);
}
