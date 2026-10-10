export type ImportMappingTemplateMapping = {
	date: string;
	description: string;
	amount: string;
	type?: string;
	category?: string;
	memo?: string;
};

export type ImportMappingTemplateRecord = {
	id: string;
	userId: string;
	name: string;
	isDefault: boolean;
	accountId: string | null;
	mapping: ImportMappingTemplateMapping;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateImportMappingTemplateInput = {
	name: string;
	mapping: ImportMappingTemplateMapping;
	accountId: string | null;
	isDefault: boolean;
};

export type UpdateImportMappingTemplateInput = {
	name?: string;
	mapping?: ImportMappingTemplateMapping;
	accountId?: string | null;
	isDefault?: boolean;
};

export interface ImportMappingTemplateRepository {
	list(input: { userId: string }): Promise<ImportMappingTemplateRecord[]>;
	findById(input: {
		userId: string;
		id: string;
	}): Promise<ImportMappingTemplateRecord | null>;
	create(
		input: { userId: string } & CreateImportMappingTemplateInput,
	): Promise<ImportMappingTemplateRecord>;
	update(input: {
		userId: string;
		id: string;
		data: UpdateImportMappingTemplateInput;
	}): Promise<ImportMappingTemplateRecord>;
	delete(input: { userId: string; id: string }): Promise<void>;
}
