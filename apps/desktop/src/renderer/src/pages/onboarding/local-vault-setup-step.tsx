import type { VaultStatus } from "@moat/contracts";
import type React from "react";
import { SetupLocalVault } from "../vault-unlock/setup-local-vault";

type LocalVaultSetupStepProps = {
	status: VaultStatus;
	onSetupComplete: () => void;
};

export function LocalVaultSetupStep({
	status,
	onSetupComplete,
}: LocalVaultSetupStepProps): React.ReactElement {
	return (
		<div className="mx-auto flex w-full justify-center">
			<SetupLocalVault
				onSetupComplete={onSetupComplete}
				showPlatformUnlockCopy={false}
				status={status}
			/>
		</div>
	);
}
