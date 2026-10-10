import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodePolyline, encodePolyline } from "./polyline";

describe("encoded polyline", () => {
	it("round-trips coordinates without connecting separate segments", () => {
		const points = [
			{ latitude: 40.0, longitude: -105.0 },
			{ latitude: 40.01, longitude: -105.02 },
			{ latitude: 40.02, longitude: -105.03 },
		];
		const encoded = encodePolyline(points);
		const decoded = decodePolyline(encoded);
		assert.equal(decoded.length, points.length);
		for (const [index, point] of points.entries()) {
			const actual = decoded[index];
			assert.ok(actual);
			assert.ok(Math.abs(actual.latitude - point.latitude) < 0.0001);
			assert.ok(Math.abs(actual.longitude - point.longitude) < 0.0001);
		}
	});

	it("encodes an empty path as an empty string", () => {
		assert.equal(encodePolyline([]), "");
		assert.deepEqual(decodePolyline(""), []);
	});

	it("stops decoding when the payload is truncated", () => {
		const encoded = encodePolyline([
			{ latitude: 40.0, longitude: -105.0 },
			{ latitude: 40.01, longitude: -105.02 },
		]);
		assert.ok(encoded.length > 2);
		const decoded = decodePolyline(encoded.slice(0, 2));
		assert.ok(decoded.length <= 1);
	});
});
