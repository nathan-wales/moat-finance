import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
	applyVisit,
	attributionFromCookie,
	attributionFromSearch,
	decorateAppUrl,
	serializeAttributionCookie,
	touchFromVisit,
} from "./marketing-attribution";

const marketingRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../../apps/marketing",
);

const pages = [
	{
		file: "for/ai-agents.html",
		title: "Moat Finance for AI agents",
		description:
			"Connect Claude, ChatGPT, Cursor, or Gemini over an MCP server. Start from a prompt library. Keep the answers as reports.",
		h1: "The financial operating system for you and your agents",
		canonical: "https://moatfinance.ai/for/ai-agents",
	},
	{
		file: "for/local.html",
		title: "The financial operating system on your machine",
		description:
			"Encrypted desktop app. Encrypted SQLite. Works offline. macOS and Linux now. Windows waitlist.",
		h1: "The financial operating system on your machine",
		canonical: "https://moatfinance.ai/for/local",
	},
] as const;

function readPage(file: string): string {
	return readFileSync(join(marketingRoot, file), "utf8");
}

function tag(html: string, name: string): string {
	const match = html.match(
		new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"),
	);
	return (match?.[1] ?? "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("audience landing pages", () => {
	for (const page of pages) {
		it(`${page.file} stands alone without JavaScript`, () => {
			const html = readPage(page.file);
			const ogDescription =
				"ogDescription" in page ? page.ogDescription : page.description;
			assert.equal(tag(html, "title"), page.title);
			assert.match(
				html,
				new RegExp(
					`<meta name="description" content="${escapeRegExp(page.description)}">`,
				),
			);
			assert.match(
				html,
				new RegExp(`<link rel="canonical" href="${page.canonical}">`),
			);
			assert.match(
				html,
				new RegExp(
					`<meta property="og:title" content="${escapeRegExp(page.title)}">`,
				),
			);
			assert.match(
				html,
				new RegExp(
					`<meta property="og:description" content="${escapeRegExp(ogDescription)}">`,
				),
			);
			assert.equal(tag(html, "h1"), page.h1);
			assert.doesNotMatch(html, /href="(?:\.\/)?agents\.html"/);
		});
	}

	it("lists the homepage and audience pages in the sitemap", () => {
		const sitemap = readFileSync(join(marketingRoot, "sitemap.xml"), "utf8");
		assert.match(sitemap, /https:\/\/moatfinance\.ai\/</);
		assert.match(sitemap, /https:\/\/moatfinance\.ai\/for\/ai-agents</);
		assert.match(sitemap, /https:\/\/moatfinance\.ai\/for\/local</);
		assert.doesNotMatch(sitemap, /for\/self-employed/);
	});

	it("keeps homepage sections focused on self-hosting", () => {
		const home = readPage("index.html");
		assert.equal(tag(home, "h1"), "Open source personal finance app");
		assert.match(home, /The three questions everyone asks/);
		assert.match(home, /id="quickstart"/);
		assert.match(home, /id="deploy"/);
		assert.doesNotMatch(home, /id="pricing"/);
		assert.match(home, />AI Agents</);
		assert.match(home, /href="index\.html"/);
		assert.match(home, /href="for\/ai-agents\.html"/);
		assert.match(home, /href="download\.html"/);
	});

	it("sends local visitors to download and the Windows waitlist", () => {
		const html = readPage("for/local.html");
		assert.match(html, /href="\.\.\/download\.html"/);
		assert.match(html, /href="\.\.\/windows\.html"/);
		assert.doesNotMatch(html, /data never leaves/i);
		assert.doesNotMatch(html, /encryption key/i);
		assert.match(html, /Encrypted SQLite/);
		assert.match(html, /Works offline|wifi off/);
	});

	it("resolves CSS from the HTML file and from the pretty /for URL", () => {
		for (const page of pages) {
			const html = readPage(page.file);
			assert.match(html, /href="\.\.\/styles\.css"/);
			assert.match(html, /src="\.\.\/script\.js"/);
			assert.equal(
				new URL("../styles.css", page.canonical).pathname,
				"/styles.css",
			);
			assert.equal(
				new URL(`../styles.css`, `file:///marketing/${page.file}`).pathname,
				"/marketing/styles.css",
			);
		}
	});

	it("points AI calls to action at the self-host chooser, not hosted sign-up", () => {
		const html = readPage("for/ai-agents.html");
		assert.match(html, /href="\.\.\/index\.html#get-started"/);
		assert.doesNotMatch(html, /app\.moatfinance\.ai\/get-started/);
		assert.match(html, /demoMode=true/);
		assert.match(html, /MCP server/);
		assert.match(html, /AI-generated reports/);
		assert.match(html, /Prompt library/);
		assert.doesNotMatch(html, /chatbot we|Moat chats|moves money/i);
	});
});

describe("marketing attribution", () => {
	const localVisit = touchFromVisit({
		pathname: "/for/local",
		search: "?utm_source=newsletter",
		touchedAt: "2026-09-23T12:00:00.000Z",
	});
	const aiVisit = touchFromVisit({
		pathname: "/for/ai-agents",
		search: "",
		touchedAt: "2026-09-23T13:00:00.000Z",
	});

	it("keeps first touch and updates latest touch", () => {
		assert.ok(localVisit);
		assert.ok(aiVisit);
		const afterLocal = applyVisit(null, localVisit);
		const afterAi = applyVisit(afterLocal, aiVisit);
		assert.equal(afterAi.first.channel, "local");
		assert.equal(afterAi.first.utm.utm_source, "newsletter");
		assert.equal(afterAi.latest.channel, "ai");
	});

	it("keeps a local signup after the visitor leaves that page", () => {
		assert.ok(localVisit);
		const stored = applyVisit(null, localVisit);
		assert.equal(
			touchFromVisit({
				pathname: "/",
				search: "",
				touchedAt: "2026-09-23T13:00:00.000Z",
			}),
			null,
		);
		const href = decorateAppUrl(
			"https://app.moatfinance.ai/get-started",
			stored,
		);
		assert.match(href, /moat_channel=local/);
		assert.match(href, /utm_source=newsletter/);
		assert.doesNotMatch(href, /callbackUrl|redirect=/);
		const roundTrip = attributionFromSearch(new URL(href).search);
		assert.equal(roundTrip?.first.channel, "local");
		assert.equal(roundTrip?.first.path, "/for/local");
	});

	it("survives an OAuth callback that drops the query string", () => {
		assert.ok(localVisit);
		const stored = applyVisit(null, localVisit);
		const cookie = serializeAttributionCookie(stored);
		const callbackUrl = "https://app.moatfinance.ai/api/auth/callback/google";
		assert.equal(new URL(callbackUrl).search, "");
		const restored = attributionFromCookie(cookie);
		assert.equal(restored?.first.channel, "local");
		assert.equal(restored?.latest.channel, "local");
		const polluted = attributionFromSearch(
			`${cookie}&callbackUrl=https://evil.example`,
		);
		assert.equal(polluted?.first.channel, "local");
		assert.equal(
			decorateAppUrl("https://app.moatfinance.ai/get-started", polluted),
			decorateAppUrl("https://app.moatfinance.ai/get-started", stored),
		);
	});
});
