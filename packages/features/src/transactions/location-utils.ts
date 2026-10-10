import type { TransactionLocation } from "@moat/contracts";

export function hasMappableLocation(
	location: TransactionLocation | null | undefined,
): boolean {
	if (!location) return false;
	if (location.lat != null && location.lon != null) return true;
	if (location.address?.trim()) return true;
	return Boolean(location.city?.trim() && location.region?.trim());
}

export function formatTransactionAddress(
	location: TransactionLocation,
): string | null {
	const street = location.address?.trim() || null;
	const city = location.city?.trim() || null;
	const region = location.region?.trim() || null;
	const postalCode = location.postal_code?.trim() || null;

	const cityRegion = [city, region].filter(Boolean).join(", ");
	const cityRegionPostal = [cityRegion, postalCode].filter(Boolean).join(" ");
	const parts = [street, cityRegionPostal].filter(Boolean);

	if (parts.length === 0) return null;
	return parts.join(", ");
}

export function buildExternalMapsUrl(location: TransactionLocation): string {
	if (location.lat != null && location.lon != null) {
		return `https://maps.google.com/?q=${location.lat},${location.lon}`;
	}

	const address = formatTransactionAddress(location);
	if (address) {
		return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
	}

	return "https://maps.google.com";
}
