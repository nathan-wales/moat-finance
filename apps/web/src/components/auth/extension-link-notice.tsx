import { Puzzle } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";

type ExtensionLinkNoticeProps = {
	message: string;
};

export function ExtensionLinkNotice({ message }: ExtensionLinkNoticeProps) {
	return (
		<Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-400/30 dark:bg-blue-950/40 dark:text-blue-100 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-300">
			<Puzzle className="h-4 w-4" />
			<AlertDescription className="text-blue-900 dark:text-blue-100">
				{message}
			</AlertDescription>
		</Alert>
	);
}
