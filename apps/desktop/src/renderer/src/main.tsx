import React from "react";
import ReactDOM from "react-dom/client";
import { DesktopShell } from "./desktop-shell";
import { initPostHog } from "./lib/posthog";
import { initAppearance } from "./lib/stores/appearance-store";
import "./styles.css";

initAppearance();
initPostHog();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<DesktopShell />
	</React.StrictMode>,
);
