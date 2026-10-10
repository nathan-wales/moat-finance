import { createContext, useContext } from "react";

export interface MoatNavigation {
	push(path: string): void;
	replace(path: string): void;
	getSearchParam(key: string): string | null;
	setSearchParam(key: string, value: string): void;
	removeSearchParam(key: string): void;
}

const NavigationContext = createContext<MoatNavigation | null>(null);

export function NavigationProvider({
	nav,
	children,
}: {
	nav: MoatNavigation;
	children: React.ReactNode;
}) {
	return (
		<NavigationContext.Provider value={nav}>
			{children}
		</NavigationContext.Provider>
	);
}

export function useMoatNavigation(): MoatNavigation {
	const nav = useContext(NavigationContext);
	if (!nav) throw new Error("useMoatNavigation must be used inside <NavigationProvider>");
	return nav;
}
