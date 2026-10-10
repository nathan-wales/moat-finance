"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";

type CommandMenuContextValue = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function CommandMenuProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const value = useMemo(() => ({ open, setOpen }), [open]);

	return (
		<CommandMenuContext.Provider value={value}>
			{children}
		</CommandMenuContext.Provider>
	);
}

export function useCommandMenu(): CommandMenuContextValue {
	const context = useContext(CommandMenuContext);
	if (!context) {
		throw new Error("useCommandMenu must be used within CommandMenuProvider");
	}
	return context;
}
