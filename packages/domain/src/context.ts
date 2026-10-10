import type {
	AccountRepository,
	AiReportRepository,
	BudgetRepository,
	CategoryRepository,
	DashboardRepository,
	FinancialProfileDataRepository,
	FinancialProfileRepository,
	ForecastRepository,
	ImportMappingTemplateRepository,
	InvestmentRepository,
	MemoryRepository,
	PlaidAccountRepository,
	PlaidItemRepository,
	RealEstateRepository,
	RetailRepository,
	RetirementRepository,
	RuleRepository,
	TaxRepository,
	TransactionRepository,
	UserMetadataRepository,
} from "@moat/data-access";

/**
 * AppContext carries the current user identity and all repository
 * implementations. Domain service functions accept this as their first
 * argument, keeping them free from HTTP, Electron, or database concerns.
 *
 * apps/api creates an AppContext backed by Postgres (via packages/db-postgres).
 * apps/desktop will create one backed by SQLite.
 */
export type AppContext = {
	userId: string;
	repositories: {
		transactions: TransactionRepository;
		accounts: AccountRepository;
		dashboard: DashboardRepository;
		budgets: BudgetRepository;
		rules: RuleRepository;
		forecasts: ForecastRepository;
		categories?: CategoryRepository;
		financialProfile?: FinancialProfileRepository;
		financialProfileData?: FinancialProfileDataRepository;
		plaidItems?: PlaidItemRepository;
		plaidAccounts?: PlaidAccountRepository;
		investments?: InvestmentRepository;
		realEstate?: RealEstateRepository;
		retail?: RetailRepository;
		retirement?: RetirementRepository;
		taxes?: TaxRepository;
		memories?: MemoryRepository;
		importMappingTemplates?: ImportMappingTemplateRepository;
		userMetadata?: UserMetadataRepository;
		reports?: AiReportRepository;
	};
};
