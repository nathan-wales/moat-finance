import { useMoatNavigation } from "@moat/features";
import { Button, Label, Switch } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { toast } from "sonner";
import { MemoryList } from "./memory-list";

export default function DesktopMemoriesPage(): React.ReactElement {
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();

	const { data: settingsData } = useQuery({
		queryKey: ["memory-settings"],
		queryFn: () => window.moatDesktop.memories.getSettings(),
	});

	const memoryEnabled = settingsData?.memoryEnabled ?? true;

	const toggleMutation = useMutation({
		mutationFn: (enabled: boolean) =>
			window.moatDesktop.memories.setMemoryEnabled({ enabled }),
		onSuccess: (data) => {
			void queryClient.setQueryData(["memory-settings"], data);
			toast.success(data.memoryEnabled ? "Memory enabled" : "Memory disabled");
		},
		onError: () => toast.error("Failed to update memory setting"),
	});

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<Button
				onClick={() => nav.push("/mcp")}
				size="sm"
				type="button"
				variant="ghost"
			>
				← Back
			</Button>
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl">Memories</h1>
					<p className="text-muted-foreground text-sm">
						Manage what the agent remembers about your financial life.
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2 pt-1">
					<Label className="whitespace-nowrap text-sm" htmlFor="memory-toggle">
						Enable memory
					</Label>
					<Switch
						checked={memoryEnabled}
						disabled={toggleMutation.isPending}
						id="memory-toggle"
						onCheckedChange={(checked) => toggleMutation.mutate(checked)}
					/>
				</div>
			</div>

			<MemoryList disabled={!memoryEnabled} />
		</div>
	);
}
