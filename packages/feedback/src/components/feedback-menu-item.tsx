"use client";

import { MessageSquarePlus } from "lucide-react";
import type React from "react";

type FeedbackMenuItemProps = {
	onClick: () => void;
	className?: string;
};

export function FeedbackMenuItem({
	onClick,
	className,
}: FeedbackMenuItemProps): React.ReactElement {
	return (
		<button
			className={className}
			onClick={onClick}
			type="button"
		>
			<MessageSquarePlus className="h-4 w-4" />
			Give feedback
		</button>
	);
}
