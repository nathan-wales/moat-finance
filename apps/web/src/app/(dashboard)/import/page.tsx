import { redirect } from "next/navigation";

export default function ImportRedirectPage() {
	redirect("/transactions/import");
}
