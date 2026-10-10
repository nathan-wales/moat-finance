"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { trackMoatAi } from "~/lib/agent-analytics";

type MoatAiPanelContextValue = {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
};

const MoatAiPanelContext = createContext<MoatAiPanelContextValue | null>(null);

export function MoatAiPanelProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);

	const open = useCallback(() => {
		setIsOpen((current) => {
			if (!current) trackMoatAi("moat_finance_ai_panel_opened");
			return true;
		});
	}, []);

	const close = useCallback(() => {
		setIsOpen((current) => {
			if (current) trackMoatAi("moat_finance_ai_panel_closed");
			return false;
		});
	}, []);

	const toggle = useCallback(() => {
		setIsOpen((current) => {
			trackMoatAi(
				current
					? "moat_finance_ai_panel_closed"
					: "moat_finance_ai_panel_opened",
			);
			return !current;
		});
	}, []);

	return (
		<MoatAiPanelContext.Provider value={{ isOpen, open, close, toggle }}>
			{children}
		</MoatAiPanelContext.Provider>
	);
}

export function useMoatAiPanel(): MoatAiPanelContextValue {
	const ctx = useContext(MoatAiPanelContext);
	if (!ctx) {
		throw new Error("useMoatAiPanel must be used inside MoatAiPanelProvider");
	}
	return ctx;
}
