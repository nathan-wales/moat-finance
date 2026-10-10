"use client";

import { Label as LabelPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../cn";

function Label({
	className,
	size = "sm",
	...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
	size?: "sm" | "xs" | "xxs";
}) {
	const sizeClasses = {
		sm: "text-sm",
		xs: "text-xs",
		xxs: "text-[10px]",
	};

	return (
		<LabelPrimitive.Root
			className={cn(
				"flex select-none items-center gap-2 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				sizeClasses[size],
				className,
			)}
			data-slot="label"
			{...props}
		/>
	);
}

export { Label };
