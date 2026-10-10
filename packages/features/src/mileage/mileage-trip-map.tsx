"use client";

import type { MileageTrip } from "@moat/contracts";
import type { Polyline } from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { tripRouteSegments } from "./format";

const ACCENT = "#3d63de";

export function MileageTripMap({
	trips,
	selectedId,
	onSelect,
}: {
	trips: MileageTrip[];
	selectedId: string | null;
	onSelect: (tripId: string) => void;
}) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<{ remove: () => void } | null>(null);
	const linesRef = useRef<Map<string, Polyline[]>>(new Map());
	const onSelectRef = useRef(onSelect);
	const tripsRef = useRef(trips);
	const selectedIdRef = useRef(selectedId);
	onSelectRef.current = onSelect;
	tripsRef.current = trips;
	selectedIdRef.current = selectedId;

	const routeKey = useMemo(
		() =>
			trips
				.map((trip) => `${trip.id}:${trip.encodedPolylines.join("|")}`)
				.join(","),
		[trips],
	);

	useEffect(() => {
		if (!mapContainerRef.current) return;

		let cancelled = false;

		async function setupMap() {
			const currentTrips = tripsRef.current;
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
			linesRef.current = new Map();

			const map = leaflet.map(mapContainerRef.current, {
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

			const bounds = leaflet.latLngBounds([]);
			for (const trip of currentTrips) {
				const isSelected = trip.id === selectedIdRef.current;
				const lines: Polyline[] = [];
				for (const segment of tripRouteSegments(trip)) {
					if (segment.length < 2) continue;
					const latLngs = segment.map(
						(point) => [point.latitude, point.longitude] as [number, number],
					);
					const line = leaflet.polyline(latLngs, {
						color: ACCENT,
						weight: isSelected ? 5 : 3,
						opacity: isSelected ? 1 : 0.75,
					});
					line.on("click", () => onSelectRef.current(trip.id));
					line.addTo(map);
					bounds.extend(line.getBounds());
					lines.push(line);
				}
				if (lines.length > 0) {
					linesRef.current.set(trip.id, lines);
				}
			}

			if (bounds.isValid()) {
				map.fitBounds(bounds, { padding: [24, 24] });
			} else {
				map.setView([39.5, -98.35], 4);
			}

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
			linesRef.current = new Map();
		};
	}, [routeKey]);

	useEffect(() => {
		for (const [tripId, lines] of linesRef.current) {
			const isSelected = tripId === selectedId;
			for (const line of lines) {
				line.setStyle({
					weight: isSelected ? 5 : 3,
					opacity: isSelected ? 1 : 0.75,
				});
			}
		}
	}, [selectedId, routeKey]);

	if (trips.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No routes to show for this year yet.
			</p>
		);
	}

	return (
		<div
			className="h-[28rem] w-full overflow-hidden rounded-md border border-border"
			ref={mapContainerRef}
		/>
	);
}
