import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
	canonicalNotificationChannels,
	canonicalNotificationSignalTypes,
} from "./openapi-enums";

const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../..",
);

function extractYamlEnum(blockName: string, yaml: string): string[] {
	const marker = `    ${blockName}:`;
	const start = yaml.indexOf(marker);
	assert.ok(start >= 0, `missing ${blockName} in OpenAPI`);
	const slice = yaml.slice(start, start + 500);
	const enumIdx = slice.indexOf("enum:");
	assert.ok(enumIdx >= 0, `missing enum for ${blockName}`);
	const lines = slice.slice(enumIdx).split("\n").slice(1);
	const values: string[] = [];
	for (const line of lines) {
		const match = line.match(/^\s+-\s+([a-z0-9_]+)\s*$/);
		if (!match) break;
		values.push(match[1] ?? "");
	}
	return values;
}

describe("notification contract enums", () => {
	it("OpenAPI NotificationSignalType matches canonical Zod enums", () => {
		const yaml = readFileSync(
			path.join(root, "packages/openapi/api-v1.yaml"),
			"utf8",
		);
		const openApi = extractYamlEnum("NotificationSignalType", yaml).sort();
		assert.deepEqual(openApi, [...canonicalNotificationSignalTypes].sort());
	});

	it("OpenAPI NotificationChannel matches canonical Zod enums", () => {
		const yaml = readFileSync(
			path.join(root, "packages/openapi/api-v1.yaml"),
			"utf8",
		);
		const openApi = extractYamlEnum("NotificationChannel", yaml).sort();
		assert.deepEqual(openApi, [...canonicalNotificationChannels].sort());
	});

	it("Swift NotificationSignalType raw values stay in sync", () => {
		const swift = readFileSync(
			path.join(
				root,
				"apps/ios/Moat/Features/Notifications/Models/notification-models.swift",
			),
			"utf8",
		);
		const matches = [...swift.matchAll(/case\s+\w+\s*=\s*"([a-z0-9_]+)"/g)].map(
			(match) => match[1] ?? "",
		);
		const signalMatches = matches.filter((value) =>
			canonicalNotificationSignalTypes.includes(value as never),
		);
		assert.deepEqual(
			signalMatches.sort(),
			[...canonicalNotificationSignalTypes].sort(),
		);
	});
});
