import assert from "node:assert/strict";
import type { NormalizedFinancialState } from "./types";

function jsonPath(parts: Array<string | number>): string {
	return parts
		.map((part) => (typeof part === "number" ? `[${part}]` : `.${part}`))
		.join("")
		.replace(/^\./, "");
}

function firstDiff(
	actual: unknown,
	expected: unknown,
	path: Array<string | number> = [],
): string | null {
	if (Object.is(actual, expected)) return null;
	if (
		actual === null ||
		expected === null ||
		typeof actual !== "object" ||
		typeof expected !== "object"
	) {
		return `${jsonPath(path)}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`;
	}
	if (Array.isArray(actual) || Array.isArray(expected)) {
		if (!Array.isArray(actual) || !Array.isArray(expected)) {
			return `${jsonPath(path)}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`;
		}
		if (actual.length !== expected.length) {
			return `${jsonPath(path)}.length: ${actual.length} !== ${expected.length}`;
		}
		for (let index = 0; index < actual.length; index += 1) {
			const nested = firstDiff(actual[index], expected[index], [...path, index]);
			if (nested) return nested;
		}
		return null;
	}
	const actualRecord = actual as Record<string, unknown>;
	const expectedRecord = expected as Record<string, unknown>;
	const keys = new Set([
		...Object.keys(actualRecord),
		...Object.keys(expectedRecord),
	]);
	for (const key of [...keys].sort()) {
		const nested = firstDiff(actualRecord[key], expectedRecord[key], [
			...path,
			key,
		]);
		if (nested) return nested;
	}
	return null;
}

export function firstNormalizedStateDiff(
	actual: NormalizedFinancialState,
	expected: NormalizedFinancialState,
): string | null {
	return firstDiff(actual, expected);
}

export function assertNormalizedStateEqual(
	actual: NormalizedFinancialState,
	expected: NormalizedFinancialState,
	phase: string,
): void {
	const diff = firstNormalizedStateDiff(actual, expected);
	if (!diff) return;
	try {
		assert.deepEqual(actual, expected);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${phase}: first differing field ${diff}\n${message}`);
	}
}
