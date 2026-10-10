"use client";

import { XIcon } from "lucide-react";
import { Dialog as SidePanelPrimitive } from "radix-ui";
import type * as React from "react";
import { createContext, useContext } from "react";
import { cn } from "../cn";
import { Button } from "./button";
import { DiscardDraftConfirm } from "./discard-draft-confirm";
import {
	PrimaryActionFooter,
	PrimaryActionScope,
} from "./primary-action-react";
import {
	type DiscardDraftGuard,
	useDiscardDraftGuard,
} from "./use-discard-draft-guard";

const sidePanelSizeClasses = {
	sm: "sm:w-[360px]",
	md: "sm:w-[480px]",
	lg: "sm:w-[560px]",
	xl: "sm:w-[640px]",
} as const;

type SidePanelSize = keyof typeof sidePanelSizeClasses;

const DiscardDraftContext = createContext<DiscardDraftGuard | null>(null);

function SidePanel({
	confirmDiscardOnClose = false,
	onOpenChange,
	open,
	children,
	...props
}: React.ComponentProps<typeof SidePanelPrimitive.Root> & {
	confirmDiscardOnClose?: boolean;
}) {
	const guard = useDiscardDraftGuard({
		isDirty: confirmDiscardOnClose,
		onOpenChange,
		open: open === true,
	});
	const useGuard = confirmDiscardOnClose || guard.discardConfirmOpen;

	return (
		<DiscardDraftContext.Provider value={useGuard ? guard : null}>
			<SidePanelPrimitive.Root
				data-slot="side-panel"
				{...props}
				onOpenChange={useGuard ? guard.handlePanelOpenChange : onOpenChange}
				open={open}
			>
				{children}
			</SidePanelPrimitive.Root>
			{useGuard ? (
				<DiscardDraftConfirm
					onDiscard={guard.handleDiscardDraft}
					onOpenChange={guard.setDiscardConfirmOpen}
					open={guard.discardConfirmOpen}
				/>
			) : null}
		</DiscardDraftContext.Provider>
	);
}

function SidePanelTrigger({
	...props
}: React.ComponentProps<typeof SidePanelPrimitive.Trigger>) {
	return (
		<SidePanelPrimitive.Trigger data-slot="side-panel-trigger" {...props} />
	);
}

function SidePanelClose({
	...props
}: React.ComponentProps<typeof SidePanelPrimitive.Close>) {
	return <SidePanelPrimitive.Close data-slot="side-panel-close" {...props} />;
}

function SidePanelPortal({
	...props
}: React.ComponentProps<typeof SidePanelPrimitive.Portal>) {
	return <SidePanelPrimitive.Portal data-slot="side-panel-portal" {...props} />;
}

function SidePanelOverlay({
	className,
	...props
}: React.ComponentProps<typeof SidePanelPrimitive.Overlay>) {
	return (
		<SidePanelPrimitive.Overlay
			className={cn(
				"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			data-slot="side-panel-overlay"
			{...props}
		/>
	);
}

function SidePanelContent({
	className,
	children,
	size = "md",
	onEscapeKeyDown,
	onInteractOutside,
	onPointerDownOutside,
	...props
}: React.ComponentProps<typeof SidePanelPrimitive.Content> & {
	size?: SidePanelSize;
}) {
	const guard = useContext(DiscardDraftContext);

	return (
		<SidePanelPortal>
			<SidePanelOverlay />
			<SidePanelPrimitive.Content
				{...props}
				className={cn(
					"data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed top-[5px] right-[5px] bottom-[5px] z-50 flex w-[calc(100vw-10px)] flex-col overflow-hidden rounded-xl border bg-background shadow-lg outline-none transition ease-in-out data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-500",
					sidePanelSizeClasses[size],
					className,
				)}
				data-slot="side-panel-content"
				onEscapeKeyDown={(event) => {
					guard?.onEscapeKeyDown(event);
					onEscapeKeyDown?.(event);
				}}
				onInteractOutside={(event) => {
					guard?.onOutsideDismiss(event);
					onInteractOutside?.(event);
				}}
				onPointerDownOutside={(event) => {
					guard?.onOutsideDismiss(event);
					onPointerDownOutside?.(event);
				}}
			>
				<PrimaryActionScope>{children}</PrimaryActionScope>
			</SidePanelPrimitive.Content>
		</SidePanelPortal>
	);
}

function SidePanelHeader({
	actions,
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<"div"> & {
	actions?: React.ReactNode;
	showCloseButton?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center gap-2 border-b px-6 pt-5 pb-4",
				className,
			)}
			data-slot="side-panel-header"
			{...props}
		>
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>
			{actions}
			{showCloseButton ? (
				<SidePanelPrimitive.Close asChild>
					<Button size="icon-sm" variant="ghost">
						<XIcon className="size-5" />
						<span className="sr-only">Close</span>
					</Button>
				</SidePanelPrimitive.Close>
			) : null}
		</div>
	);
}

function SidePanelBody({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"min-h-0 flex-1 content-start overflow-y-auto px-6 pt-5 pb-4",
				className,
			)}
			data-slot="side-panel-body"
			{...props}
		/>
	);
}

function SidePanelFooter({
	className,
	children,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4",
				className,
			)}
			data-slot="side-panel-footer"
			{...props}
		>
			<PrimaryActionFooter>{children}</PrimaryActionFooter>
		</div>
	);
}

function SidePanelTitle({
	className,
	...props
}: React.ComponentProps<typeof SidePanelPrimitive.Title>) {
	return (
		<SidePanelPrimitive.Title
			className={cn(
				"font-semibold text-foreground text-lg leading-none",
				className,
			)}
			data-slot="side-panel-title"
			{...props}
		/>
	);
}

function SidePanelDescription({
	className,
	...props
}: React.ComponentProps<typeof SidePanelPrimitive.Description>) {
	return (
		<SidePanelPrimitive.Description
			className={cn("text-muted-foreground text-sm", className)}
			data-slot="side-panel-description"
			{...props}
		/>
	);
}

export {
	SidePanel,
	SidePanelBody,
	SidePanelClose,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	SidePanelTrigger,
};
