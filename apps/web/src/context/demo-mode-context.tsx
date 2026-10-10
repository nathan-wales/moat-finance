"use client";

import {
	dismissDemoNotice as dismissDemoNoticeApi,
	enterDemoMode as enterDemoModeApi,
	exitDemoMode as exitDemoModeApi,
	getDemoStatus,
	resetDemoOverlay as resetDemoOverlayApi,
} from "@moat/client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

interface DemoModeContextValue {
	isDemoMode: boolean;
	isStatusReady: boolean;
	overlayExpiresAt: Date | null;
	hasUnsavedDemoChanges: boolean;
	noticeDismissed: boolean;
	enterDemoMode: () => Promise<void>;
	exitDemoMode: () => Promise<void>;
	resetDemoOverlay: () => Promise<void>;
	dismissDemoNotice: () => Promise<void>;
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

function getCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1] ?? "") : null;
}

function setCookie(name: string, value: string, days?: number) {
	let expires = "";
	if (days) {
		const d = new Date();
		d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
		expires = `; expires=${d.toUTCString()}`;
	}
	// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not widely supported
	document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
	// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not widely supported
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
	const [isDemoMode, setIsDemoMode] = useState(() => {
		if (typeof document !== "undefined") {
			return getCookie("activeAppContext") === "demo";
		}
		return false;
	});
	const [overlayExpiresAt, setOverlayExpiresAt] = useState<Date | null>(null);
	const [hasUnsavedDemoChanges, setHasUnsavedDemoChanges] = useState(false);
	const [noticeDismissed, setNoticeDismissed] = useState(false);
	const hasProcessedQueryParam = useRef(false);

	const { data: session } = useSession();
	const queryClient = useQueryClient();

	const enterDemoModeMutation = useMutation({
		mutationFn: async () => {
			const response = await enterDemoModeApi();
			if (response.status !== 200) {
				throw new Error("Failed to enter demo mode");
			}
			return response.data.data;
		},
	});

	const exitDemoModeMutation = useMutation({
		mutationFn: async (input: { sessionKey: string }) => {
			const response = await exitDemoModeApi(input);
			if (response.status !== 200) {
				throw new Error("Failed to exit demo mode");
			}
			return response.data.data;
		},
	});

	const resetOverlayMutation = useMutation({
		mutationFn: async (input: { sessionKey: string }) => {
			const response = await resetDemoOverlayApi(input);
			if (response.status !== 200) {
				throw new Error("Failed to reset overlay");
			}
			return response.data.data;
		},
	});

	const dismissNoticeMutation = useMutation({
		mutationFn: async (input: { sessionKey: string }) => {
			const response = await dismissDemoNoticeApi(input);
			if (response.status !== 200) {
				throw new Error("Failed to dismiss notice");
			}
			return response.data.data;
		},
	});

	// Sync status on mount
	const { data: statusData, isFetched: isStatusFetched } = useQuery({
		queryKey: ["demo", "getDemoStatus"],
		queryFn: async () => {
			const response = await getDemoStatus();
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load demo status");
			}
			return response.data.data;
		},
		enabled: isDemoMode,
		refetchOnWindowFocus: false,
	});
	const status = statusData;
	const isStatusReady = !isDemoMode || isStatusFetched;

	useEffect(() => {
		if (status) {
			setIsDemoMode(status.isDemoMode);
			setOverlayExpiresAt(
				status.overlayExpiresAt ? new Date(status.overlayExpiresAt) : null,
			);
			setHasUnsavedDemoChanges(status.hasUnsavedDemoChanges);
			setNoticeDismissed(status.noticeDismissed);
		}
	}, [status]);

	const enterDemoMode = useCallback(async () => {
		const result = await enterDemoModeMutation.mutateAsync();
		setCookie("activeAppContext", "demo", 7);
		setCookie("demoOverlaySessionKey", result.sessionKey, 7);
		setOverlayExpiresAt(new Date(result.expiresAt));
		// Reload to re-render all server components with demo context
		window.location.reload();
	}, [enterDemoModeMutation]);

	const exitDemoMode = useCallback(async () => {
		const sessionKey = getCookie("demoOverlaySessionKey");
		if (sessionKey) {
			await exitDemoModeMutation.mutateAsync({ sessionKey });
		}
		deleteCookie("activeAppContext");
		deleteCookie("demoOverlaySessionKey");
		setIsDemoMode(false);
		setHasUnsavedDemoChanges(false);
		setOverlayExpiresAt(null);
		// Anonymous users go to sign-in; authenticated users reload in place
		if (!session?.user) {
			window.location.href = "/auth/signin";
		} else {
			window.location.reload();
		}
	}, [exitDemoModeMutation, session]);

	const resetDemoOverlay = useCallback(async () => {
		const sessionKey = getCookie("demoOverlaySessionKey");
		if (!sessionKey) return;
		await resetOverlayMutation.mutateAsync({ sessionKey });
		setHasUnsavedDemoChanges(false);
		void queryClient.invalidateQueries();
	}, [resetOverlayMutation, queryClient]);

	const dismissDemoNotice = useCallback(async () => {
		const sessionKey = getCookie("demoOverlaySessionKey");
		if (!sessionKey) return;
		await dismissNoticeMutation.mutateAsync({ sessionKey });
		setNoticeDismissed(true);
	}, [dismissNoticeMutation]);

	// Handle demoMode query parameter on mount
	useEffect(() => {
		if (typeof window === "undefined" || hasProcessedQueryParam.current) return;

		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.has("demoMode") && urlParams.get("demoMode") === "true") {
			hasProcessedQueryParam.current = true;

			// Clean up the URL first (remove query param)
			const cleanUrl =
				window.location.pathname +
				(window.location.hash ? window.location.hash : "");
			window.history.replaceState(null, "", cleanUrl);

			// Enter demo mode if not already in it
			if (!isDemoMode) {
				void enterDemoMode();
			}
		}
	}, [isDemoMode, enterDemoMode]);

	return (
		<DemoModeContext.Provider
			value={{
				isDemoMode,
				isStatusReady,
				overlayExpiresAt,
				hasUnsavedDemoChanges,
				noticeDismissed,
				enterDemoMode,
				exitDemoMode,
				resetDemoOverlay,
				dismissDemoNotice,
			}}
		>
			{children}
		</DemoModeContext.Provider>
	);
}

export function useDemoMode() {
	const ctx = useContext(DemoModeContext);
	if (!ctx) throw new Error("useDemoMode must be used within DemoModeProvider");
	return ctx;
}
