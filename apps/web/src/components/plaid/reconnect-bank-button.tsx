"use client";

import { createPlaidReconnectToken, reconnectPlaidItem } from "@moat/client-ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";

interface ReconnectBankButtonProps {
	/** Local PlaidItem.id (not Plaid's item_id) */
	itemId: string;
	institutionName: string;
	onSuccess?: () => void;
}

/**
 * Reconnect button for items in requiresReconnect=true state.
 *
 * Flow:
 *   1. User clicks → fetch update-mode link token via plaid.createReconnectToken
 *   2. Plaid Link opens in update/repair mode using the existing access_token
 *   3. On success → call plaid.reconnectItem to clear error state + run sync
 *   4. Invalidate queries + show success toast
 */
export function ReconnectBankButton({
	itemId,
	institutionName,
	onSuccess,
}: ReconnectBankButtonProps) {
	const [linkToken, setLinkToken] = useState<string | null>(null);

	const queryClient = useQueryClient();

	const createReconnectToken = useMutation({
		mutationFn: async (input: { itemId: string }) => {
			const response = await createPlaidReconnectToken(input);
			if (response.status !== 200) {
				throw new Error("Failed to create reconnect token");
			}
			return response.data.data;
		},
		onSuccess: (data) => {
			setLinkToken(data.link_token);
		},
		onError: (err) => {
			toast.error(
				err instanceof Error ? err.message : "Failed to initialize reconnect",
			);
		},
	});

	const reconnect = useMutation({
		mutationFn: async (input: { itemId: string }) => {
			const response = await reconnectPlaidItem(input);
			if (response.status !== 200) {
				throw new Error("Failed to reconnect");
			}
			return response.data.data;
		},
		onSuccess: () => {
			toast.success(`Reconnected ${institutionName}`);
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			void queryClient.invalidateQueries({ queryKey: ["plaid", "listItems"] });
			void queryClient.invalidateQueries({
				queryKey: ["transaction", "hasData"],
			});
			onSuccess?.();
		},
		onError: (err) => {
			toast.error(
				err instanceof Error ? err.message : "Failed to reconnect institution",
			);
		},
	});

	const { open, ready } = usePlaidLink({
		token: linkToken,
		onSuccess: () => {
			setLinkToken(null);
			reconnect.mutate({ itemId });
		},
		onExit: (err) => {
			setLinkToken(null);
			if (err) {
				toast.error(err.display_message ?? "Reconnect cancelled");
			}
		},
	});

	const handleClick = useCallback(() => {
		if (linkToken && ready) {
			open();
		} else {
			createReconnectToken.mutate({ itemId });
		}
	}, [linkToken, ready, open, createReconnectToken, itemId]);

	// Open Link automatically once we have a token and Link is ready
	if (linkToken && ready && !reconnect.isPending) {
		open();
	}

	const isLoading = createReconnectToken.isPending || reconnect.isPending;

	return (
		<Button
			disabled={isLoading}
			onClick={handleClick}
			size="sm"
			variant="destructive"
		>
			<RefreshCw className="mr-2 h-4 w-4" />
			{isLoading ? "Reconnecting..." : "Reconnect"}
		</Button>
	);
}
