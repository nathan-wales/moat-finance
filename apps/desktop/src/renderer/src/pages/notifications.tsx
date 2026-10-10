import { useMoatNavigation } from "@moat/features";
import { NotificationsPage } from "@moat/features/notifications";
import type React from "react";
import { captureWithCurrentIdentity } from "../lib/analytics";

export default function DesktopNotificationsPage(): React.ReactElement {
	const nav = useMoatNavigation();

	return (
		<NotificationsPage
			onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
			onNotify={() => undefined}
			openAiAccess={() => nav.push("/ai-access")}
		/>
	);
}
