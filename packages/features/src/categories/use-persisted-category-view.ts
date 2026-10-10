import type { CategoryViewMode } from "@moat/contracts";
import { useCallback, useState } from "react";
import { isCategoryViewMode } from "./category-parent";

function readStoredView(storageKey: string): CategoryViewMode {
	if (typeof window === "undefined") return "category";
	try {
		const stored = window.localStorage.getItem(storageKey);
		return isCategoryViewMode(stored) ? stored : "category";
	} catch {
		return "category";
	}
}

export function usePersistedCategoryView(
	storageKey: string,
): [CategoryViewMode, (value: CategoryViewMode) => void] {
	const [value, setValue] = useState<CategoryViewMode>(() =>
		readStoredView(storageKey),
	);

	const update = useCallback(
		(next: CategoryViewMode) => {
			setValue(next);
			try {
				window.localStorage.setItem(storageKey, next);
			} catch {
				// quota / private mode — in-memory toggle still works
			}
		},
		[storageKey],
	);

	return [value, update];
}
