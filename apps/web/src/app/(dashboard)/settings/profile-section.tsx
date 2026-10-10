"use client";

import { updateAccountProfile } from "@moat/client-ts";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Button,
	Card,
	CardContent,
	Input,
	Label,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@moat/ui";
import { useMutation } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "./settings-section";

export function ProfileSection() {
	const { data: session, update } = useSession();
	const [open, setOpen] = useState(false);
	const [nameValue, setNameValue] = useState("");

	const name = session?.user?.name ?? "";
	const email = session?.user?.email ?? "";
	const initials = name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	function handleOpenChange(next: boolean) {
		if (next) {
			setNameValue(name);
		}
		setOpen(next);
	}

	const mutation = useMutation({
		mutationFn: async (newName: string) => {
			const res = await updateAccountProfile({ name: newName });
			if (res.status !== 200) {
				throw new Error("Failed to update profile");
			}
			return res.data.data;
		},
		onSuccess: async (data) => {
			await update({ name: data.name });
			toast.success("Profile updated");
			setOpen(false);
		},
		onError: () => {
			toast.error("Failed to update profile");
		},
	});

	function handleSave() {
		const trimmed = nameValue.trim();
		if (!trimmed) return;
		mutation.mutate(trimmed);
	}

	return (
		<SettingsSection id="settings-profile" title="Profile">
			<Card className="py-0">
				<CardContent className="flex items-center gap-4 p-6">
					<Avatar className="h-16 w-16 shrink-0">
						<AvatarImage alt={name} src={session?.user?.image ?? ""} />
						<AvatarFallback className="text-lg">{initials}</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1 space-y-1">
						<p className="truncate font-medium text-base">{name}</p>
						<p className="truncate text-muted-foreground text-sm">{email}</p>
					</div>
					<Button
						className="ml-auto shrink-0"
						onClick={() => handleOpenChange(true)}
						size="icon"
						variant="ghost"
					>
						<Pencil className="h-4 w-4" />
						<span className="sr-only">Edit profile</span>
					</Button>
				</CardContent>
			</Card>

			<SidePanel onOpenChange={handleOpenChange} open={open}>
				<SidePanelContent size="md">
					<SidePanelHeader>
						<SidePanelTitle>Edit profile</SidePanelTitle>
					</SidePanelHeader>

					<SidePanelBody className="space-y-4">
						<div className="flex flex-col items-center gap-3 py-2">
							<Avatar className="h-16 w-16">
								<AvatarImage alt={name} src={session?.user?.image ?? ""} />
								<AvatarFallback className="text-lg">{initials}</AvatarFallback>
							</Avatar>
							<p className="text-muted-foreground text-xs">
								Profile photo cannot be updated at this time.
							</p>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="edit-name">Name</Label>
							<Input
								id="edit-name"
								onChange={(e) => setNameValue(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSave();
								}}
								value={nameValue}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="edit-email">Email</Label>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="cursor-not-allowed">
										<Input
											className="pointer-events-none select-none"
											disabled
											id="edit-email"
											value={email}
										/>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									Email cannot be updated after account creation.
								</TooltipContent>
							</Tooltip>
						</div>
					</SidePanelBody>

					<SidePanelFooter>
						<Button onClick={() => setOpen(false)} variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={
								mutation.isPending ||
								nameValue.trim() === "" ||
								nameValue.trim() === name
							}
							onClick={handleSave}
						>
							{mutation.isPending ? "Saving…" : "Save"}
						</Button>
					</SidePanelFooter>
				</SidePanelContent>
			</SidePanel>
		</SettingsSection>
	);
}
