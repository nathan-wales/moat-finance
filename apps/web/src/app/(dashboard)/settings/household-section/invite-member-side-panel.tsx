"use client";

import {
	Button,
	Input,
	Label,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { type FormEvent, useEffect, useState } from "react";
import {
	type ProfileAccessOption,
	ProfileAccessPicker,
} from "./profile-access-picker";

interface InviteMemberSidePanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	profiles: ProfileAccessOption[];
	onSubmit: (input: {
		name: string;
		email: string;
		profileLinkIds: string[];
	}) => void;
	isSubmitting: boolean;
	isLoadingProfiles?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteMemberSidePanel({
	open,
	onOpenChange,
	profiles,
	onSubmit,
	isSubmitting,
	isLoadingProfiles = false,
}: InviteMemberSidePanelProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setName("");
		setEmail("");
		setSelectedProfileIds([]);
		setError(null);
	}, [open]);

	function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const trimmedName = name.trim();
		const trimmedEmail = email.trim();

		if (!trimmedName) {
			setError("Name is required.");
			return;
		}

		if (!trimmedEmail) {
			setError("Email is required.");
			return;
		}

		if (!EMAIL_REGEX.test(trimmedEmail)) {
			setError("Enter a valid email address.");
			return;
		}

		if (selectedProfileIds.length === 0) {
			setError("Select at least one profile.");
			return;
		}

		setError(null);
		onSubmit({
			name: trimmedName,
			email: trimmedEmail,
			profileLinkIds: selectedProfileIds,
		});
	}

	const profilePicker = isLoadingProfiles ? (
		<p className="text-muted-foreground text-sm">Loading profiles...</p>
	) : (
		<ProfileAccessPicker
			disabled={isSubmitting}
			onChange={setSelectedProfileIds}
			profiles={profiles}
			selectedIds={selectedProfileIds}
		/>
	);

	const errorMessage = error ? (
		<p className="text-destructive text-sm">{error}</p>
	) : null;
	const submitLabel = isSubmitting ? "Sending..." : "Send Invite";

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent size="md">
				<SidePanelHeader>
					<SidePanelTitle>Invite household member</SidePanelTitle>
					<SidePanelDescription>
						Choose which profiles this person can open and manage.
					</SidePanelDescription>
				</SidePanelHeader>
				<form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
					<SidePanelBody className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="household-member-name">Name</Label>
							<Input
								autoComplete="name"
								id="household-member-name"
								onChange={(event) => setName(event.target.value)}
								placeholder="Household member name"
								value={name}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="household-member-email">Email</Label>
							<Input
								autoComplete="email"
								id="household-member-email"
								onChange={(event) => setEmail(event.target.value)}
								placeholder="name@example.com"
								type="email"
								value={email}
							/>
						</div>
						{profilePicker}
						{errorMessage}
					</SidePanelBody>
					<SidePanelFooter>
						<Button
							disabled={isSubmitting}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={
								isSubmitting || isLoadingProfiles || profiles.length === 0
							}
							type="submit"
						>
							{submitLabel}
						</Button>
					</SidePanelFooter>
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}
