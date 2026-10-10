import { z } from "zod";

export const REMOTE_MCP_CHANNELS = {
	getState: "remoteMcp:getState",
	setEnabled: "remoteMcp:setEnabled",
	statusChanged: "remoteMcp:statusChanged",
} as const;

export const RemoteMcpStatusSchema = z.enum([
	"off",
	"connecting",
	"connected",
	"offline",
	"authentication_error",
]);

export type RemoteMcpStatus = z.infer<typeof RemoteMcpStatusSchema>;

export const RemoteMcpStateSchema = z.object({
	featureEnabled: z.boolean(),
	userEnabled: z.boolean(),
	cloudSignedIn: z.boolean(),
	status: RemoteMcpStatusSchema,
	endpointUrl: z.string().nullable(),
});

export type RemoteMcpState = z.infer<typeof RemoteMcpStateSchema>;

export const SetRemoteMcpEnabledInputSchema = z.object({
	enabled: z.boolean(),
});

export type SetRemoteMcpEnabledInput = z.infer<
	typeof SetRemoteMcpEnabledInputSchema
>;
