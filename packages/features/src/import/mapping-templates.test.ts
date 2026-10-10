import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IMPORT_UNCATEGORIZED_WARNING } from "@moat/contracts";
import {
	addMappingTemplate,
	applyTemplateMapping,
	createMappingTemplate,
	isTemplateDirty,
	loadMappingTemplates,
	mappingFromUpload,
	mappingsEqual,
	persistMappingTemplates,
	resolveTemplateAccountId,
	templateRequiredColumnsExist,
	updateMappingTemplate,
} from "./mapping-templates";
import type { ColumnMapping, ImportMappingTemplate } from "./types";

function chaseTemplate(
	overrides: Partial<ImportMappingTemplate> = {},
): ImportMappingTemplate {
	return createMappingTemplate({
		id: "tpl-chase",
		name: "Chase CSV",
		isDefault: false,
		accountId: "acct-1",
		mapping: {
			date: "Timestamp",
			description: "Title",
			amount: "Amount",
			type: "Kind",
			category: "Bucket",
		},
		...overrides,
	});
}

describe("mapping templates", () => {
	it("treats missing optional columns as equal", () => {
		assert.equal(
			mappingsEqual(
				{ date: "Date", description: "Memo", amount: "Amount" },
				{
					date: "Date",
					description: "Memo",
					amount: "Amount",
					type: "",
					category: undefined,
				},
			),
			true,
		);
	});

	it("preserves an optional memo column through template apply", () => {
		const applied = applyTemplateMapping(
			chaseTemplate({
				mapping: {
					date: "Timestamp",
					description: "Title",
					amount: "Amount",
					memo: "Notes",
				},
			}),
			["Timestamp", "Title", "Amount", "Notes"],
		);
		assert.deepEqual(applied, {
			date: "Timestamp",
			description: "Title",
			amount: "Amount",
			memo: "Notes",
		});
	});

	it("applies only columns that exist on the current CSV", () => {
		const applied = applyTemplateMapping(chaseTemplate(), [
			"Timestamp",
			"Title",
			"Amount",
			"Notes",
		]);
		assert.deepEqual(applied, {
			date: "Timestamp",
			description: "Title",
			amount: "Amount",
		});
	});

	it("requires date, description, and amount headers before auto-applying", () => {
		const template = chaseTemplate({ isDefault: true });
		assert.equal(
			templateRequiredColumnsExist(template, ["Timestamp", "Title", "Amount"]),
			true,
		);
		assert.equal(
			templateRequiredColumnsExist(template, ["Timestamp", "Amount"]),
			false,
		);
	});

	it("uses the default template on upload when headers match", () => {
		const result = mappingFromUpload({
			headers: ["Timestamp", "Title", "Amount", "Kind"],
			templates: [chaseTemplate({ isDefault: true })],
			knownAccountIds: new Set(["acct-1"]),
			fallbackMapping: {
				date: "Timestamp",
				description: "Title",
				amount: "Amount",
			},
		});
		assert.equal(result.templateId, "tpl-chase");
		assert.equal(result.accountId, "acct-1");
		assert.deepEqual(result.mapping, {
			date: "Timestamp",
			description: "Title",
			amount: "Amount",
			type: "Kind",
		});
	});

	it("falls back to auto-map when the default template does not match", () => {
		const fallbackMapping = {
			date: "",
			description: "Payee",
			amount: "Sum",
		};
		const result = mappingFromUpload({
			headers: ["Posted", "Payee", "Sum"],
			templates: [chaseTemplate({ isDefault: true })],
			knownAccountIds: new Set(["acct-1"]),
			fallbackMapping,
		});
		assert.equal(result.templateId, null);
		assert.equal(result.accountId, null);
		assert.deepEqual(result.mapping, fallbackMapping);
	});

	it("drops a template account that is no longer available", () => {
		assert.equal(
			resolveTemplateAccountId("acct-gone", new Set(["acct-1"])),
			null,
		);
		assert.equal(
			resolveTemplateAccountId("acct-1", new Set(["acct-1"])),
			"acct-1",
		);
	});

	it("marks a template dirty when mapping or account changes", () => {
		const template = chaseTemplate();
		assert.equal(
			isTemplateDirty(template, template.mapping, template.accountId),
			false,
		);
		assert.equal(
			isTemplateDirty(
				template,
				{ ...template.mapping, date: "Posted" },
				template.accountId,
			),
			true,
		);
		assert.equal(isTemplateDirty(template, template.mapping, null), true);
	});

	it("clears the previous default when adding a new default template", () => {
		const existing = chaseTemplate({ isDefault: true });
		const created = createMappingTemplate({
			id: "tpl-amex",
			name: "Amex",
			isDefault: true,
			accountId: null,
			mapping: { date: "Date", description: "Desc", amount: "Amt" },
		});
		const next = addMappingTemplate([existing], created);
		assert.equal(next.find((row) => row.id === "tpl-chase")?.isDefault, false);
		assert.equal(next.find((row) => row.id === "tpl-amex")?.isDefault, true);
	});

	it("updates the selected template mapping in place", () => {
		const existing = chaseTemplate();
		const next = updateMappingTemplate([existing], existing.id, {
			mapping: { date: "Posted", description: "Title", amount: "Amount" },
			accountId: null,
		});
		assert.deepEqual(next[0]?.mapping, {
			date: "Posted",
			description: "Title",
			amount: "Amount",
		});
		assert.equal(next[0]?.accountId, null);
		assert.equal(next[0]?.name, "Chase CSV");
	});

	it("treats a missing category column as unmapped for the wizard warning", () => {
		const mapping: ColumnMapping = {
			date: "Date",
			description: "Memo",
			amount: "Amount",
			category: undefined,
		};
		assert.equal(Boolean(mapping.category), false);
		assert.equal(
			IMPORT_UNCATEGORIZED_WARNING,
			"These transactions will be uncategorized. Map a Category column, or categorize them in the CSV before uploading.",
		);
	});

	it("round-trips an optional memo column through storage", () => {
		const store = new Map<string, string>();
		const storage = {
			getItem(key: string) {
				return store.get(key) ?? null;
			},
			setItem(key: string, value: string) {
				store.set(key, value);
			},
		};
		const template = chaseTemplate({
			mapping: {
				date: "Timestamp",
				description: "Title",
				amount: "Amount",
				memo: "Notes",
			},
		});
		persistMappingTemplates([template], storage);
		assert.deepEqual(loadMappingTemplates(storage)[0]?.mapping, {
			date: "Timestamp",
			description: "Title",
			amount: "Amount",
			memo: "Notes",
		});
	});

	it("round-trips templates through storage and ignores invalid rows", () => {
		const store = new Map<string, string>();
		const storage = {
			getItem(key: string) {
				return store.get(key) ?? null;
			},
			setItem(key: string, value: string) {
				store.set(key, value);
			},
			removeItem(key: string) {
				store.delete(key);
			},
		};
		const template = chaseTemplate({ isDefault: true });
		persistMappingTemplates([template], storage);
		store.set(
			"moat-import-mapping-templates",
			JSON.stringify([template, { id: 1 }, "nope"]),
		);
		assert.deepEqual(loadMappingTemplates(storage), [template]);
		persistMappingTemplates([], storage);
		assert.equal(storage.getItem("moat-import-mapping-templates"), null);
	});
});
