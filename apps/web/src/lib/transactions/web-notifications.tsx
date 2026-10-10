"use client";

import type { FeatureNotifications } from "@moat/features/transactions";
import { Button } from "@moat/ui";
import { toast } from "sonner";

export const webNotifications: FeatureNotifications = {
	success(message) {
		toast.success(message);
	},
	error(message) {
		toast.error(message);
	},
	showAction({ message, actionLabel, onAction, durationMs }) {
		toast(
			<div className="flex w-full items-center justify-between gap-3">
				<span className="text-sm">{message}</span>
				<Button
					autoFocus
					onClick={() => {
						toast.dismiss();
						onAction();
					}}
					size="sm"
				>
					{actionLabel} ⏎
				</Button>
			</div>,
			{ dismissible: true, duration: durationMs },
		);
	},
	dismissAll() {
		toast.dismiss();
	},
};
