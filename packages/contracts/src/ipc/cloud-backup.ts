import { z } from "zod";

export const CLOUD_BACKUP_CHANNELS = {
	getStatus: "cloudBackup:getStatus",
	setPreferences: "cloudBackup:setPreferences",
	register: "cloudBackup:register",
	signIn: "cloudBackup:signIn",
	signInWithGoogle: "cloudBackup:signInWithGoogle",
	cancelGoogleSignIn: "cloudBackup:cancelGoogleSignIn",
	signOut: "cloudBackup:signOut",
	getIdentity: "cloudBackup:getIdentity",
	updateProfile: "cloudBackup:updateProfile",
	previewCounts: "cloudBackup:previewCounts",
	runBackup: "cloudBackup:runBackup",
	progress: "cloudBackup:progress",
} as const;

export const CloudBackupDomainSchema = z.enum([
	"rules",
	"categories",
	"budgets",
	"forecasts",
	"hashtags",
	"transactions",
]);

export type CloudBackupDomain = z.infer<typeof CloudBackupDomainSchema>;

export const CloudBackupDomainStatusStateSchema = z.enum([
	"not_selected",
	"never_synced",
	"up_to_date",
	"needs_sync",
	"failed",
]);

export type CloudBackupDomainStatusState = z.infer<
	typeof CloudBackupDomainStatusStateSchema
>;

export const CloudBackupDomainPreferencesSchema = z.object({
	everything: z.boolean(),
	rules: z.boolean(),
	categories: z.boolean(),
	budgets: z.boolean(),
	forecasts: z.boolean(),
	hashtags: z.boolean(),
	transactions: z.boolean(),
});

export type CloudBackupDomainPreferences = z.infer<
	typeof CloudBackupDomainPreferencesSchema
>;

export const DEFAULT_CLOUD_BACKUP_PREFERENCES: CloudBackupDomainPreferences = {
	everything: false,
	rules: true,
	categories: true,
	budgets: true,
	forecasts: true,
	hashtags: true,
	transactions: false,
};

export const CloudBackupDomainStatusSchema = z.object({
	domain: CloudBackupDomainSchema,
	state: CloudBackupDomainStatusStateSchema,
	localCount: z.number().int().nonnegative(),
	lastSyncedAt: z.string().nullable(),
	lastError: z.string().nullable(),
});

export type CloudBackupDomainStatus = z.infer<
	typeof CloudBackupDomainStatusSchema
>;

export const CloudBackupStatusSchema = z.object({
	signedIn: z.boolean(),
	userEmail: z.string().nullable(),
	userName: z.string().nullable(),
	backupsEnabled: z.boolean(),
	preferences: CloudBackupDomainPreferencesSchema,
	lastSuccessfulSyncAt: z.string().nullable(),
	lastAttemptAt: z.string().nullable(),
	lastError: z.string().nullable(),
	isRunning: z.boolean(),
	domains: z.array(CloudBackupDomainStatusSchema),
});

export type CloudBackupStatus = z.infer<typeof CloudBackupStatusSchema>;

export const CloudBackupSetPreferencesInputSchema = z.object({
	backupsEnabled: z.boolean().optional(),
	preferences: CloudBackupDomainPreferencesSchema.partial().optional(),
});

export type CloudBackupSetPreferencesInput = z.infer<
	typeof CloudBackupSetPreferencesInputSchema
>;

export const CloudBackupRegisterInputSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	password: z.string().min(8),
});

export type CloudBackupRegisterInput = z.infer<
	typeof CloudBackupRegisterInputSchema
>;

export const CloudBackupSignInInputSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

export type CloudBackupSignInInput = z.infer<typeof CloudBackupSignInInputSchema>;

export const CloudBackupPreviewCountsSchema = z.object({
	rules: z.number().int().nonnegative(),
	categories: z.number().int().nonnegative(),
	budgets: z.number().int().nonnegative(),
	forecasts: z.number().int().nonnegative(),
	hashtags: z.number().int().nonnegative(),
	transactions: z.number().int().nonnegative(),
});

export type CloudBackupPreviewCounts = z.infer<
	typeof CloudBackupPreviewCountsSchema
>;

export const CloudBackupProgressSchema = z.object({
	phase: z.string(),
	message: z.string(),
	percent: z.number().min(0).max(100).optional(),
});

export type CloudBackupProgress = z.infer<typeof CloudBackupProgressSchema>;

export const CloudBackupRunResultSchema = z.object({
	ok: z.boolean(),
	error: z.string().nullable(),
	status: CloudBackupStatusSchema,
});

export type CloudBackupRunResult = z.infer<typeof CloudBackupRunResultSchema>;

export const CloudAccountIdentitySchema = z.object({
	signedIn: z.boolean(),
	email: z.string().nullable(),
	name: z.string().nullable(),
	userId: z.string().nullable(),
});

export type CloudAccountIdentity = z.infer<typeof CloudAccountIdentitySchema>;

export const CloudAccountUpdateProfileInputSchema = z.object({
	name: z.string().trim().min(1).max(100),
});

export type CloudAccountUpdateProfileInput = z.infer<
	typeof CloudAccountUpdateProfileInputSchema
>;

export const CloudAccountUpdateProfileResultSchema = z.object({
	name: z.string(),
});

export type CloudAccountUpdateProfileResult = z.infer<
	typeof CloudAccountUpdateProfileResultSchema
>;
