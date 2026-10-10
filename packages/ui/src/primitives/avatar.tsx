import { Avatar as AvatarPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "../cn";

function Avatar({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
	size?: "default" | "sm" | "lg";
}) {
	return (
		<AvatarPrimitive.Root
			className={cn(
				"group/avatar relative flex size-8 shrink-0 select-none overflow-hidden rounded-full data-[size=lg]:size-10 data-[size=sm]:size-6",
				className,
			)}
			data-size={size}
			data-slot="avatar"
			{...props}
		/>
	);
}

function AvatarImage({
	className,
	referrerPolicy = "no-referrer",
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
	return (
		<AvatarPrimitive.Image
			className={cn("aspect-square size-full", className)}
			data-slot="avatar-image"
			referrerPolicy={referrerPolicy}
			{...props}
		/>
	);
}

function AvatarFallback({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
	return (
		<AvatarPrimitive.Fallback
			className={cn(
				"flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground text-sm group-data-[size=sm]/avatar:text-xs",
				className,
			)}
			data-slot="avatar-fallback"
			{...props}
		/>
	);
}

export { Avatar, AvatarFallback, AvatarImage };
