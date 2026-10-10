export function isSyncedRealEstateAsset(id: string): boolean {
	return id.startsWith("real-estate-");
}

export function realEstatePropertyIdFromAssetId(id: string): string {
	return id.replace(/^real-estate-/, "");
}

export function isLegacyRealEstateAsset(asset: {
	id: string;
	type: string;
}): boolean {
	return asset.type === "Real estate" && !isSyncedRealEstateAsset(asset.id);
}

const LEGACY_BANNER_DISMISS_KEY = "moat:legacy-real-estate-banner-dismissed";

export function isLegacyRealEstateBannerDismissed(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(LEGACY_BANNER_DISMISS_KEY) === "true";
}

export function dismissLegacyRealEstateBanner(): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(LEGACY_BANNER_DISMISS_KEY, "true");
}
