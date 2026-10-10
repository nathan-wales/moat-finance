const ALLOWED_TAGS = new Set([
	"html",
	"body",
	"main",
	"section",
	"article",
	"header",
	"footer",
	"h1",
	"h2",
	"h3",
	"h4",
	"p",
	"span",
	"div",
	"strong",
	"em",
	"b",
	"i",
	"u",
	"ul",
	"ol",
	"li",
	"table",
	"thead",
	"tbody",
	"tr",
	"th",
	"td",
	"blockquote",
	"hr",
	"br",
	"caption",
	"colgroup",
	"col",
	"small",
	"abbr",
	"code",
	"pre",
	"dl",
	"dt",
	"dd",
	"figure",
	"figcaption",
	"mark",
	"time",
	"sup",
	"sub",
]);

const BLOCKED_ATTRS_REGEX =
	/\s+(on\w+|srcdoc|formaction|action|data|xmlns)[^=]*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_HREF_REGEX = /\shref\s*=\s*["']\s*javascript:[^"']*["']/gi;
const STYLE_ATTR_REGEX = /\sstyle\s*=\s*["'][^"']*["']/gi;

const BLOCKED_CSS_PATTERNS = [
	/@import\b/gi,
	/\burl\s*\(/gi,
	/\bexpression\s*\(/gi,
	/\bbehavior\s*:/gi,
	/-moz-binding\s*:/gi,
	/\bjavascript\s*:/gi,
	/\bposition\s*:\s*(fixed|sticky)/gi,
	/\bz-index\s*:\s*([1-9]\d{4,})/gi,
];

export function sanitizeHtml(raw: string): string {
	let html = raw
		.replace(
			/<\s*(script|iframe|object|embed|form|input|button|textarea|select|link|meta|base|svg|math|video|audio|canvas|noscript|template|slot)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi,
			"",
		)
		.replace(
			/<\s*(script|iframe|object|embed|form|input|button|textarea|select|link|meta|base|svg|math|video|audio|canvas|noscript|template|slot)[^>]*\/?>/gi,
			"",
		);

	html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tag) => {
		const lower = (tag as string).toLowerCase();
		if (ALLOWED_TAGS.has(lower)) return match;
		return "";
	});

	html = html.replace(BLOCKED_ATTRS_REGEX, "");
	html = html.replace(JAVASCRIPT_HREF_REGEX, "");
	html = html.replace(STYLE_ATTR_REGEX, "");
	html = html.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");
	return html.trim();
}

export function sanitizeCss(raw: string): string {
	let css = raw;
	for (const pattern of BLOCKED_CSS_PATTERNS) {
		css = css.replace(pattern, "/* removed */");
	}
	return css.slice(0, 50_000).trim();
}
