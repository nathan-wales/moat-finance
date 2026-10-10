"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Textarea,
} from "@moat/ui";
import { Loader2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
	FEEDBACK_PLACEHOLDER,
	FEEDBACK_PRIVACY_TEXT,
	MAX_FEEDBACK_LENGTH,
} from "../constants";
import { useSubmitFeedback } from "../hooks/use-submit-feedback";
import type { FeedbackSubmitAdapter, UseSubmitFeedbackOptions } from "../types";

type FeedbackDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	source: UseSubmitFeedbackOptions["source"];
	submitAdapter: FeedbackSubmitAdapter;
	getContext?: UseSubmitFeedbackOptions["getContext"];
	initialMessage?: string;
};

export function FeedbackDialog({
	open,
	onOpenChange,
	source,
	submitAdapter,
	getContext,
	initialMessage,
}: FeedbackDialogProps): React.ReactElement {
	const [message, setMessage] = useState("");

	const { state, submit, reset } = useSubmitFeedback({
		source,
		submitAdapter,
		getContext,
	});

	useEffect(() => {
		if (!open) {
			setMessage("");
			reset();
			return;
		}

		if (initialMessage !== undefined) {
			setMessage(initialMessage);
		}
	}, [open, initialMessage, reset]);

	const handleSubmit = useCallback(async () => {
		await submit(message);
	}, [submit, message]);

	const isSubmitting = state.status === "submitting";
	const isSuccess = state.status === "success";
	const isDisabled = isSubmitting || isSuccess || message.trim().length === 0;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>What happened?</DialogTitle>
				</DialogHeader>

				{isSuccess ? (
					<div className="flex flex-col items-center gap-3 py-6 text-center">
						<p className="font-medium text-base">Thanks for your feedback!</p>
						<p className="text-muted-foreground text-sm">
							We appreciate you taking the time to help us improve Moat Finance.
						</p>
						<Button
							className="mt-2"
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Close
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<div className="relative">
							<Textarea
								className="min-h-[120px]! pr-16"
								disabled={isSubmitting}
								maxLength={MAX_FEEDBACK_LENGTH}
								onChange={(e) => setMessage(e.target.value)}
								placeholder={FEEDBACK_PLACEHOLDER}
								value={message}
							/>
							<span className="absolute right-3 bottom-3 pt-1 text-muted-foreground text-xs tabular-nums">
								{message.length} / {MAX_FEEDBACK_LENGTH}
							</span>
						</div>

						<p className="pt-2 text-muted-foreground text-xs leading-relaxed">
							{FEEDBACK_PRIVACY_TEXT}
						</p>

						{state.status === "error" && (
							<p className="text-destructive text-sm">{state.message}</p>
						)}

						<div className="flex justify-end">
							<Button
								disabled={isDisabled}
								onClick={handleSubmit}
								type="button"
							>
								{isSubmitting ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Sending…
									</>
								) : (
									"Send"
								)}
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
