import type { DesktopUpdateStatus } from "@moat/contracts";
import { useCallback, useEffect, useState } from "react";

type UseDesktopUpdateStatusResult = {
	status: DesktopUpdateStatus | null;
	dismissed: boolean;
	isInstalling: boolean;
	installError: string | null;
	dismiss: () => void;
	install: () => Promise<void>;
};

export function useDesktopUpdateStatus(): UseDesktopUpdateStatusResult {
	const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);
	const [installError, setInstallError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		void window.moatDesktop.updates
			.getStatus()
			.then((nextStatus) => {
				if (!cancelled) setStatus(nextStatus);
			})
			.catch(() => {
				if (!cancelled) setStatus({ state: "idle" });
			});

		const unsubscribe = window.moatDesktop.updates.onStatusChanged(
			(nextStatus) => {
				setStatus(nextStatus);
				if (nextStatus.state === "ready") {
					setDismissed(false);
				}
			},
		);

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, []);

	const dismiss = useCallback(() => {
		setDismissed(true);
		setInstallError(null);
	}, []);

	const install = useCallback(async () => {
		if (isInstalling) return;

		setIsInstalling(true);
		setInstallError(null);

		try {
			await window.moatDesktop.updates.install();
		} catch {
			setInstallError("Update could not start. Try again.");
			setIsInstalling(false);
		}
	}, [isInstalling]);

	return {
		status,
		dismissed,
		isInstalling,
		installError,
		dismiss,
		install,
	};
}
