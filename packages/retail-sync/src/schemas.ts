import { z } from "zod";

export const retailerSchema = z.enum(["amazon", "walmart", "target"]);

const nullableMoneySchema = z.number().finite().nullable().optional();

export const retailOrderItemImportSchema = z.object({
	externalItemId: z.string().min(1).nullable().optional(),
	title: z.string().trim().min(1),
	quantity: z.number().int().positive().nullable().optional(),
	unitPrice: nullableMoneySchema,
	totalPrice: nullableMoneySchema,
	productUrl: z.string().url().nullable().optional(),
	imageUrl: z.string().url().nullable().optional(),
	sku: z.string().min(1).nullable().optional(),
	asin: z.string().min(1).nullable().optional(),
});

export const retailOrderImportSchema = z.object({
	retailer: retailerSchema,
	externalOrderId: z.string().trim().min(1),
	orderDate: z.string().datetime().nullable(),
	orderUrl: z.string().url().optional(),
	orderDetailsUrl: z.string().url().nullable().optional(),
	invoiceUrl: z.string().url().nullable().optional(),
	currency: z.literal("USD"),
	subtotal: nullableMoneySchema,
	tax: nullableMoneySchema,
	shipping: nullableMoneySchema,
	discount: nullableMoneySchema,
	total: nullableMoneySchema,
	items: z.array(retailOrderItemImportSchema).min(1),
	raw: z.object({
		sourceUrl: z.string().url(),
		scrapedAt: z.string().datetime(),
		parserVersion: z.string().min(1),
		pageHash: z.string().min(1).optional(),
	}),
});

export const createRetailImportRequestSchema = z.object({
	retailer: retailerSchema,
	orders: z.array(retailOrderImportSchema).min(1),
	syncRunId: z.string().min(1),
});

export const createRetailHtmlImportRequestSchema = z.object({
	retailer: retailerSchema,
	syncRunId: z.string().min(1),
	sourceUrl: z.string().url(),
	html: z.string().min(1).max(25_000_000),
});

export const retailConnectionUpsertSchema = z.object({
	retailer: retailerSchema,
	status: z
		.enum([
			"connected",
			"disconnected",
			"permission_required",
			"login_required",
			"syncing",
			"error",
		])
		.default("connected"),
});

export type CreateRetailImportRequest = z.infer<
	typeof createRetailImportRequestSchema
>;

export type CreateRetailHtmlImportRequest = z.infer<
	typeof createRetailHtmlImportRequestSchema
>;
