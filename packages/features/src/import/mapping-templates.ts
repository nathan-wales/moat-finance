import type { ColumnMapping, ImportMappingTemplate } from "./types";

export const IMPORT_MAPPING_TEMPLATES_KEY = "moat-import-mapping-templates";

type StorageReader = {
	getItem(key: string): string | null;
};

type StorageWriter = {
	setItem(key: string, value: string): void;
	removeItem?(key: string): void;
};

export function normalizeMapping(mapping: ColumnMapping): ColumnMapping {
	return {
		date: mapping.date,
		description: mapping.description,
		amount: mapping.amount,
		...(mapping.type ? { type: mapping.type } : {}),
		...(mapping.category ? { category: mapping.category } : {}),
		...(mapping.memo ? { memo: mapping.memo } : {}),
	};
}

export function mappingsEqual(
	left: ColumnMapping,
	right: ColumnMapping,
): boolean {
	const a = normalizeMapping(left);
	const b = normalizeMapping(right);
	return (
		a.date === b.date &&
		a.description === b.description &&
		a.amount === b.amount &&
		(a.type ?? "") === (b.type ?? "") &&
		(a.category ?? "") === (b.category ?? "") &&
		(a.memo ?? "") === (b.memo ?? "")
	);
}

export function isTemplateDirty(
	template: ImportMappingTemplate,
	mapping: ColumnMapping,
	accountId: string | null,
): boolean {
	return (
		!mappingsEqual(template.mapping, mapping) ||
		template.accountId !== accountId
	);
}

export function templateRequiredColumnsExist(
	template: ImportMappingTemplate,
	headers: string[],
): boolean {
	const headerSet = new Set(headers);
	return (
		headerSet.has(template.mapping.date) &&
		headerSet.has(template.mapping.description) &&
		headerSet.has(template.mapping.amount)
	);
}

export function applyTemplateMapping(
	template: ImportMappingTemplate,
	headers: string[],
): ColumnMapping {
	const headerSet = new Set(headers);
	function pick(column: string | undefined): string | undefined {
		if (column && headerSet.has(column)) return column;
		return undefined;
	}

	return normalizeMapping({
		date: pick(template.mapping.date) ?? "",
		description: pick(template.mapping.description) ?? "",
		amount: pick(template.mapping.amount) ?? "",
		type: pick(template.mapping.type),
		category: pick(template.mapping.category),
		memo: pick(template.mapping.memo),
	});
}

export function resolveTemplateAccountId(
	accountId: string | null,
	knownAccountIds: ReadonlySet<string>,
): string | null {
	if (!accountId) return null;
	return knownAccountIds.has(accountId) ? accountId : null;
}

export function mappingFromUpload(args: {
	headers: string[];
	templates: ImportMappingTemplate[];
	knownAccountIds: ReadonlySet<string>;
	fallbackMapping: ColumnMapping;
}): {
	mapping: ColumnMapping;
	accountId: string | null;
	templateId: string | null;
} {
	const defaultTemplate = args.templates.find((template) => template.isDefault);
	if (
		defaultTemplate &&
		templateRequiredColumnsExist(defaultTemplate, args.headers)
	) {
		return {
			mapping: applyTemplateMapping(defaultTemplate, args.headers),
			accountId: resolveTemplateAccountId(
				defaultTemplate.accountId,
				args.knownAccountIds,
			),
			templateId: defaultTemplate.id,
		};
	}

	return {
		mapping: args.fallbackMapping,
		accountId: null,
		templateId: null,
	};
}

export function createMappingTemplate(input: {
	name: string;
	mapping: ColumnMapping;
	accountId: string | null;
	isDefault: boolean;
	id?: string;
}): ImportMappingTemplate {
	return {
		id: input.id ?? crypto.randomUUID(),
		name: input.name.trim(),
		isDefault: input.isDefault,
		mapping: normalizeMapping(input.mapping),
		accountId: input.accountId,
	};
}

export function addMappingTemplate(
	templates: ImportMappingTemplate[],
	template: ImportMappingTemplate,
): ImportMappingTemplate[] {
	const cleared = template.isDefault
		? templates.map((row) => ({ ...row, isDefault: false }))
		: templates;
	return [...cleared, template];
}

export function updateMappingTemplate(
	templates: ImportMappingTemplate[],
	id: string,
	patch: Partial<
		Pick<ImportMappingTemplate, "mapping" | "accountId" | "name" | "isDefault">
	>,
): ImportMappingTemplate[] {
	const nextPatch = {
		...patch,
		...(patch.mapping ? { mapping: normalizeMapping(patch.mapping) } : {}),
		...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
	};
	const withDefaultCleared = nextPatch.isDefault
		? templates.map((row) =>
				row.id === id ? row : { ...row, isDefault: false },
			)
		: templates;
	return withDefaultCleared.map((row) =>
		row.id === id ? { ...row, ...nextPatch } : row,
	);
}

function isColumnMapping(value: unknown): value is ColumnMapping {
	if (!value || typeof value !== "object") return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.date === "string" &&
		typeof row.description === "string" &&
		typeof row.amount === "string" &&
		(row.type === undefined || typeof row.type === "string") &&
		(row.category === undefined || typeof row.category === "string") &&
		(row.memo === undefined || typeof row.memo === "string")
	);
}

function isImportMappingTemplate(
	value: unknown,
): value is ImportMappingTemplate {
	if (!value || typeof value !== "object") return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.id === "string" &&
		typeof row.name === "string" &&
		typeof row.isDefault === "boolean" &&
		(row.accountId === null || typeof row.accountId === "string") &&
		isColumnMapping(row.mapping)
	);
}

export function loadMappingTemplates(
	storage: StorageReader | null = browserStorage(),
): ImportMappingTemplate[] {
	if (!storage) return [];
	try {
		const raw = storage.getItem(IMPORT_MAPPING_TEMPLATES_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isImportMappingTemplate).map((template) => ({
			...template,
			name: template.name.trim(),
			mapping: normalizeMapping(template.mapping),
		}));
	} catch {
		return [];
	}
}

export function persistMappingTemplates(
	templates: ImportMappingTemplate[],
	storage: StorageWriter | null = browserStorage(),
): void {
	if (!storage) return;
	try {
		if (templates.length === 0) {
			if (storage.removeItem) {
				storage.removeItem(IMPORT_MAPPING_TEMPLATES_KEY);
				return;
			}
			storage.setItem(IMPORT_MAPPING_TEMPLATES_KEY, "[]");
			return;
		}
		storage.setItem(IMPORT_MAPPING_TEMPLATES_KEY, JSON.stringify(templates));
	} catch {
		// quota / private mode — in-memory templates still work
	}
}

function browserStorage(): Storage | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}
