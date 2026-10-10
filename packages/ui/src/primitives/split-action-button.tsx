"use client";

import type { VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import type * as React from "react";

import { cn } from "../cn";
import { Button, type buttonVariants } from "./button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./dropdown-menu";

type SplitActionButtonProps = {
	label: React.ReactNode;
	icon?: React.ReactNode;
	onPrimaryClick?: () => void;
	disabled?: boolean;
	primaryDisabled?: boolean;
	highlighted?: boolean;
	size?: VariantProps<typeof buttonVariants>["size"];
	testId?: string;
	menuAriaLabel?: string;
	menuItems: Array<{
		label: React.ReactNode;
		onSelect: () => void;
		icon?: React.ReactNode;
	}>;
};

function SplitActionButton({
	label,
	icon,
	onPrimaryClick,
	disabled = false,
	primaryDisabled = false,
	highlighted = false,
	size = "sm",
	testId,
	menuAriaLabel = "More actions",
	menuItems,
}: SplitActionButtonProps) {
	return (
		<div
			className={cn(
				"flex items-center rounded-md",
				highlighted && "animate-connect-focus ring-2 ring-primary",
			)}
		>
			<Button
				className="rounded-r-none border-primary-foreground/20 border-r"
				data-testid={testId}
				disabled={disabled || primaryDisabled}
				onClick={onPrimaryClick}
				size={size}
			>
				{icon}
				{label}
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						aria-label={menuAriaLabel}
						className="rounded-l-none px-2"
						disabled={disabled}
						size={size}
					>
						<ChevronDown className="h-3.5 w-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{menuItems.map((item) => (
						<DropdownMenuItem key={String(item.label)} onSelect={item.onSelect}>
							{item.icon}
							{item.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export { SplitActionButton };
