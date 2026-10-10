import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function ConfirmCancelSyncModal({
	open,
	retailerName,
	onCancelSync,
	onKeepSyncing,
}: {
	open: boolean;
	retailerName: string;
	onCancelSync: () => void;
	onKeepSyncing: () => void;
}) {
	const keepSyncingRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		keepSyncingRef.current?.focus();

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				onKeepSyncing();
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open, onKeepSyncing]);

	if (!open) return null;

	return createPortal(
		<div className="modal-overlay">
			<button
				aria-label="Keep syncing"
				className="modal-backdrop"
				onClick={onKeepSyncing}
				type="button"
			/>
			<div
				aria-describedby="cancel-sync-description"
				aria-labelledby="cancel-sync-title"
				aria-modal="true"
				className="modal-dialog"
				role="dialog"
			>
				<div className="modal-copy">
					<h2 id="cancel-sync-title">Cancel {retailerName} sync?</h2>
					<p id="cancel-sync-description">
						This stops the import in progress. You can start a new sync anytime.
					</p>
				</div>
				<div className="modal-actions">
					<button
						className="button button-outline"
						onClick={onKeepSyncing}
						ref={keepSyncingRef}
						type="button"
					>
						Keep syncing
					</button>
					<button
						className="button button-default"
						onClick={onCancelSync}
						type="button"
					>
						Cancel sync
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
