import { ImportPage } from "@moat/features/import";
import type React from "react";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { ImportAgentNote } from "./import-agent-note";

export default function DesktopImportPage(): React.ReactElement {
	return (
		<ImportPage
			extras={<ImportAgentNote />}
			onCapture={(event, props) => {
				captureWithCurrentIdentity(event, props);
				if (event !== "transaction_import_completed") return;
				captureWithCurrentIdentity("desktop_import_completed", {
					success: Boolean(props?.success),
					rowCount: typeof props?.imported === "number" ? props.imported : 0,
				});
			}}
		/>
	);
}
