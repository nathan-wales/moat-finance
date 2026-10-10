import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isNonRealEstateProfileAsset,
	loadNetWorthOtherAssets,
	parseProfileAssets,
	parseProfileLiabilities,
	yearsOwnedFromPurchaseDate,
} from "../assets";

describe("MCP assets helpers", () => {
	it("parses profile assets and excludes invalid rows", () => {
		const assets = parseProfileAssets([
			{
				id: "asset-car",
				name: "Honda",
				type: "Vehicle",
				estimatedValue: 18_000,
				includeInNetWorth: true,
				includeInForecast: false,
			},
			{ id: "bad", name: "x" },
		]);
		assert.equal(assets.length, 1);
		assert.equal(assets[0]?.type, "Vehicle");
	});

	it("treats only non-real-estate types as listAssets inventory", () => {
		assert.equal(
			isNonRealEstateProfileAsset({
				id: "1",
				name: "Car",
				type: "Vehicle",
				estimatedValue: 1,
				includeInNetWorth: true,
				includeInForecast: false,
			}),
			true,
		);
		assert.equal(
			isNonRealEstateProfileAsset({
				id: "2",
				name: "Home",
				type: "Real estate",
				estimatedValue: 1,
				includeInNetWorth: true,
				includeInForecast: false,
			}),
			false,
		);
	});

	it("computes yearsOwned from purchaseDate", () => {
		assert.equal(
			yearsOwnedFromPurchaseDate(
				new Date("2020-01-01T00:00:00.000Z"),
				new Date("2026-01-01T00:00:00.000Z"),
			),
			6,
		);
		assert.equal(yearsOwnedFromPurchaseDate(null), null);
	});

	it("loads net-worth other assets excluding real estate rows", () => {
		const other = loadNetWorthOtherAssets([
			{
				id: "asset-car",
				name: "Honda",
				type: "Vehicle",
				estimatedValue: 18_000,
				includeInNetWorth: true,
				includeInForecast: false,
			},
			{
				id: "asset-boat",
				name: "Boat",
				type: "Boat",
				estimatedValue: 40_000,
				includeInNetWorth: false,
				includeInForecast: false,
			},
			{
				id: "real-estate-abc",
				name: "Home",
				type: "Real estate",
				estimatedValue: 500_000,
				includeInNetWorth: true,
				includeInForecast: true,
			},
		]);
		assert.deepEqual(other, [
			{
				id: "asset-car",
				name: "Honda",
				type: "Vehicle",
				estimatedValue: 18_000,
			},
		]);
	});

	it("matches profile liabilities by name for loan enrichment", () => {
		const liabilities = parseProfileLiabilities([
			{ id: "liab-1", name: "Auto loan", balance: 9_000 },
			{ id: "bad" },
		]);
		assert.equal(liabilities.length, 1);
		assert.equal(liabilities[0]?.balance, 9_000);
	});
});
