"use client";

import { WhatIfPage as SharedWhatIfPage } from "@moat/features";
import { useEffect } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function WhatIfPage() {
	useEffect(() => {
		captureWithCurrentIdentity("what_if_viewed");
	}, []);

	return (
		<SharedWhatIfPage
			onCapture={(event, properties) =>
				captureWithCurrentIdentity(event, properties)
			}
			onNotify={(message, type) =>
				type === "error" ? toast.error(message) : toast.success(message)
			}
		/>
	);
}
