"use client";

import { getInstitutionLogoUrl } from "@moat/shared";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";

export type InstitutionLogoProps = {
	name: string;
	domain?: string | null;
	logoUrl?: string | null;
	size?: number;
	className?: string;
	/** When false, skips Logo.dev and shows only the local fallback. Use for offline/privacy mode. */
	externalLogosEnabled?: boolean;
};

export function InstitutionLogo({
	name,
	domain,
	logoUrl,
	size = 40,
	className,
	externalLogosEnabled = true,
}: InstitutionLogoProps) {
	const [failed, setFailed] = useState(false);

	const src = externalLogosEnabled
		? getInstitutionLogoUrl({ name, domain, logoUrl }, { size: size * 2 })
		: null;

	const showImage = src !== null && !failed;

	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted",
				className,
			)}
			style={{ width: size, height: size }}
		>
			{showImage ? (
				// biome-ignore lint/performance/noImgElement: logos come from arbitrary third-party domains
				<img
					alt={`${name} logo`}
					decoding="async"
					height={size}
					loading="lazy"
					onError={() => setFailed(true)}
					referrerPolicy="origin"
					src={src}
					style={{ width: size, height: size, objectFit: "contain" }}
					width={size}
				/>
			) : (
				<FallbackIcon name={name} size={size} />
			)}
		</div>
	);
}

function FallbackIcon({ name, size }: { name: string; size: number }) {
	const iconSize = Math.round(size * 0.5);
	const initial = name.trim().charAt(0).toUpperCase();

	if (initial) {
		return (
			<span
				aria-hidden="true"
				className="select-none font-medium text-muted-foreground"
				style={{ fontSize: Math.max(10, Math.round(size * 0.4)) }}
			>
				{initial}
			</span>
		);
	}

	return (
		<Building2
			aria-hidden="true"
			className="text-muted-foreground"
			style={{ width: iconSize, height: iconSize }}
		/>
	);
}
