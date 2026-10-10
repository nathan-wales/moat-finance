import type { MileageTrip } from "@moat/contracts";
import { metersToMiles } from "@moat/domain/federal-rules";
import { decodePolylines } from "@moat/domain/mileage";

export function formatMiles(distanceMeters: number): string {
	return `${metersToMiles(distanceMeters).toFixed(1)} mi`;
}

export function formatDeduction(cents: number): string {
	return (cents / 100).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
}

export function formatTripDate(value: string): string {
	return new Date(value).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatTripDateTime(value: string): string {
	return new Date(value).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = seconds % 60;
	return [hours, minutes, remainder]
		.map((part) => String(part).padStart(2, "0"))
		.join(":");
}

export function tripRouteSegments(trip: MileageTrip) {
	return decodePolylines(trip.encodedPolylines);
}
