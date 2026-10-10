import type { ImportMappingTemplateDto } from "@moat/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useApiClient } from "../api-client-context";
import {
	loadMappingTemplates,
	normalizeMapping,
	persistMappingTemplates,
} from "./mapping-templates";
import type { ColumnMapping } from "./types";

const TEMPLATES_QUERY_KEY = ["import-mapping-templates"] as const;

let migrateInFlight: Promise<void> | null = null;

function toColumnMapping(
	mapping: ImportMappingTemplateDto["mapping"],
): ColumnMapping {
	return normalizeMapping({
		date: mapping.date,
		description: mapping.description,
		amount: mapping.amount,
		type: mapping.type,
		category: mapping.category,
		memo: mapping.memo,
	});
}

function toTemplateApiMapping(mapping: ColumnMapping) {
	return normalizeMapping(mapping);
}

function canMigrateTemplate(template: { mapping: ColumnMapping }): boolean {
	return Boolean(
		template.mapping.date &&
			template.mapping.description &&
			template.mapping.amount,
	);
}

export function useImportMappingTemplates() {
	const client = useApiClient();
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: TEMPLATES_QUERY_KEY,
		queryFn: () => client.listImportTemplates(),
	});

	useEffect(() => {
		if (migrateInFlight || query.isLoading || query.isError) return;
		const remote = query.data ?? [];
		if (remote.length > 0) return;
		const local = loadMappingTemplates();
		if (local.length === 0) return;
		migrateInFlight = (async () => {
			try {
				let remaining = [...local];
				for (const template of local) {
					if (!canMigrateTemplate(template)) {
						remaining = remaining.filter((row) => row.id !== template.id);
						persistMappingTemplates(remaining);
						continue;
					}
					await client.createImportTemplate({
						name: template.name,
						mapping: toTemplateApiMapping(template.mapping),
						accountId: template.accountId,
						isDefault: template.isDefault,
					});
					remaining = remaining.filter((row) => row.id !== template.id);
					persistMappingTemplates(remaining);
				}
				persistMappingTemplates([]);
				await queryClient.invalidateQueries({
					queryKey: TEMPLATES_QUERY_KEY,
				});
			} finally {
				migrateInFlight = null;
			}
		})();
	}, [client, query.data, query.isError, query.isLoading, queryClient]);

	const createMutation = useMutation({
		mutationFn: (input: {
			name: string;
			mapping: ColumnMapping;
			accountId: string | null;
			isDefault: boolean;
		}) =>
			client.createImportTemplate({
				name: input.name,
				mapping: toTemplateApiMapping(input.mapping),
				accountId: input.accountId,
				isDefault: input.isDefault,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
		},
	});

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: string;
			mapping: ColumnMapping;
			accountId: string | null;
		}) =>
			client.updateImportTemplate({
				id: input.id,
				mapping: toTemplateApiMapping(input.mapping),
				accountId: input.accountId,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
		},
	});

	function saveTemplate(input: {
		name: string;
		mapping: ColumnMapping;
		accountId: string | null;
		isDefault: boolean;
	}) {
		return createMutation.mutateAsync(input);
	}

	function updateTemplate(
		id: string,
		patch: { mapping: ColumnMapping; accountId: string | null },
	) {
		updateMutation.mutate({ id, ...patch });
	}

	return {
		templates: (query.data ?? []).map((template) => ({
			id: template.id,
			name: template.name,
			isDefault: template.isDefault,
			accountId: template.accountId,
			mapping: toColumnMapping(template.mapping),
		})),
		saveTemplate,
		updateTemplate,
	};
}
