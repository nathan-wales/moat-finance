export type PolylinePoint = {
	latitude: number;
	longitude: number;
};

const DEFAULT_PRECISION = 5;

function encodeSigned(value: number): string {
	let chunk = value < 0 ? ~(value << 1) : value << 1;
	let encoded = "";
	while (chunk >= 0x20) {
		encoded += String.fromCharCode((0x20 | (chunk & 0x1f)) + 63);
		chunk >>= 5;
	}
	encoded += String.fromCharCode(chunk + 63);
	return encoded;
}

export function encodePolyline(
	points: readonly PolylinePoint[],
	precision = DEFAULT_PRECISION,
): string {
	if (points.length === 0) return "";

	const factor = 10 ** precision;
	let output = "";
	let previousLat = 0;
	let previousLng = 0;

	for (const point of points) {
		const lat = Math.round(point.latitude * factor);
		const lng = Math.round(point.longitude * factor);
		output += encodeSigned(lat - previousLat);
		output += encodeSigned(lng - previousLng);
		previousLat = lat;
		previousLng = lng;
	}

	return output;
}

export function decodePolyline(
	encoded: string,
	precision = DEFAULT_PRECISION,
): PolylinePoint[] {
	if (encoded.length === 0) return [];

	const factor = 10 ** precision;
	const points: PolylinePoint[] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;

	function readSignedDelta(): number | null {
		let result = 0;
		let shift = 0;
		let byte = 0;
		do {
			if (index >= encoded.length) return null;
			byte = encoded.charCodeAt(index) - 63;
			index += 1;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		return (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
	}

	while (index < encoded.length) {
		const deltaLat = readSignedDelta();
		if (deltaLat === null) break;
		lat += deltaLat;

		const deltaLng = readSignedDelta();
		if (deltaLng === null) break;
		lng += deltaLng;

		points.push({
			latitude: lat / factor,
			longitude: lng / factor,
		});
	}

	return points;
}

export function decodePolylines(
	encodedPolylines: readonly string[],
): PolylinePoint[][] {
	return encodedPolylines
		.map((encoded) => decodePolyline(encoded))
		.filter((segment) => segment.length > 0);
}
