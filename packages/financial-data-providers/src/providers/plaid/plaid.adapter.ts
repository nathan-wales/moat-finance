import type {
	CreateLinkSessionInput,
	CreateLinkSessionResult,
	DisconnectConnectionInput,
	ListInstitutionsInput,
	ProviderAdapter,
	ProviderInstitution,
	ProviderInstitutionPage,
	SearchInstitutionsInput,
	SyncConnectionInput,
	SyncConnectionResult,
	VerifiedWebhook,
	VerifyWebhookInput,
} from "../../core/types";
import { classifyPlaidWebhook } from "./plaid.webhook";

export type PlaidAdapterDependencies<TConnection = unknown> = {
	createLinkSession: (
		input: CreateLinkSessionInput,
	) => Promise<CreateLinkSessionResult>;
	verifyWebhook?: (input: VerifyWebhookInput) => Promise<VerifiedWebhook>;
	syncConnection?: (
		input: SyncConnectionInput<TConnection>,
	) => Promise<SyncConnectionResult>;
	disconnectConnection?: (
		input: DisconnectConnectionInput<TConnection>,
	) => Promise<void>;
};

export class PlaidAdapter<TConnection = unknown>
	implements ProviderAdapter<TConnection>
{
	provider = "PLAID" as const;

	constructor(
		private readonly dependencies: PlaidAdapterDependencies<TConnection>,
	) {}

	async listInstitutions(
		_input: ListInstitutionsInput,
	): Promise<ProviderInstitutionPage> {
		return { institutions: [] };
	}

	async searchInstitutions(
		_input: SearchInstitutionsInput,
	): Promise<ProviderInstitution[]> {
		return [];
	}

	createLinkSession(input: CreateLinkSessionInput) {
		return this.dependencies.createLinkSession(input);
	}

	async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook> {
		if (this.dependencies.verifyWebhook) {
			return this.dependencies.verifyWebhook(input);
		}
		return {
			provider: "PLAID",
			eventType: "plaid.webhook",
			providerConnectionId: null,
			normalizedPayload: input.parsedBody,
		};
	}

	classifyWebhook(input: VerifiedWebhook) {
		if (classifyPlaidWebhook(input) === "SYNC_CONNECTION") {
			return {
				action: "SYNC_CONNECTION" as const,
				connectionId: input.providerConnectionId ?? "",
			};
		}
		return { action: "IGNORE" as const, reason: "Plaid webhook ignored" };
	}

	syncConnection(input: SyncConnectionInput<TConnection>) {
		if (!this.dependencies.syncConnection) {
			throw new Error("Plaid sync dependency is not configured");
		}
		return this.dependencies.syncConnection(input);
	}

	async disconnectConnection(
		input: DisconnectConnectionInput<TConnection>,
	): Promise<void> {
		if (!this.dependencies.disconnectConnection) return;
		await this.dependencies.disconnectConnection(input);
	}
}
