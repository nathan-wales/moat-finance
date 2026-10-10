import { registerAccountHandlers } from "./accounts";
import { registerAiAccessHandlers } from "./ai-access";
import { registerAppearanceHandlers } from "./appearance";
import { registerBudgetHandlers } from "./budget";
import { registerCategoryHandlers } from "./categories";
import { registerClientLogHandlers } from "./client-log";
import { registerCloudBackupHandlers } from "./cloud-backup";
import { registerDesktopUpdateHandlers } from "./desktop-updates";
import { registerFeedbackHandlers } from "./feedback";
import { registerFinancialProfileDataHandlers } from "./financial-profile-data";
import { registerImportHandlers } from "./import";
import { registerInsightsHandlers } from "./insights";
import { registerInvestmentHandlers } from "./investments";
import { registerLocalDbHandlers } from "./local-db";
import { registerMemoryHandlers } from "./memories";
import { registerNotificationHandlers } from "./notifications";
import { registerOnboardingHandlers } from "./onboarding";
import { registerOverviewHandlers } from "./overview";
import { registerPlaidHandlers } from "./plaid";
import { registerProfileHandlers } from "./profiles";
import { registerPromptHandlers } from "./prompts";
import { registerRealEstateHandlers } from "./real-estate";
import { registerRemoteMcpHandlers } from "./remote-mcp";
import { registerReportHandlers } from "./reports";
import { registerRetailSyncHandlers } from "./retail-sync";
import { registerRetirementHandlers } from "./retirement";
import { registerRuleHandlers } from "./rules";
import { registerScenarioHandlers } from "./scenarios";
import { registerSettingsHandlers } from "./settings";
import { registerSetupGuideHandlers } from "./setup-guide";
import { registerSpendingHandlers } from "./spending";
import { registerTaxHandlers } from "./taxes";
import { registerTransactionHandlers } from "./transactions";
import { registerVaultHandlers } from "./vault";

/**
 * Registers all IPC handlers for the desktop app.
 *
 * Call once from apps/desktop/src/main/index.ts before creating the window.
 */
export function registerAllHandlers(): void {
	registerVaultHandlers();
	registerAppearanceHandlers();
	registerCloudBackupHandlers();
	registerDesktopUpdateHandlers();
	registerProfileHandlers();
	registerLocalDbHandlers();
	registerOverviewHandlers();
	registerTransactionHandlers();
	registerBudgetHandlers();
	registerCategoryHandlers();
	registerSpendingHandlers();
	registerInsightsHandlers();
	registerRuleHandlers();
	registerNotificationHandlers();
	registerScenarioHandlers();
	registerAccountHandlers();
	registerSettingsHandlers();
	registerSetupGuideHandlers();
	registerImportHandlers();
	registerAiAccessHandlers();
	registerPlaidHandlers();
	registerInvestmentHandlers();
	registerRealEstateHandlers();
	registerRetailSyncHandlers();
	registerRetirementHandlers();
	registerTaxHandlers();
	registerFinancialProfileDataHandlers();
	registerFeedbackHandlers();
	registerClientLogHandlers();
	registerMemoryHandlers();
	registerOnboardingHandlers();
	registerRemoteMcpHandlers();
	registerReportHandlers();
	registerPromptHandlers();
}
