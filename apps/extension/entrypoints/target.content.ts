import { registerHtmlCapture } from "../lib/content-html-capture";

const HTML_CAPTURE_VERSION = "extension-html-capture-v1";
const LOG_PREFIX = "[Moat Retail Sync][content:target]";

function log(message: string, context: Record<string, unknown> = {}) {
	console.log(LOG_PREFIX, message, {
		...context,
		timestamp: new Date().toISOString(),
	});
}

export default defineContentScript({
	matches: ["https://www.target.com/*"],
	registration: "runtime",
	main() {
		registerHtmlCapture({
			retailer: "target",
			parserVersion: HTML_CAPTURE_VERSION,
			log,
		});
	},
});
