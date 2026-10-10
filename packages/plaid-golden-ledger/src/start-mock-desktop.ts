import { GOLDEN_PLAID_MOCK_PORT, startGoldenPlaidMock } from "./mock-server";

const mock = await startGoldenPlaidMock({
	platform: "desktop",
	port: GOLDEN_PLAID_MOCK_PORT,
});

process.stdout.write(`golden-plaid-mock ${mock.baseUrl}\n`);

function shutdown(): void {
	void mock.close().finally(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise<void>(() => undefined);
