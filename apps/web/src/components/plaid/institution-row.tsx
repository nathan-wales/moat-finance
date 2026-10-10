"use client";

import { disconnectPlaidItem } from "@moat/client-ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, type DragControls, motion } from "framer-motion";
import {
	AlertCircle,
	Building2,
	ChevronDown,
	ChevronUp,
	GripVertical,
	Trash2,
	Unlink,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccountCard } from "~/components/plaid/account-card";
import { DirectPlaidConnectLauncher } from "~/components/plaid/direct-plaid-connect-launcher";
import { InstitutionActionsMenu } from "~/components/plaid/institution-actions-menu";
import { ReconnectBankButton } from "~/components/plaid/reconnect-bank-button";
import { SyncButton } from "~/components/plaid/sync-button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";

export interface AccountSummary {
	id: string;
	plaidAccountId?: string;
	name: string;
	officialName?: string | null;
	mask?: string | null;
	type: string;
	subtype?: string | null;
	currentBalance?: number | null;
	availableBalance?: number | null;
	currency?: string;
	monthlyContribution?: number;
	annualReturnRate?: number;
	isActive?: boolean;
	investmentHidden?: boolean;
	accountHidden?: boolean;
	syncEnabled?: boolean;
	lastBalanceSyncAt?: string | Date | null;
}

export interface InstitutionData {
	id: string;
	plaidItemId: string;
	institutionId?: string | null;
	institutionName: string;
	requiresReconnect?: boolean;
	accessRevoked?: boolean;
	lastErrorCode?: string | null;
	lastErrorMessage?: string | null;
	lastSyncAt?: string | Date | null;
	lastSuccessfulSyncAt?: string | Date | null;
	lastTransactionSyncAt?: string | Date | null;
	lastBalanceSyncAt?: string | Date | null;
	lastRealtimeBalanceSyncAt?: string | Date | null;
	createdAt?: string | Date;
	accounts: AccountSummary[];
}

interface InstitutionRowProps {
	institution: InstitutionData;
	dragControls?: DragControls;
}

