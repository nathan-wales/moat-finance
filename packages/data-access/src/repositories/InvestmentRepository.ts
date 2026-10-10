import type {
	ApplyInvestmentAccrualInput,
	ApplyInvestmentAccrualsInput,
	CreateInvestmentInput,
	Investment,
	UpdateInvestmentInput,
} from "../types";

export interface InvestmentRepository {
	list(input: { userId: string }): Promise<Investment[]>;
	create(input: { userId: string } & CreateInvestmentInput): Promise<Investment>;
	update(input: {
		userId: string;
		id: string;
		data: UpdateInvestmentInput;
	}): Promise<Investment>;
	delete(input: { userId: string; id: string }): Promise<void>;
	listDueForUser(input: { userId: string; now: Date }): Promise<Investment[]>;
	listDueForAccrual(input: { now: Date; take: number }): Promise<Investment[]>;
	applyAccrual(input: ApplyInvestmentAccrualInput): Promise<Investment>;
	applyAccruals(input: ApplyInvestmentAccrualsInput): Promise<Investment>;
}
