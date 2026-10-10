import { Axiom } from "@axiomhq/js";
import type { AxiomCredentials } from "./types";

let axiomClient: Axiom | null = null;
let cachedCredentials: AxiomCredentials | null = null;

export function getAxiomClient(
	getCredentials: () => AxiomCredentials | null,
): Axiom | null {
	const credentials = getCredentials();
	if (!credentials) {
		return null;
	}

	if (
		axiomClient &&
		cachedCredentials?.token === credentials.token &&
		cachedCredentials.dataset === credentials.dataset
	) {
		return axiomClient;
	}

	axiomClient = new Axiom({ token: credentials.token });
	cachedCredentials = credentials;
	return axiomClient;
}

export function getAxiomDataset(
	getCredentials: () => AxiomCredentials | null,
): string | null {
	return getCredentials()?.dataset ?? null;
}
