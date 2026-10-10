import { UNIFORM_LIFETIME_TABLE } from "./constants";

const TABLE_AGES = Object.keys(UNIFORM_LIFETIME_TABLE)
	.map(Number)
	.sort((a, b) => a - b);

function divisorForAge(age: number): number {
	const first = TABLE_AGES[0];
	const last = TABLE_AGES[TABLE_AGES.length - 1];
	if (first === undefined || last === undefined) return 0;
	if (age <= first) return UNIFORM_LIFETIME_TABLE[first] ?? 0;
	const exact = UNIFORM_LIFETIME_TABLE[age];
	if (exact !== undefined) return exact;
	let floorAge = first;
	for (const tableAge of TABLE_AGES) {
		if (tableAge > age) break;
		floorAge = tableAge;
	}
	return UNIFORM_LIFETIME_TABLE[floorAge] ?? UNIFORM_LIFETIME_TABLE[last] ?? 0;
}

/**
 * Required minimum distribution from tax-deferred balances, using the IRS
 * Uniform Lifetime Table. Returns 0 before the statutory start age.
 */
export function requiredMinimumDistribution(input: {
	age: number;
	balance: number;
	rmdStartAge: number;
}): number {
	if (input.age < input.rmdStartAge) return 0;
	if (input.balance <= 0) return 0;
	const divisor = divisorForAge(input.age);
	if (divisor <= 0) return input.balance;
	return Math.min(input.balance, input.balance / divisor);
}
