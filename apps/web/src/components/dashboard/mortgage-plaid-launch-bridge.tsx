"use client";

import {
	createPlaidLinkToken,
	type ExchangePublicTokenAccount,
	exchangePlaidPublicToken,
} from "@moat/client-ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { usePlaidLink } from "react-plaid-link";
import { toast } from "sonner";

export const PLAID_INSTITUTIONS_QUERY_KEY = [
	"plaid",
	"getConnectedInstitutions",
] as const;

export type MortgageLinkedAccount = {
	id: string;
	name: string;
	mask?: string | null;
	balance: number;
	institutionName: string;
	type: string;
	subtype?: string | null;
};

type ConnectCallbacks = {
	onLinked: (account: MortgageLinkedAccount) => void;
};

type MortgagePlaidLaunchContextValue = {
	awaitingConfirmation: boolean;
	isActive: boolean;
	isConnecting: boolean;
	isFinalizing: boolean;
	pendingReopenPicker: boolean;
	requestConnect: (callbacks: ConnectCallbacks) => void;
	confirmConnect: () => void;
	cancelConnect: () => void;
	clearPendingReopenPicker: () => void;
};

const MortgagePlaidLaunchContext =
	createContext<MortgagePlaidLaunchContextValue | null>(null);

function isMortgageEligibleAccount(account: {
	type: string;
	subtype?: string | null;
}) {
	return account.type === "loan" || account.type === "credit";
}

function toLinkedAccount(
	account: ExchangePublicTokenAccount,
): MortgageLinkedAccount {
	return {
		id: account.id,
		name: account.name,
		mask: account.mask,
		balance: account.currentBalance ?? 0,
		institutionName: account.institutionName,
		type: account.type,
		subtype: account.subtype,
	};
}

export function MortgagePlaidLaunchProvider({
	children,
}: {
	children: ReactNode;
}) {
	const queryClient = useQueryClient();
	const [linkToken, setLinkToken] = useState<string | null>(null);
	const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
	const [isActive, setIsActive] = useState(false);
	const [pendingReopenPicker, setPendingReopenPicker] = useState(false);
	const callbacksRef = useRef<ConnectCallbacks | null>(null);
	const plaidSuccessReceivedRef = useRef(false);

	const createLinkToken = useMutation({
		mutationFn: async () => {
			const response = await createPlaidLinkToken();
			if (response.status !== 200) {
				throw new Error("Failed to create link token");
			}
			return response.data.data;
		},
		onSuccess: (data) => setLinkToken(data.link_token),
		onError: () => {
			setAwaitingConfirmation(false);
			setIsActive(false);
			callbacksRef.current = null;
			toast.error("Failed to initialize bank connection");
		},
	});

	const exchangeToken = useMutation({
		mutationFn: async (input: { publicToken: string }) => {
			const response = await exchangePlaidPublicToken(input);
			if (response.status !== 200) throw new Error("Failed to exchange token");
			return response.data.data;
		},
		onSuccess: (data) => {
			void queryClient.invalidateQueries({
				queryKey: PLAID_INSTITUTIONS_QUERY_KEY,
			});

			const callbacks = callbacksRef.current;
			const eligibleAccounts = data.accounts.filter(isMortgageEligibleAccount);

			if (eligibleAccounts.length === 1) {
				const account = eligibleAccounts[0];
				if (account && callbacks) {
					callbacks.onLinked(toLinkedAccount(account));
					toast.success("Mortgage account linked");
				}
			} else {
				setPendingReopenPicker(true);
				const message =
					eligibleAccounts.length > 1
						? "Account connected! Select your mortgage account below."
						: "Account connected! Select an account below to link.";
				toast.success(message);
			}

			setIsActive(false);
			plaidSuccessReceivedRef.current = false;
			callbacksRef.current = null;
		},
		onError: () => {
			setAwaitingConfirmation(false);
			setIsActive(false);
			plaidSuccessReceivedRef.current = false;
			callbacksRef.current = null;
			toast.error("Failed to connect account");
		},
	});

	const { open, ready } = usePlaidLink({
		token: linkToken,
		onSuccess: (publicToken) => {
			plaidSuccessReceivedRef.current = true;
			setLinkToken(null);
			setIsActive(false);
			exchangeToken.mutate({ publicToken });
		},
		onExit: (error) => {
			setLinkToken(null);
			if (plaidSuccessReceivedRef.current) return;

			setAwaitingConfirmation(false);
			setIsActive(false);
			callbacksRef.current = null;
			if (error) {
				toast.error(error.display_message ?? "Bank connection cancelled");
			}
		},
	});

	useEffect(() => {
		if (linkToken && ready && !exchangeToken.isPending) {
			open();
		}
	}, [linkToken, ready, exchangeToken.isPending, open]);

	const requestConnect = useCallback((callbacks: ConnectCallbacks) => {
		callbacksRef.current = callbacks;
		setAwaitingConfirmation(true);
	}, []);

	const confirmConnect = useCallback(() => {
		setAwaitingConfirmation(false);
		setIsActive(true);

		if (linkToken && ready) {
			open();
			return;
		}

		createLinkToken.mutate();
	}, [linkToken, ready, open, createLinkToken]);

	const cancelConnect = useCallback(() => {
		setAwaitingConfirmation(false);
		callbacksRef.current = null;
	}, []);

	const clearPendingReopenPicker = useCallback(() => {
		setPendingReopenPicker(false);
	}, []);

	const isFinalizing = exchangeToken.isPending;

	const isConnecting =
		awaitingConfirmation ||
		isActive ||
		createLinkToken.isPending ||
		isFinalizing ||
		!!linkToken;

	return (
		<MortgagePlaidLaunchContext.Provider
			value={{
				awaitingConfirmation,
				isActive,
				isConnecting,
				isFinalizing,
				pendingReopenPicker,
				requestConnect,
				confirmConnect,
				cancelConnect,
				clearPendingReopenPicker,
			}}
		>
			{children}
		</MortgagePlaidLaunchContext.Provider>
	);
}

export function useMortgagePlaidLaunch() {
	const context = useContext(MortgagePlaidLaunchContext);
	if (!context) {
		throw new Error(
			"useMortgagePlaidLaunch must be used within MortgagePlaidLaunchProvider",
		);
	}
	return context;
}
