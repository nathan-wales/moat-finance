"use client";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	TriangleAlertIcon,
	XIcon,
} from "lucide-react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "../cn";
import "./sonner.css";

type ToasterCssVars = React.CSSProperties & Record<`--${string}`, string>;

const toasterStyle: ToasterCssVars = {
	"--normal-bg": "var(--popover)",
	"--normal-text": "var(--popover-foreground)",
	"--normal-border": "var(--border)",
	"--success-bg": "var(--popover)",
	"--success-text": "var(--popover-foreground)",
	"--success-border": "var(--border)",
	"--info-bg": "var(--popover)",
	"--info-text": "var(--popover-foreground)",
	"--info-border": "var(--border)",
	"--warning-bg": "var(--popover)",
	"--warning-text": "var(--popover-foreground)",
	"--warning-border": "var(--border)",
	"--error-bg": "color-mix(in oklab, var(--destructive) 15%, var(--popover))",
	"--error-text": "var(--destructive)",
	"--error-border":
		"color-mix(in oklab, var(--destructive) 30%, var(--popover))",
	"--border-radius": "var(--radius)",
};

const toasterIcons = {
	success: <CircleCheckIcon className="size-4" />,
	info: <InfoIcon className="size-4" />,
	warning: <TriangleAlertIcon className="size-4" />,
	error: <XIcon className="size-4" />,
	loading: <Loader2Icon className="size-4 animate-spin" />,
} satisfies ToasterProps["icons"];

function Toaster({ className, icons, style, ...props }: ToasterProps) {
	return (
		<Sonner
			closeButton
			{...props}
			className={cn("toaster group", className)}
			icons={{ ...toasterIcons, ...icons }}
			style={{ ...toasterStyle, ...style }}
		/>
	);
}

export { Toaster, type ToasterProps };
