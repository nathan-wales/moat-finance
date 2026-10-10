"use client";

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

const STORAGE_KEY = "moat-mode-active";

interface MoatModeContextValue {
	isMoatActive: boolean;
	toggleMoatMode: () => void;
}

const MoatModeContext = createContext<MoatModeContextValue | null>(null);

export function MoatModeProvider({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	const [isMoatActive, setIsMoatActive] = useState(false);

	useEffect(() => {
		try {
			setIsMoatActive(window.localStorage.getItem(STORAGE_KEY) === "true");
		} catch {
			// localStorage unavailable — moat stays lowered
		}
	}, []);

	const toggleMoatMode = useCallback(() => {
		setIsMoatActive((previous) => {
			const next = !previous;
			try {
				window.localStorage.setItem(STORAGE_KEY, String(next));
			} catch {
				// non-persistent toggle is still fine
			}
			return next;
		});
	}, []);

	const value = useMemo(
		() => ({ isMoatActive, toggleMoatMode }),
		[isMoatActive, toggleMoatMode],
	);

	return (
		<MoatModeContext.Provider value={value}>
			{children}
		</MoatModeContext.Provider>
	);
}

export function useMoatMode(): MoatModeContextValue {
	const context = useContext(MoatModeContext);
	if (!context) {
		throw new Error("useMoatMode must be used within a MoatModeProvider");
	}
	return context;
}
