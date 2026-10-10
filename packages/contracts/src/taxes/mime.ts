import {
	TAX_ALLOWED_MIME_TYPES,
	type TaxAllowedMimeType,
	TaxAllowedMimeTypeSchema,
} from "./enums";

const EXTENSION_TO_MIME: Record<string, TaxAllowedMimeType> = {
	pdf: "application/pdf",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	heic: "image/heic",
	heif: "image/heif",
};

export function resolveTaxUploadMimeType(
	filename: string,
	fileType?: string,
): TaxAllowedMimeType | null {
	const parsed = TaxAllowedMimeTypeSchema.safeParse(fileType);
	if (parsed.success) return parsed.data;
	if (fileType === "image/jpg") return "image/jpeg";
	const extension = filename.split(".").pop()?.toLowerCase();
	if (!extension) return null;
	return EXTENSION_TO_MIME[extension] ?? null;
}

export function isTaxAllowedMimeType(
	value: string,
): value is TaxAllowedMimeType {
	return (TAX_ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}
