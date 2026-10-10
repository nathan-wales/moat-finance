"use client";

import {
	getConnectedInstitutions,
	reorderPlaidItems,
	setPlaidAccountHidden,
	setPlaidAccountSyncEnabled,
} from "@moat/client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AnimatePresence,
	motion,
	Reorder,
	useDragControls,
} from "framer-motion";
import {
	AlertCircle,
	Building2,
	EyeOff,
	LayoutGrid,
	MoreHorizontal,
	Pause,
	Table2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	type InstitutionData,
	InstitutionRow,
} from "~/components/plaid/institution-row";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardHeader } from "~/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

const VIEW_MODE_KEY = "accounts-view-mode";

type ViewMode = "cards" | "table";

// ─── Per-item reorder wrapper ─────────────────────────────────────────────────
// useDragControls must be called per-item, so we extract a wrapper component

function ReorderItem({ institution }: { institution: InstitutionData }) {
	const controls = useDragControls();
	return (
		<Reorder.Item
			as="div"
			dragControls={controls}
			dragListener={false}
			value={institution}
		>
			<InstitutionRow dragControls={controls} institution={institution} />
		</Reorder.Item>
	);
}

// ─── Table view ───────────────────────────────────────────────────────────────

function formatCurrency(amount?: number | null, currency?: string): string {
	if (amount == null) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency ?? "USD",
	}).format(amount);
}

function formatAccountType(type: string, subtype?: string | null): string {
	const label = subtype ?? type;
	return label
		.split("_")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}

