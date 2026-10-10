export function w2ExtractionJsonSchema(): Record<string, unknown> {
	const nullableString = { type: ["string", "null"] };
	const nullableNumber = { type: ["number", "null"] };
	const nullableBoolean = { type: ["boolean", "null"] };
	return {
		type: "object",
		additionalProperties: false,
		required: [
			"employerName",
			"employerEin",
			"employerAddress",
			"employeeName",
			"employeeSsn",
			"employeeAddress",
			"wages",
			"federalWithholding",
			"socialSecurityWages",
			"socialSecurityTax",
			"medicareWages",
			"medicareTax",
			"stateWages",
			"stateTax",
			"localWages",
			"localTax",
			"retirementPlan",
			"dependentCareBenefits",
			"box12",
			"box14",
		],
		properties: {
			employerName: nullableString,
			employerEin: nullableString,
			employerAddress: nullableString,
			employeeName: nullableString,
			employeeSsn: nullableString,
			employeeAddress: nullableString,
			wages: nullableNumber,
			federalWithholding: nullableNumber,
			socialSecurityWages: nullableNumber,
			socialSecurityTax: nullableNumber,
			medicareWages: nullableNumber,
			medicareTax: nullableNumber,
			stateWages: nullableNumber,
			stateTax: nullableNumber,
			localWages: nullableNumber,
			localTax: nullableNumber,
			retirementPlan: nullableBoolean,
			dependentCareBenefits: nullableNumber,
			box12: {
				type: ["array", "null"],
				items: {
					type: "object",
					additionalProperties: false,
					required: ["code", "amount"],
					properties: {
						code: { type: "string" },
						amount: nullableNumber,
					},
				},
			},
			box14: {
				type: ["array", "null"],
				items: {
					type: "object",
					additionalProperties: false,
					required: ["label", "amount"],
					properties: {
						label: { type: "string" },
						amount: nullableNumber,
					},
				},
			},
		},
	};
}
