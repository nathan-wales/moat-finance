export function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, maxLength).trimEnd()}…`;
}

export function formatStorageBytes(bytes: number): string {
	const megabytes = bytes / (1024 * 1024);
	if (megabytes >= 10) return `${Math.round(megabytes)} MB`;
	if (megabytes >= 1) return `${megabytes.toFixed(1)} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${bytes} B`;
}

export function formatMoney(value: number): string {
	return value.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	});
}

export function formatTaxFactLabel(type: string): string {
	const labels: Record<string, string> = {
		"w2.wages": "Employment income",
		"w2.federal_withholding": "Federal withholding",
		"w2.state_wages": "State wages",
		"w2.state_tax": "State tax",
		"1098.mortgage_interest": "Mortgage interest",
		"candidate.charitable": "Potential charitable donations",
		"candidate.hsa": "Potential HSA contributions",
		"5498sa.hsa_contributions": "HSA contributions",
		"1099div.ordinary": "Ordinary dividends",
		"1099div.qualified": "Qualified dividends",
		"1099int.interest": "Interest income",
		"1099nec.compensation": "Nonemployee compensation",
	};
	return labels[type] ?? type;
}

export function formatLastUpdated(value: string | null): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
	});
}

export function processingLabel(state: string): string {
	if (state === "complete") return "Processed";
	if (state === "needs_review") return "Needs review";
	if (state === "failed") return "Failed";
	if (state === "processing" || state === "parsed") return "Processing";
	return "Uploaded";
}

export function statusLabel(status: string): string {
	if (status === "candidate") return "Needs confirmation";
	if (status === "confirmed") return "Confirmed";
	if (status === "extracted") return "Extracted";
	if (status === "conflicting") return "Conflicting";
	if (status === "rejected") return "Rejected";
	return status;
}
