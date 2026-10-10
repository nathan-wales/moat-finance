export type AccuracyFieldResult = {
	field: string;
	status: "exact" | "incorrect" | "missing" | "hallucinated";
	expected: unknown;
	actual: unknown;
};

export type AccuracyReport = {
	exact: number;
	incorrect: number;
	missing: number;
	hallucinated: number;
	fields: AccuracyFieldResult[];
};

export type AccuracyFixture = {
	parsedText: string;
	expected: Record<string, unknown>;
};

function flatten(
	value: unknown,
	prefix = "",
): Array<{ field: string; value: unknown }> {
	if (value === undefined) return [];
	if (Array.isArray(value) || (value !== null && typeof value === "object")) {
		return Object.entries(value as Record<string, unknown>).flatMap(
			([key, nested]) => flatten(nested, prefix ? `${prefix}.${key}` : key),
		);
	}
	return [{ field: prefix, value }];
}

export function compareExtractionAccuracy(input: {
	expected: Record<string, unknown>;
	actual: Record<string, unknown>;
}): AccuracyReport {
	const expectedEntries = flatten(input.expected);
	const actualEntries = flatten(input.actual);
	const actualByField = new Map(
		actualEntries.map((entry) => [entry.field, entry.value]),
	);
	const expectedByField = new Map(
		expectedEntries.map((entry) => [entry.field, entry.value]),
	);
	const fields: AccuracyFieldResult[] = [];

	for (const entry of expectedEntries) {
		if (!actualByField.has(entry.field)) {
			fields.push({
				field: entry.field,
				status: "missing",
				expected: entry.value,
				actual: undefined,
			});
			continue;
		}
		const actual = actualByField.get(entry.field);
		fields.push({
			field: entry.field,
			status: Object.is(actual, entry.value) ? "exact" : "incorrect",
			expected: entry.value,
			actual,
		});
	}

	for (const entry of actualEntries) {
		if (!expectedByField.has(entry.field)) {
			fields.push({
				field: entry.field,
				status: "hallucinated",
				expected: undefined,
				actual: entry.value,
			});
		}
	}

	return {
		exact: fields.filter((field) => field.status === "exact").length,
		incorrect: fields.filter((field) => field.status === "incorrect").length,
		missing: fields.filter((field) => field.status === "missing").length,
		hallucinated: fields.filter((field) => field.status === "hallucinated")
			.length,
		fields,
	};
}