function AccountActionsMenu({
	accountId,
	accountName,
	accountHidden,
	syncEnabled,
}: {
	accountId: string;
	accountName: string;
	accountHidden: boolean;
	syncEnabled: boolean;
}) {
	const queryClient = useQueryClient();
	const toggle = useMutation({
		mutationFn: async (hidden: boolean) => {
			const response = await setPlaidAccountHidden({ accountId, hidden });
			if (response.status !== 200) throw new Error("Failed to update account");
			return response.data.data;
		},
		onSuccess: (_data, hidden) => {
			toast.success(
				hidden
					? `${accountName} is now hidden`
					: `${accountName} is now visible`,
			);
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			void queryClient.invalidateQueries({ queryKey: ["transactions"] });
			void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
		},
		onError: () => toast.error("Failed to update account visibility"),
	});
	const resumeSync = useMutation({
		mutationFn: async () => {
			const response = await setPlaidAccountSyncEnabled({
				accountId,
				syncEnabled: true,
			});
			if (response.status !== 200)
				throw new Error("Failed to resume account sync");
			return response.data.data;
		},
		onSuccess: () => {
			toast.success(`${accountName} sync resumed`);
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			void queryClient.invalidateQueries({ queryKey: ["transactions"] });
			void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
			void queryClient.invalidateQueries({
				queryKey: ["financialProfileData", "get"],
			});
		},
		onError: () => toast.error("Failed to resume account sync"),
	});
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					className="h-7 w-7 p-0"
					disabled={toggle.isPending || resumeSync.isPending}
					size="sm"
					variant="ghost"
				>
					<MoreHorizontal className="h-4 w-4" />
					<span className="sr-only">Account options</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => toggle.mutate(!accountHidden)}>
					{accountHidden ? "Unhide account" : "Hide account"}
				</DropdownMenuItem>
				{syncEnabled ? null : (
					<DropdownMenuItem onClick={() => resumeSync.mutate()}>
						Resume sync
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function InstitutionsTableView({
	institutions,
}: {
	institutions: InstitutionData[];
}) {
	return (
		<div className="rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[190px]">Bank</TableHead>
						<TableHead>Account</TableHead>
						<TableHead className="w-[120px]">Type</TableHead>
						<TableHead className="w-[140px] text-right">Balance</TableHead>
						<TableHead className="w-[170px]">Status</TableHead>
						<TableHead className="w-[50px]" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{institutions.flatMap((institution, instIdx) => {
						const needsRelink = institution.accessRevoked === true;
						const isLast = instIdx === institutions.length - 1;

						const statusBadge =
							institution.requiresReconnect || needsRelink ? (
								<Badge className="text-xs" variant="destructive">
									Reconnect required
								</Badge>
							) : (
								<Badge
									className="border-green-500/40 text-green-600 text-xs"
									variant="outline"
								>
									Connected
								</Badge>
							);

						if (institution.accounts.length === 0) {
							return [
								<TableRow key={institution.id}>
									<TableCell className="font-medium">
										<div className="flex items-center gap-2">
											<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
												<Building2 className="h-3 w-3 text-primary" />
											</span>
											{institution.institutionName}
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										No accounts
									</TableCell>
									<TableCell />
									<TableCell />
									<TableCell>{statusBadge}</TableCell>
									<TableCell />
								</TableRow>,
							];
						}

						return institution.accounts.map((account, idx) => {
							const isLastAccount = idx === institution.accounts.length - 1;
							const isHidden = account.accountHidden === true;
							const isSyncOff = account.syncEnabled === false;
							return (
								<TableRow
									className={cn(
										isLastAccount && !isLast && "border-b-2 border-b-border/50",
										isHidden && "opacity-50",
									)}
									key={account.id}
								>
									<TableCell>
										{idx === 0 ? (
											<div className="flex items-center gap-2 font-medium">
												<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
													<Building2 className="h-3 w-3 text-primary" />
												</span>
												{institution.institutionName}
											</div>
										) : null}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-1.5">
											<span className="font-medium text-sm">
												{account.name}
											</span>
											{account.mask && (
												<span className="text-muted-foreground text-xs">
													••{account.mask}
												</span>
											)}
											{account.isActive === false && (
												<Badge className="text-xs" variant="secondary">
													Inactive
												</Badge>
											)}
											{isHidden && (
												<Badge
													className="border-muted-foreground/30 text-muted-foreground text-xs"
													variant="outline"
												>
													<EyeOff className="mr-1 h-3 w-3" />
													Hidden
												</Badge>
											)}
											{isSyncOff && (
												<Badge
													className="border-muted-foreground/30 text-muted-foreground text-xs"
													variant="outline"
												>
													<Pause className="mr-1 h-3 w-3" />
													Sync off
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell>
										<span className="text-muted-foreground text-sm">
											{formatAccountType(account.type, account.subtype)}
										</span>
									</TableCell>
									<TableCell className="text-right font-semibold tabular-nums">
										{formatCurrency(account.currentBalance, account.currency)}
									</TableCell>
									<TableCell>{idx === 0 ? statusBadge : null}</TableCell>
									<TableCell className="text-right">
										<AccountActionsMenu
											accountHidden={isHidden}
											accountId={account.id}
											accountName={account.name}
											syncEnabled={!isSyncOff}
										/>
									</TableCell>
								</TableRow>
							);
						});
					})}
				</TableBody>
			</Table>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConnectedInstitutionsList() {
	const [viewMode, setViewMode] = useState<ViewMode>(() => {
		if (typeof window === "undefined") return "cards";
		const saved = localStorage.getItem(VIEW_MODE_KEY);
		return saved === "table" ? "table" : "cards";
	});
	const [order, setOrder] = useState<string[]>([]);
	const saveOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { data, isLoading, error } = useQuery({
		queryKey: ["plaid", "getConnectedInstitutions"],
		queryFn: async () => {
			const response = await getConnectedInstitutions();
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load institutions");
			}
			return response.data.data;
		},
	});

	const institutions = (data ?? []) as InstitutionData[];

	const handleViewModeChange = useCallback((mode: ViewMode) => {
		setViewMode(mode);
		localStorage.setItem(VIEW_MODE_KEY, mode);
	}, []);

	const handleReorder = useCallback((newOrder: InstitutionData[]) => {
		const newIds = newOrder.map((i) => i.id);
		setOrder(newIds);
		if (saveOrderTimerRef.current) {
			clearTimeout(saveOrderTimerRef.current);
		}
		saveOrderTimerRef.current = setTimeout(() => {
			reorderPlaidItems({ orderedIds: newIds }).catch(() => {
				// silently fail — order is still reflected in UI
			});
		}, 500);
	}, []);

	useEffect(() => {
		return () => {
			if (saveOrderTimerRef.current) {
				clearTimeout(saveOrderTimerRef.current);
			}
		};
	}, []);

	// Derive ordered list from server data + user drag order — no useEffect needed
	const orderedInstitutions = useMemo(() => {
		if (order.length === 0) return institutions;
		const dataMap = new Map(institutions.map((i) => [i.id, i]));
		const preserved = order
			.filter((id) => dataMap.has(id))
			.map((id) => dataMap.get(id) as InstitutionData);
		const newItems = institutions.filter((i) => !order.includes(i.id));
		return [...preserved, ...newItems];
	}, [institutions, order]);

	if (isLoading) {
		return (
			<div className="space-y-3">
				{[1, 2].map((i) => (
					<Card key={i}>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-3">
								<Skeleton className="h-9 w-9 rounded-full" />
								<div className="space-y-1.5">
									<Skeleton className="h-4 w-36" />
									<Skeleton className="h-3 w-24" />
								</div>
							</div>
						</CardHeader>
					</Card>
				))}
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					Failed to load connected institutions. Please refresh.
				</AlertDescription>
			</Alert>
		);
	}

	if (institutions.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center">
				<Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
				<p className="font-medium text-muted-foreground text-sm">
					No institutions connected yet
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Connect a bank account to automatically import transactions.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-end gap-3">
				<div className="flex items-center gap-1 rounded-md border p-1">
					<Button
						className="h-7 gap-1.5 px-2.5 text-xs"
						onClick={() => handleViewModeChange("cards")}
						size="sm"
						variant={viewMode === "cards" ? "secondary" : "ghost"}
					>
						<LayoutGrid className="h-3.5 w-3.5" />
						Cards
					</Button>
					<Button
						className="h-7 gap-1.5 px-2.5 text-xs"
						onClick={() => handleViewModeChange("table")}
						size="sm"
						variant={viewMode === "table" ? "secondary" : "ghost"}
					>
						<Table2 className="h-3.5 w-3.5" />
						Table
					</Button>
				</div>
			</div>

			<AnimatePresence mode="wait">
				{viewMode === "cards" ? (
					<motion.div
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						initial={{ opacity: 0 }}
						key="cards"
						transition={{ duration: 0.15 }}
					>
						<Reorder.Group
							as="div"
							axis="y"
							className="space-y-3"
							onReorder={(newOrder) =>
								handleReorder(newOrder as InstitutionData[])
							}
							values={orderedInstitutions}
						>
							{orderedInstitutions.map((institution) => (
								<ReorderItem institution={institution} key={institution.id} />
							))}
						</Reorder.Group>
					</motion.div>
				) : (
					<motion.div
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						initial={{ opacity: 0 }}
						key="table"
						transition={{ duration: 0.15 }}
					>
						<InstitutionsTableView institutions={orderedInstitutions} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
