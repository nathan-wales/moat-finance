"use client";

import type { TransactionLocation } from "@moat/contracts";
import { Label } from "@moat/ui";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import {
	buildExternalMapsUrl,
	formatTransactionAddress,
	hasMappableLocation,
} from "./location-utils";

type TransactionLocationSectionProps = {
	location: TransactionLocation | null | undefined;
};

export function TransactionLocationSection({
	location,
}: TransactionLocationSectionProps) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<{ remove: () => void } | null>(null);

	const canShow = hasMappableLocation(location);
	const hasCoordinates =
		location?.lat != null &&
		location?.lon != null &&
		Number.isFinite(location.lat) &&
		Number.isFinite(location.lon);
	const address = location ? formatTransactionAddress(location) : null;
	const mapsUrl = location ? buildExternalMapsUrl(location) : null;

	useEffect(() => {
		if (!canShow || !hasCoordinates || !location || !mapContainerRef.current) {
			return;
		}

		const lat = location.lat;
		const lon = location.lon;
		if (lat == null || lon == null) return;

		const markerLat = lat;
		const markerLon = lon;
		let cancelled = false;

		async function setupMap() {
			const leafletCssId = "leaflet-stylesheet";
			if (!document.getElementById(leafletCssId)) {
				const link = document.createElement("link");
				link.id = leafletCssId;
				link.rel = "stylesheet";
				link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
				document.head.appendChild(link);
			}

			const leaflet = await import("leaflet");
			if (cancelled || !mapContainerRef.current) return;

			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}

			const map = leaflet.map(mapContainerRef.current, {
				center: [markerLat, markerLon],
				zoom: 15,
				zoomControl: false,
				attributionControl: true,
			});

			leaflet
				.tileLayer(
					"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
					{
						attribution:
							'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
						subdomains: "abcd",
						maxZoom: 19,
					},
				)
				.addTo(map);

			leaflet
				.circleMarker([markerLat, markerLon], {
					radius: 8,
					color: "#c9a227",
					fillColor: "#d4af37",
					fillOpacity: 1,
					weight: 2,
				})
				.addTo(map);

			requestAnimationFrame(() => {
				map.invalidateSize();
			});

			mapRef.current = map;
		}

		void setupMap();

		return () => {
			cancelled = true;
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
		};
	}, [canShow, hasCoordinates, location]);

	if (!canShow || !location || !mapsUrl) return null;

	return (
		<div className="space-y-1.5">
			<Label>Location</Label>
			{hasCoordinates ? (
				<div
					className="h-48 w-full overflow-hidden rounded-md border border-border"
					ref={mapContainerRef}
				/>
			) : null}
			{address ? (
				<a
					className="flex items-start gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm transition-colors hover:bg-muted"
					href={mapsUrl}
					rel="noopener noreferrer"
					target="_blank"
				>
					<MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
					<span className="text-foreground">{address}</span>
				</a>
			) : (
				<a
					className="inline-flex items-center gap-2 text-muted-foreground text-sm underline-offset-4 hover:underline"
					href={mapsUrl}
					rel="noopener noreferrer"
					target="_blank"
				>
					<MapPin className="h-4 w-4" />
					Open in Maps
				</a>
			)}
		</div>
	);
}