export function InstitutionRow({
	institution,
	dragControls,
}: InstitutionRowProps) {
	const [expanded, setExpanded] = useState(true);
	const [disconnectOpen, setDisconnectOpen] = useState(false);
	const [relinkOpen, setRelinkOpen] = useState(false);
	const queryClient = useQueryClient();

	const disconnect = useMutation({
		mutationFn: async (input: { itemId: string }) => {
			const response = await disconnectPlaidItem(input);
			if (response.status !== 200) {
				throw new Error("Failed to disconnect");
			}
			return response.data.data;
		},
		onSuccess: () => {
			toast.success(`Disconnected ${institution.institutionName}`);
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			setDisconnectOpen(false);
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Disconnect failed"),
	});

	const lastTransactionSync =
		institution.lastTransactionSyncAt ??
		institution.lastSuccessfulSyncAt ??
		institution.lastSyncAt;
	const lastBalanceSync = institution.lastBalanceSyncAt;
	const needsRelink = institution.accessRevoked === true;
	const balanceStaleMs = 48 * 60 * 60 * 1000;
	const isBalanceStale =
		!lastBalanceSync ||
		Date.now() - new Date(lastBalanceSync).getTime() > balanceStaleMs;

	function formatSyncAge(value?: string | Date | null) {
		if (!value) return null;
		return formatDistanceToNow(new Date(value), { addSuffix: true });
	}

	return (
		<>
			<Card
				className={
					institution.requiresReconnect || needsRelink
						? "border-destructive/50"
						: ""
				}
			>
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between gap-3">
						<div className="flex min-w-0 items-center gap-2">
							{dragControls && (
								<button
									aria-label="Drag to reorder"
									className="cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
									onPointerDown={(e) => dragControls.start(e)}
									type="button"
								>
									<GripVertical className="h-4 w-4" />
								</button>
							)}
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
								<Building2 className="h-4 w-4 text-primary" />
							</div>
							<div className="min-w-0">
								<CardTitle className="truncate text-lg">
									{institution.institutionName}
								</CardTitle>
								<p className="text-muted-foreground text-xs">
									{institution.accounts.length}{" "}
									{institution.accounts.length === 1 ? "account" : "accounts"}
									{lastTransactionSync && (
										<>
											{" · "}
											Transactions synced {formatSyncAge(lastTransactionSync)}
										</>
									)}
									{institution.lastRealtimeBalanceSyncAt && (
										<>
											{" · "}
											Live balance{" "}
											{formatSyncAge(institution.lastRealtimeBalanceSyncAt)}
										</>
									)}
									{lastBalanceSync ? (
										<>
											{" · "}
											<span
												className={
													isBalanceStale
														? "text-amber-600 dark:text-amber-500"
														: ""
												}
											>
												Balances updated {formatSyncAge(lastBalanceSync)}
												{isBalanceStale ? " (may be stale)" : ""}
											</span>
										</>
									) : (
										<>
											{" · "}
											<span className="text-amber-600 dark:text-amber-500">
												Balances not yet synced
											</span>
										</>
									)}
								</p>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							{institution.requiresReconnect || needsRelink ? (
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
							)}
							<button
								aria-label={expanded ? "Collapse accounts" : "Expand accounts"}
								className="text-muted-foreground transition-colors hover:text-foreground"
								onClick={() => setExpanded((v) => !v)}
								type="button"
							>
								{expanded ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</button>
						</div>
					</div>
				</CardHeader>

				<AnimatePresence initial={false}>
					{expanded && (
						<motion.div
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							initial={{ height: 0, opacity: 0 }}
							style={{ overflow: "hidden" }}
							transition={{ duration: 0.2, ease: "easeInOut" }}
						>
							<CardContent className="space-y-3">
								{(institution.requiresReconnect || needsRelink) && (
									<Alert className="py-2" variant="destructive">
										<AlertCircle className="h-4 w-4" />
										<AlertDescription className="text-sm">
											{needsRelink
												? "Bank access for this institution was removed. Link it again to resume sync."
												: "Your credentials need to be updated. Please reconnect this institution to continue syncing."}
											{institution.lastErrorMessage && (
												<span className="mt-1 block text-xs opacity-80">
													{institution.lastErrorMessage}
												</span>
											)}
										</AlertDescription>
									</Alert>
								)}

								{institution.accounts.length > 0 ? (
									<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
										{institution.accounts.map((account) => (
											<AccountCard account={account} key={account.id} />
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										No active accounts found.
									</p>
								)}

								<div className="flex items-center justify-between pt-1">
									<div className="flex flex-wrap items-center gap-3">
										{needsRelink ? (
											<Button
												onClick={() => setRelinkOpen(true)}
												size="sm"
												variant="outline"
											>
												Reconnect bank
											</Button>
										) : institution.requiresReconnect ? (
											<ReconnectBankButton
												institutionName={institution.institutionName}
												itemId={institution.id}
											/>
										) : (
											<div className="flex items-center gap-1">
												<SyncButton itemId={institution.id} />
												<InstitutionActionsMenu
													itemId={institution.id}
													lastRealtimeBalanceSyncAt={
														institution.lastRealtimeBalanceSyncAt
													}
												/>
											</div>
										)}
									</div>
									<Button
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() => setDisconnectOpen(true)}
										size="sm"
										variant="ghost"
									>
										<Unlink className="mr-1.5 h-3.5 w-3.5" />
										Disconnect
									</Button>
								</div>
							</CardContent>
						</motion.div>
					)}
				</AnimatePresence>
			</Card>

			<DirectPlaidConnectLauncher
				onOpenChange={setRelinkOpen}
				onSuccess={() => {
					void queryClient.invalidateQueries({
						queryKey: ["plaid", "getConnectedInstitutions"],
					});
					void queryClient.invalidateQueries({
						queryKey: ["financialProfileData", "get"],
					});
				}}
				open={relinkOpen}
			/>

			<Dialog onOpenChange={setDisconnectOpen} open={disconnectOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Disconnect {institution.institutionName}?</DialogTitle>
						<DialogDescription>
							This will remove the live connection to{" "}
							{institution.institutionName}. Your imported transaction history
							will be preserved. You can reconnect at any time.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							disabled={disconnect.isPending}
							onClick={() => setDisconnectOpen(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={disconnect.isPending}
							onClick={() => disconnect.mutate({ itemId: institution.id })}
							variant="destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							{disconnect.isPending ? "Disconnecting…" : "Disconnect"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
