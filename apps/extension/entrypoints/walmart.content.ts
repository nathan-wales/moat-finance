import { registerHtmlCapture } from "../lib/content-html-capture";

const HTML_CAPTURE_VERSION = "extension-html-capture-v1";
const LOG_PREFIX = "[Moat Retail Sync][content:walmart]";

function log(message: string, context: Record<string, unknown> = {}) {
	console.log(LOG_PREFIX, message, {
		...context,
		timestamp: new Date().toISOString(),
	});
}

export default defineContentScript({
	matches: ["https://www.walmart.com/*"],
	registration: "runtime",
	main() {
		registerHtmlCapture({
			retailer: "walmart",
			parserVersion: HTML_CAPTURE_VERSION,
			log,
		});
	},
});
