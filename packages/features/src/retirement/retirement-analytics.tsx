import { createContext, type ReactNode, useContext } from "react";

export type RetirementCaptureFn = (
	event: string,
	properties?: Record<string, unknown>,
) => void;

const RetirementCaptureContext = createContext<RetirementCaptureFn>(() => {});

export function RetirementCaptureProvider({
	onCapture,
	children,
}: {
	onCapture?: RetirementCaptureFn;
	children: ReactNode;
}) {
	return (
		<RetirementCaptureContext.Provider value={onCapture ?? (() => {})}>
			{children}
		</RetirementCaptureContext.Provider>
	);
}

export function useRetirementCapture(): RetirementCaptureFn {
	return useContext(RetirementCaptureContext);
}
