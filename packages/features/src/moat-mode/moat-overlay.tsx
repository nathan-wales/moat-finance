"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import { startMoatEngine } from "./moat-engine";
import { useMoatMode } from "./moat-mode-context";

const overlayStyle: React.CSSProperties = {
	position: "fixed",
	inset: 0,
	width: "100%",
	height: "100%",
	pointerEvents: "none",
	zIndex: 9999,
};

export function MoatOverlay(): React.ReactElement | null {
	const { isMoatActive } = useMoatMode();
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!isMoatActive || !canvas) return;
		const engine = startMoatEngine(canvas);
		return () => engine.stop();
	}, [isMoatActive]);

	if (!isMoatActive) return null;

	return <canvas aria-hidden ref={canvasRef} style={overlayStyle} />;
}
