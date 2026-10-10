import { useEffect } from "react";
import { identify, setAnalyticsIdentity } from "../analytics";
import { isPostHogInitialized } from "../posthog";
import { useCloudAccountIdentity } from "./use-cloud-account";

export function useDesktopAnalyticsIdentity(): void {
	const { data: identity } = useCloudAccountIdentity();

	useEffect(() => {
		if (!isPostHogInitialized()) return;

		if (identity?.signedIn === true && identity.userId) {
			setAnalyticsIdentity({ userId: identity.userId });
			identify(identity.userId, identity.email);
			return;
		}

		setAnalyticsIdentity({ demoUser: true });
	}, [identity]);
}
