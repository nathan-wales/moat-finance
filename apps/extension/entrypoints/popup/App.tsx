import "./style.css";
import { ExtensionToaster } from "../../components/extension-toaster";
import { RetailSyncHome } from "../../components/retail-sync-home";

export default function App() {
	return (
		<>
			<RetailSyncHome surface="popup" />
			<ExtensionToaster />
		</>
	);
}
