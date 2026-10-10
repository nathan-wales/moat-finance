import { useCallback, useState } from "react";

export interface NavigationEntry<TPage extends string> {
	page: TPage;
	searchParams: Record<string, string>;
}

function areSearchParamsEqual(
	left: Record<string, string>,
	right: Record<string, string>,
) {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);

	if (leftKeys.length !== rightKeys.length) return false;

	return leftKeys.every((key) => left[key] === right[key]);
}

function areEntriesEqual<TPage extends string>(
	left: NavigationEntry<TPage> | undefined,
	right: NavigationEntry<TPage>,
) {
	return (
		!!left &&
		left.page === right.page &&
		areSearchParamsEqual(left.searchParams, right.searchParams)
	);
}

export function useNavigationHistory<TPage extends string>(initialPage: TPage) {
	const [state, setState] = useState<{
		stack: NavigationEntry<TPage>[];
		index: number;
	}>({
		stack: [{ page: initialPage, searchParams: {} }],
		index: 0,
	});

	const current = state.stack[state.index] ?? {
		page: initialPage,
		searchParams: {},
	};
	const canGoBack = state.index > 0;
	const canGoForward = state.index < state.stack.length - 1;

	const push = useCallback((entry: NavigationEntry<TPage>) => {
		setState((prev) => {
			const active = prev.stack[prev.index];
			if (areEntriesEqual(active, entry)) {
				return prev;
			}

			const stack = [...prev.stack.slice(0, prev.index + 1), entry];
			return { stack, index: stack.length - 1 };
		});
	}, []);

	const replace = useCallback((entry: NavigationEntry<TPage>) => {
		setState((prev) => {
			const active = prev.stack[prev.index];
			if (areEntriesEqual(active, entry)) {
				return prev;
			}

			const stack = [...prev.stack];
			stack[prev.index] = entry;
			return { ...prev, stack };
		});
	}, []);

	const goBack = useCallback(() => {
		setState((prev) =>
			prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev,
		);
	}, []);

	const goForward = useCallback(() => {
		setState((prev) =>
			prev.index < prev.stack.length - 1
				? { ...prev, index: prev.index + 1 }
				: prev,
		);
	}, []);

	const setSearchParams = useCallback(
		(
			updater:
				| Record<string, string>
				| ((prev: Record<string, string>) => Record<string, string>),
		) => {
			setState((prev) => {
				const active = prev.stack[prev.index];
				if (!active) return prev;

				const nextParams =
					typeof updater === "function"
						? updater(active.searchParams)
						: updater;

				if (areSearchParamsEqual(active.searchParams, nextParams)) {
					return prev;
				}

				const stack = [...prev.stack];
				stack[prev.index] = {
					page: active.page,
					searchParams: nextParams,
				};
				return { ...prev, stack };
			});
		},
		[],
	);

	return {
		page: current.page,
		searchParams: current.searchParams,
		canGoBack,
		canGoForward,
		push,
		replace,
		goBack,
		goForward,
		setSearchParams,
	};
}
