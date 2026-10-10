import { createContext, useContext } from "react";

export type FeatureNotifications = {
	success(message: string): void;
	error(message: string): void;
	showAction(input: {
		message: string;
		actionLabel: string;
		onAction: () => void;
		durationMs?: number;
	}): void;
	dismissAll?(): void;
};

const noopNotifications: FeatureNotifications = {
	success() {},
	error() {},
	showAction() {},
};

let currentNotifications: FeatureNotifications = noopNotifications;

const NotificationContext =
	createContext<FeatureNotifications>(noopNotifications);

export function TransactionsNotificationProvider({
	notifications,
	children,
}: {
	notifications?: FeatureNotifications;
	children: React.ReactNode;
}) {
	const value = notifications ?? noopNotifications;
	currentNotifications = value;
	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
}

export function useTransactionsNotifications(): FeatureNotifications {
	return useContext(NotificationContext);
}

export function getTransactionsNotifications(): FeatureNotifications {
	return currentNotifications;
}
