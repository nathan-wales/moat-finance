/**
 * ReconnectButton — opens Plaid Link in update mode to fix a broken connection.
 *
 * Renderer only.
 */
import type React from "react";
import { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
// Import to ensure global Window type augmentation is loaded
import "../../lib/ipc-api-client";

type Props = {
	plaidItemDbId: string;
	onSuccess?: () => void;
};

export function ReconnectButton({
	plaidItemDbId,
	onSuccess,
}: Props): React.ReactElement {
	const [linkToken, setLinkToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchReconnectToken = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await window.moatDesktop.plaid.createReconnectToken({
				itemId: plaidItemDbId,
			});
			setLinkToken(res.linkToken);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create reconnect token",
			);
			setLoading(false);
		}
	}, [plaidItemDbId]);

	const { open, ready } = usePlaidLink({
		token: linkToken ?? "",
		onSuccess: async (publicToken) => {
			setLoading(true);
			try {
				await window.moatDesktop.plaid.reconnectItem({
					itemId: plaidItemDbId,
					publicToken,
				});
				setLinkToken(null);
				onSuccess?.();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to reconnect");
			} finally {
				setLoading(false);
			}
		},
		onExit: () => {
			setLinkToken(null);
			setLoading(false);
		},
	});

	const handleClick = useCallback(async () => {
		if (linkToken && ready) {
			open();
		} else {
			await fetchReconnectToken();
		}
	}, [linkToken, ready, open, fetchReconnectToken]);

	return (
		<div>
			<button
				className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 font-medium text-white text-xs hover:bg-amber-600 disabled:opacity-50"
				disabled={loading || (!!linkToken && !ready)}
				onClick={handleClick}
				type="button"
			>
				{loading ? "Reconnecting…" : "Reconnect"}
			</button>
			{error && <p className="mt-1 text-red-500 text-xs">{error}</p>}
		</div>
	);
}
