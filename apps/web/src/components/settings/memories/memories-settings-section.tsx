"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { getMemorySettings, setMemoryEnabled } from "~/lib/api/memories";
import { MemoryList } from "./memory-list";

export function MemoriesSettingsSection() {
	const queryClient = useQueryClient();

	const { data: settingsData } = useQuery({
		queryKey: ["memory-settings"],
		queryFn: getMemorySettings,
	});

	const memoryEnabled = settingsData?.memoryEnabled ?? true;

	const toggleMutation = useMutation({
		mutationFn: (enabled: boolean) => setMemoryEnabled({ enabled }),
		onSuccess: (data) => {
			void queryClient.setQueryData(["memory-settings"], data);
			toast.success(data.memoryEnabled ? "Memory enabled" : "Memory disabled");
		},
		onError: () => toast.error("Failed to update memory setting"),
	});

	return (
		<div className="space-y-6">
			<Button asChild size="sm" variant="ghost">
				<Link href="/ai-access">← Back</Link>
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
