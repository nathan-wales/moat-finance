import { type W2Form, W2FormSchema } from "@moat/contracts";
import {
	IdentifierValidationError,
	remainingSentinelTokens,
	restoreIdentifierTokens,
} from "./restore";
import {
	type IdentifierTokenMap,
	isSentinelToken,
	looksLikeRawEin,
	looksLikeRawSsn,
} from "./tokenize";

export class SchemaValidationError extends Error {
	readonly code = "SCHEMA_VALIDATION_FAILED" as const;
	constructor(message: string) {
		super(message);
		this.name = "SchemaValidationError";
	}
}

const NULLABLE_NUMBER_KEYS = [
	"wages",
	"federalWithholding",
	"socialSecurityWages",
	"socialSecurityTax",
	"medicareWages",
	"medicareTax",
	"stateWages",
	"stateTax",
	"localWages",
	"localTax",
	"dependentCareBenefits",
] as const;

function stripNulls(value: unknown): unknown {
	if (value === null) return undefined;
	if (Array.isArray(value)) {
		return value.map(stripNulls);
	}
	if (value && typeof value === "object") {
		const next: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value)) {
			const stripped = stripNulls(nested);
			if (stripped !== undefined) next[key] = stripped;
		}
		return next;
	}
	return value;
}

function assertFiniteMoney(form: W2Form): void {
	for (const key of NULLABLE_NUMBER_KEYS) {
		const amount = form[key];
		if (amount === undefined) continue;
		if (!Number.isFinite(amount) || amount < 0) {
			throw new SchemaValidationError(`Invalid numeric value for ${key}`);
		}
	}
	for (const entry of form.box12 ?? []) {
		if (entry.amount !== undefined && !Number.isFinite(entry.amount)) {
			throw new SchemaValidationError("Invalid numeric value for box12");
		}
	}
	for (const entry of form.box14 ?? []) {
		if (entry.amount !== undefined && !Number.isFinite(entry.amount)) {
			throw new SchemaValidationError("Invalid numeric value for box14");
		}
	}
}

function assertIdentifierFields(
	form: W2Form,
	tokenMap: IdentifierTokenMap,
	stage: "before-restore" | "after-restore",
): void {
	if (form.employeeSsn) {
		if (stage === "before-restore") {
			if (!isSentinelToken(form.employeeSsn)) {
				throw new IdentifierValidationError(
					"employeeSsn must be a sentinel token",
				);
			}
			if (!tokenMap[form.employeeSsn]) {
				throw new IdentifierValidationError("employeeSsn token is unknown");
			}
		} else if (
			!Object.values(tokenMap).includes(form.employeeSsn) ||
			isSentinelToken(form.employeeSsn)
		) {
			throw new IdentifierValidationError("employeeSsn does not match source");
		}
	}
	if (form.employerEin) {
		if (stage === "before-restore") {
			if (!isSentinelToken(form.employerEin)) {
				throw new IdentifierValidationError(
					"employerEin must be a sentinel token",
				);
			}
			if (!tokenMap[form.employerEin]) {
				throw new IdentifierValidationError("employerEin token is unknown");
			}
		} else if (
			!Object.values(tokenMap).includes(form.employerEin) ||
			isSentinelToken(form.employerEin)
		) {
			throw new IdentifierValidationError("employerEin does not match source");
		}
	}
}

export function parseLlmW2Output(input: unknown): W2Form {
	const stripped = stripNulls(input);
	const parsed = W2FormSchema.safeParse(stripped);
	if (!parsed.success) {
		throw new SchemaValidationError("Model output did not match W-2 schema");
	}
	return parsed.data;
}

export function validateAndRestoreW2(input: {
	raw: unknown;
	tokenMap: IdentifierTokenMap;
}): W2Form {
	const before = parseLlmW2Output(input.raw);
	assertIdentifierFields(before, input.tokenMap, "before-restore");
	if (before.employeeSsn && looksLikeRawSsn(before.employeeSsn)) {
		throw new IdentifierValidationError("Model returned a raw SSN");
	}
	if (before.employerEin && looksLikeRawEin(before.employerEin)) {
		throw new IdentifierValidationError("Model returned a raw EIN");
	}
	const restored = restoreIdentifierTokens(before, input.tokenMap);
	const leftover = remainingSentinelTokens(restored);
	if (leftover.length > 0) {
		throw new IdentifierValidationError("Unresolved identifier tokens remain");
	}
	assertIdentifierFields(restored, input.tokenMap, "after-restore");
	assertFiniteMoney(restored);
	return restored;
}
