import { useEffect, useRef } from "react";
import {
	type PlaidLinkError,
	type PlaidLinkOnExitMetadata,
	type PlaidLinkOnSuccessMetadata,
	usePlaidLink,
} from "react-plaid-link";

type PlaidLinkSessionProps = {
	token: string;
	onSuccess: (
		publicToken: string,
		metadata: PlaidLinkOnSuccessMetadata,
	) => void;
	onExit: (
		error: PlaidLinkError | null,
		metadata: PlaidLinkOnExitMetadata,
	) => void;
};

/**
 * One Plaid Link instance per token. `usePlaidLink` keeps a destroyed handler
 * after the token is cleared, so a second connect must remount rather than
 * reuse the same hook.
 */
export function PlaidLinkSession({
	token,
	onSuccess,
	onExit,
}: PlaidLinkSessionProps): null {
	const onSuccessRef = useRef(onSuccess);
	onSuccessRef.current = onSuccess;
	const onExitRef = useRef(onExit);
	onExitRef.current = onExit;
	const openedRef = useRef(false);

	const { open, ready } = usePlaidLink({
		token,
		onSuccess: (publicToken, metadata) => {
			onSuccessRef.current(publicToken, metadata);
		},
		onExit: (error, metadata) => {
			onExitRef.current(error, metadata);
		},
	});

	useEffect(() => {
		if (!ready || openedRef.current) return;
		openedRef.current = true;
		open();
	}, [open, ready]);

	return null;
}
