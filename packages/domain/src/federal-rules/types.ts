export type RuleAgency = "IRS" | "SSA" | "CMS";

export type RuleAuthority = {
	agency: RuleAgency;
	document: string;
	publishedYear: number;
};

export type OfficialRuleRow<T extends Record<string, unknown>> = T & {
	authority: RuleAuthority;
};

export type ResolvedStatus = "official" | "estimated";

export type ResolvedAmount = {
	amount: number;
	status: ResolvedStatus;
	taxYear: number;
	basisYear: number;
	authority: RuleAuthority | null;
};

export type RetirementFilingStatus =
	| "single"
	| "marriedJoint"
	| "marriedSeparate"
	| "headOfHousehold";

export type TaxBracket = {
	/** Upper bound of taxable income for this bracket; Infinity for the top. */
	upTo: number;
	rate: number;
};

export type MagiPhaseout = {
	/** Inclusive floor of the phaseout range. */
	start: number;
	/** Inclusive ceiling; contributions are $0 above this. */
	end: number;
};

export type ContributionLimits = {
	employee401k: number;
	employee401kCatchUp: number;
	employee401kSuperCatchUp: number;
	ira: number;
	iraCatchUp: number;
	hsaSelf: number;
	hsaFamily: number;
	hsaCatchUp: number;
};
