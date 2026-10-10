import type {
	RetailerPageState,
	RetailerParser,
	RetailOrderImport,
	RetailOrderItemImport,
} from "../../normalized-types";
import { amazonSelectors } from "./selectors";

const AMAZON_PARSER_VERSION = "amazon-v1-visible-orders";
const ORDER_ID_PATTERN =
	/(?:Order\s*#?|Order\s+number)\s*[:#]?\s*([\d-]{10,})/i;
const ORDER_ID_VALUE_PATTERN = /\b\d{3}-\d{7}-\d{7}\b/;
const PRICE_PATTERN = /\$\s*([0-9,]+(?:\.\d{2})?)/;

function textContent(element: Element | Document): string {
	return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function documentText(document: Document): string {
	return textContent(document.body ?? document.documentElement ?? document);
}

function absoluteUrl(value: string | null, baseUrl: string): string | null {
	if (!value) return null;
	try {
		return new URL(value, baseUrl).toString();
	} catch {
		return null;
	}
}

function parseMoney(value: string): number | null {
	const match = value.match(PRICE_PATTERN);
	if (!match?.[1]) return null;
	return Number.parseFloat(match[1].replace(/,/g, ""));
}

function findMoney(element: Element | null): number | null {
	if (!element) return null;
	const offscreenPrice = element.querySelector(".a-offscreen");
	return parseMoney(textContent(offscreenPrice ?? element));
}

function parseDate(value: string): string | null {
	const normalized = value
		.replace(/ORDER PLACED/i, "")
		.replace(/Ordered on/i, "")
		.replace(/Delivered/i, "")
		.trim();
	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isVisibleTextElement(element: Element): boolean {
	return !["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName);
}

function firstMeaningfulText(elements: Element[]): string | null {
	for (const element of elements) {
		if (!isVisibleTextElement(element)) continue;
		const text = textContent(element);
		if (text.length > 0) return text;
	}
	return null;
}

function findHeaderValue(card: Element, labelPattern: RegExp): string | null {
	const headerItems = Array.from(
		card.querySelectorAll(".order-header__header-list-item"),
	);

	for (const item of headerItems) {
		const rows = Array.from(item.children).filter((child) =>
			child.classList.contains("a-row"),
		);
		const labelRow = rows.find((row) => labelPattern.test(textContent(row)));
		if (!labelRow) continue;

		const valueRows = rows.filter((row) => row !== labelRow);
		const rowValue = firstMeaningfulText(valueRows);
		if (rowValue) return rowValue;

		const text = textContent(item).replace(labelPattern, "").trim();
		if (text.length > 0) return text;
	}

	return null;
}

function findOrderId(card: Element): string | null {
	const dataOrderId = card.getAttribute("data-order-id");
	if (dataOrderId) return dataOrderId.trim();

	const orderIdNode = card.querySelector(".yohtmlc-order-id");
	const orderIdText = orderIdNode ? textContent(orderIdNode) : "";
	const orderIdMatch = orderIdText.match(ORDER_ID_VALUE_PATTERN);
	if (orderIdMatch?.[0]) return orderIdMatch[0];

	const orderLink = card.querySelector(
		"a[href*='orderID='], a[href*='orderId=']",
	);
	const orderLinkHref = orderLink?.getAttribute("href");
	if (orderLinkHref) {
		const urlOrderId = orderLinkHref.match(/[?&]orderI[Dd]=([^&]+)/)?.[1];
		if (urlOrderId) return decodeURIComponent(urlOrderId);
	}

	const text = textContent(card);
	return (
		text.match(ORDER_ID_PATTERN)?.[1] ??
		text.match(ORDER_ID_VALUE_PATTERN)?.[0] ??
		null
	);
}

function findOrderDate(card: Element): string | null {
	const headerDate = findHeaderValue(card, /Order placed|Ordered on/i);
	if (headerDate) return parseDate(headerDate);

	const deliveryNode = card.querySelector(".delivery-box__primary-text");
	return deliveryNode ? parseDate(textContent(deliveryNode)) : null;
}

function findOrderTotal(card: Element): number | null {
	const headerTotal = findHeaderValue(card, /Total|Order total/i);
	if (headerTotal) return parseMoney(headerTotal);

	const totalNode = Array.from(card.querySelectorAll("span, div")).find(
		(node) => /Order total|Total/i.test(textContent(node)),
	);
	return totalNode ? parseMoney(textContent(totalNode)) : null;
}

function findOrderUrl(card: Element, baseUrl: string): string | null {
	return findOrderDetailsUrl(card, baseUrl) ?? findInvoiceUrl(card, baseUrl);
}

function findOrderDetailsUrl(card: Element, baseUrl: string): string | null {
	const orderId = findOrderId(card);
	const matchingLink = orderId
		? card.querySelector(`a[href*='order-details'][href*='${orderId}']`)
		: null;
	const fallbackLink = card.querySelector(
		"a[href*='order-details'], a[href*='orderID='], a[href*='orderId=']",
	);
	return absoluteUrl(
		(matchingLink ?? fallbackLink)?.getAttribute("href") ?? null,
		baseUrl,
	);
}

function findInvoiceUrl(card: Element, baseUrl: string): string | null {
	const orderId = findOrderId(card);
	const matchingLink = orderId
		? card.querySelector(`a[href*='summary/print.html'][href*='${orderId}']`)
		: null;
	const fallbackLink = card.querySelector("a[href*='summary/print.html']");
	return absoluteUrl(
		(matchingLink ?? fallbackLink)?.getAttribute("href") ?? null,
		baseUrl,
	);
}

function getUniqueOrderCards(document: Document): Element[] {
	const cards = new Set<Element>();
	for (const selector of amazonSelectors.orderCard) {
		for (const card of Array.from(document.querySelectorAll(selector))) {
			if (findOrderId(card)) cards.add(card);
		}
	}
	return Array.from(cards);
}

function extractAsin(url: string | null): string | null {
	if (!url) return null;
	const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
	return match?.[1] ?? null;
}

function getComponentText(
	document: Document,
	component: string,
): string | null {
	const node = document.querySelector(`[data-component='${component}']`);
	const text = node ? textContent(node) : "";
	return text.length > 0 ? text : null;
}

function findSummaryMoney(
	document: Document,
	labelPattern: RegExp,
): number | null {
	const rows = Array.from(document.querySelectorAll(".od-line-item-row"));
	for (const row of rows) {
		const label = textContent(
			row.querySelector(".od-line-item-row-label") ?? row,
		);
		if (!labelPattern.test(label)) continue;
		return findMoney(row.querySelector(".od-line-item-row-content"));
	}
	return null;
}

function parseItems(card: Element, baseUrl: string): RetailOrderItemImport[] {
	const titleNodes = new Set<Element>();
	const seenItems = new Set<string>();
	for (const selector of amazonSelectors.itemTitle) {
		for (const node of Array.from(card.querySelectorAll(selector))) {
			const title = textContent(node);
			if (
				title.length > 2 &&
				!/Buy it again|View item|Track package/i.test(title)
			) {
				titleNodes.add(node);
			}
		}
	}

	return Array.from(titleNodes)
		.map((node) => {
			const link = node.closest("a") ?? node.querySelector("a");
			const productUrl = absoluteUrl(
				link?.getAttribute("href") ?? null,
				baseUrl,
			);
			const itemContainer =
				node.closest(".item-box") ??
				node.closest("li") ??
				node.closest(".a-fixed-left-grid") ??
				card;
			const imageNode =
				itemContainer.querySelector(".product-image img[src]") ??
				itemContainer.querySelector("img[src]");
			const imageUrl = absoluteUrl(
				imageNode?.getAttribute("src") ?? null,
				baseUrl,
			);
			const containerText = textContent(itemContainer);
			const unitPrice = parseMoney(containerText);

			return {
				externalItemId: extractAsin(productUrl),
				title: textContent(node),
				quantity: null,
				unitPrice,
				totalPrice: null,
				productUrl,
				imageUrl,
				sku: null,
				asin: extractAsin(productUrl),
			};
		})
		.filter((item) => {
			if (item.title.length === 0) return false;
			const dedupeKey = item.asin ?? item.productUrl ?? item.title;
			if (seenItems.has(dedupeKey)) return false;
			seenItems.add(dedupeKey);
			return true;
		});
}

function parseInvoiceItems(
	document: Document,
	baseUrl: string,
): RetailOrderItemImport[] {
	const items: RetailOrderItemImport[] = [];
	const seenItems = new Set<string>();
	const itemContainers = Array.from(
		document.querySelectorAll("[data-component='purchasedItems']"),
	);

	for (const container of itemContainers) {
		const titleLink = container.querySelector(
			"[data-component='itemTitle'] a[href*='/dp/'], [data-component='itemTitle'] a[href*='/gp/product/']",
		);
		if (!titleLink) continue;
		const title = titleLink ? textContent(titleLink) : "";
		if (!title) continue;

		const productUrl = absoluteUrl(titleLink.getAttribute("href"), baseUrl);
		const asin = extractAsin(productUrl);
		const imageNode = container.querySelector(
			"[data-component='itemImage'] img[src]",
		);
		const imageUrl = absoluteUrl(
			imageNode?.getAttribute("src") ?? null,
			baseUrl,
		);
		const unitPrice = findMoney(
			container.querySelector("[data-component='unitPrice']"),
		);
		const dedupeKey = asin ?? productUrl ?? title;
		if (seenItems.has(dedupeKey)) continue;
		seenItems.add(dedupeKey);

		items.push({
			externalItemId: asin,
			title,
			quantity: null,
			unitPrice,
			totalPrice: unitPrice,
			productUrl,
			imageUrl,
			sku: null,
			asin,
		});
	}

	return items;
}

function isInvoicePage(document: Document): boolean {
	return (
		Boolean(document.querySelector("[data-component='orderSummary']")) &&
		Boolean(document.querySelector("[data-component='purchasedItems']")) &&
		Boolean(getComponentText(document, "orderId"))
	);
}

function parseInvoiceOrder(
	document: Document,
	url: string,
	scrapedAt: string,
	pageHash: string,
): RetailOrderImport | null {
	const externalOrderId =
		getComponentText(document, "orderId")?.match(ORDER_ID_VALUE_PATTERN)?.[0] ??
		documentText(document).match(ORDER_ID_VALUE_PATTERN)?.[0] ??
		null;
	if (!externalOrderId) return null;

	const items = parseInvoiceItems(document, url);
	if (items.length === 0) return null;

	return {
		retailer: "amazon",
		externalOrderId,
		orderDate: parseDate(getComponentText(document, "orderDate") ?? ""),
		orderUrl: url,
		orderDetailsUrl: null,
		invoiceUrl: url,
		currency: "USD",
		subtotal: findSummaryMoney(document, /Item\(s\) Subtotal/i),
		shipping: findSummaryMoney(document, /Shipping & Handling|Shipping/i),
		tax: findSummaryMoney(document, /tax/i),
		discount: findSummaryMoney(document, /promotion|discount|coupon/i),
		total: findSummaryMoney(document, /Grand Total|Order Total/i),
		items,
		raw: {
			sourceUrl: url,
			scrapedAt,
			parserVersion: AMAZON_PARSER_VERSION,
			pageHash,
		},
	};
}

function hashPage(document: Document): string {
	const text = documentText(document).slice(0, 5000);
	let hash = 0;
	for (let index = 0; index < text.length; index += 1) {
		hash = (hash << 5) - hash + text.charCodeAt(index);
		hash |= 0;
	}
	return Math.abs(hash).toString(16);
}

export const amazonParser: RetailerParser = {
	retailer: "amazon",
	parserVersion: AMAZON_PARSER_VERSION,
	canParse(url) {
		return /https:\/\/(www\.|smile\.)?amazon\.com\//i.test(url);
	},
	detectState(document): RetailerPageState {
		const text = documentText(document);
		const title = document.title;

		if (/captcha|robot check|enter the characters/i.test(text)) {
			return "captcha_or_bot_check";
		}

		if (
			/sign in|authentication required/i.test(title) ||
			/Email or mobile phone number/i.test(text)
		) {
			return "login_required";
		}

		const cards = getUniqueOrderCards(document);
		if (cards.length > 0) return "orders_page";
		if (isInvoicePage(document)) return "orders_page";

		if (/your orders|order placed|order #|order total/i.test(text)) {
			return "empty_orders";
		}

		return "unsupported_page";
	},
	parseOrders(document, url): RetailOrderImport[] {
		const scrapedAt = new Date().toISOString();
		const pageHash = hashPage(document);
		const orders: RetailOrderImport[] = [];
		const invoiceOrder = parseInvoiceOrder(document, url, scrapedAt, pageHash);
		if (invoiceOrder) return [invoiceOrder];

		for (const card of getUniqueOrderCards(document)) {
			const externalOrderId = findOrderId(card);
			if (!externalOrderId) continue;

			const orderDetailsUrl = findOrderDetailsUrl(card, url);
			const invoiceUrl = findInvoiceUrl(card, url);
			const orderUrl = findOrderUrl(card, url);
			const items = parseItems(card, url);
			if (items.length === 0) continue;

			orders.push({
				retailer: "amazon",
				externalOrderId,
				orderDate: findOrderDate(card),
				orderUrl: orderUrl ?? url,
				orderDetailsUrl,
				invoiceUrl,
				currency: "USD",
				total: findOrderTotal(card),
				items,
				raw: {
					sourceUrl: url,
					scrapedAt,
					parserVersion: AMAZON_PARSER_VERSION,
					pageHash,
				},
			});
		}

		return orders;
	},
};
