import type {
	CreateRealEstateInvestmentInput,
	RealEstateInvestment,
	UpdateRealEstateInvestmentInput,
} from "../types";

export interface RealEstateRepository {
	list(input: { userId: string }): Promise<RealEstateInvestment[]>;
	create(
		input: { userId: string } & CreateRealEstateInvestmentInput,
	): Promise<RealEstateInvestment>;
	update(input: {
		userId: string;
		id: string;
		data: UpdateRealEstateInvestmentInput;
	}): Promise<RealEstateInvestment>;
	delete(input: { userId: string; id: string }): Promise<void>;
}
