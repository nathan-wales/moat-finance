import { z } from "zod";

export const PROFILE_CHANNELS = {
	list: "profiles:list",
	create: "profiles:create",
	switch: "profiles:switch",
	update: "profiles:update",
} as const;

export const ProfileKindSchema = z.enum(["PERSONAL", "FAMILY", "BUSINESS"]);

export const BusinessTypeSchema = z.enum([
	"SOLE_PROPRIETOR",
	"SINGLE_MEMBER_LLC",
	"MULTI_MEMBER_LLC_PARTNERSHIP",
	"S_CORPORATION",
	"C_CORPORATION",
]);

export type ProfileKind = z.infer<typeof ProfileKindSchema>;
export type BusinessType = z.infer<typeof BusinessTypeSchema>;

export const IpcProfileSummarySchema = z.object({
	id: z.string(),
	kind: ProfileKindSchema,
	displayName: z.string(),
	profileUserId: z.string(),
	isActive: z.boolean(),
	isPersonal: z.boolean(),
	businessType: BusinessTypeSchema.nullable(),
	/**
	 * The owner's plan no longer covers this profile. Data is intact and readable;
	 * writes are refused until they upgrade. Optional so snapshots cached by older
	 * clients still validate.
	 */
	isEntitlementRestricted: z.boolean().optional().default(false),
});

export type IpcProfileSummary = z.infer<typeof IpcProfileSummarySchema>;

export const IpcProfileListResultSchema = z.object({
	businessProfileCount: z.number().optional().default(0),
	businessProfileLimit: z.number().optional().default(0),
	canCreateBusinessProfile: z.boolean().optional().default(false),
	canCreateProfile: z.boolean(),
	profiles: z.array(IpcProfileSummarySchema),
});

export type IpcProfileListResult = z.infer<typeof IpcProfileListResultSchema>;

export const CreateProfileInputSchema = z
	.object({
		kind: z.enum(["FAMILY", "BUSINESS"]),
		displayName: z.string().trim().min(1).max(100),
		businessType: BusinessTypeSchema.optional(),
	})
	.superRefine((value, ctx) => {
		if (value.kind === "BUSINESS" && !value.businessType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Business type is required",
				path: ["businessType"],
			});
		}
		if (value.kind !== "BUSINESS" && value.businessType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Business type is only valid for business profiles",
				path: ["businessType"],
			});
		}
	});

export type CreateProfileInput = z.infer<typeof CreateProfileInputSchema>;

export const SwitchProfileInputSchema = z.object({
	profileId: z.string().min(1),
});

export type SwitchProfileInput = z.infer<typeof SwitchProfileInputSchema>;

export const UpdateProfileInputSchema = z
	.object({
		id: z.string().trim().min(1),
		displayName: z.string().trim().min(1).max(100).optional(),
		includeInOwnerNetWorth: z.boolean().optional(),
		businessType: BusinessTypeSchema.optional(),
	})
	.refine(
		(value) =>
			value.displayName !== undefined ||
			value.includeInOwnerNetWorth !== undefined ||
			value.businessType !== undefined,
		{
			message:
				"Provide displayName, includeInOwnerNetWorth, and/or businessType",
		},
	);

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
