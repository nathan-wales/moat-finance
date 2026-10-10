"use client";

import type React from "react";
import { useMoatMode } from "./moat-mode-context";

export const MOAT_APP_INSET_PX = 8;

export function MoatModeInset({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	const { isMoatActive } = useMoatMode();

	return (
		<div
			className="box-border h-screen overflow-hidden transition-[padding] duration-200"
			style={{ padding: isMoatActive ? MOAT_APP_INSET_PX : 0 }}
		>
			<div className="h-full min-h-0">{children}</div>
		</div>
	);
}
