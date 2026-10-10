"use client";

import { useCallback, useState } from "react";
import { feedbackMessageSchema } from "../schema";
import type {
	CreateFeedbackInput,
	CreateFeedbackResponse,
	UseSubmitFeedbackOptions,
} from "../types";

type SubmitState =
	| { status: "idle" }
	| { status: "submitting" }
	| { status: "success"; feedbackId: string }
	| { status: "error"; message: string };

export function useSubmitFeedback(options: UseSubmitFeedbackOptions) {
	const { source, submitAdapter, getContext } = options;
	const [state, setState] = useState<SubmitState>({ status: "idle" });

	const submit = useCallback(
		async (message: string) => {
			const parseResult = feedbackMessageSchema.safeParse(message);
			if (!parseResult.success) {
				setState({
					status: "error",
					message: parseResult.error.errors[0]?.message ?? "Invalid message",
				});
				return;
			}

			setState({ status: "submitting" });

			try {
				const context = getContext?.() ?? {};

				const input: CreateFeedbackInput = {
					source,
					message: parseResult.data,
					...context,
				};

				const result: CreateFeedbackResponse =
					await submitAdapter.submit(input);
				setState({ status: "success", feedbackId: result.feedbackId });
			} catch (err) {
				const errorMessage =
					err instanceof Error
						? err.message
						: "Something went wrong. Please try again.";
				setState({ status: "error", message: errorMessage });
			}
		},
		[source, submitAdapter, getContext],
	);

	const reset = useCallback(() => {
		setState({ status: "idle" });
	}, []);

	return { state, submit, reset };
}
