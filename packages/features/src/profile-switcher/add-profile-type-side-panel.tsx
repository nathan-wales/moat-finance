"use client";

import type { BusinessType } from "@moat/contracts";
import {
	Button,
	cn,
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
import type React from "react";
import { type FormEvent, useState } from "react";
import { BusinessTypeSelect } from "./business-type-select";
import {
	FamilyInviteFields,
	type FamilyInviteProfileOption,
} from "./family-invite-fields";
import { ADDABLE_PROFILE_KINDS } from "./profile-kind-options";
import type { ProfileKind } from "./types";

type AddableKind = Exclude<ProfileKind, "PERSONAL">;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AddProfileInviteConfig = {
	profiles: FamilyInviteProfileOption[];
	canInvite: boolean;
	blockedMessage?: string;
	isLoading?: boolean;
};

export type AddProfileConfirmInput = {
	kind: AddableKind;
	displayName: string;
	businessType?: BusinessType;
	invite?: {
		email: string;
		additionalProfileLinkIds: string[];
	};
};

interface AddProfileTypeSidePanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (input: AddProfileConfirmInput) => void | Promise<void>;
	isSubmitting?: boolean;
	invite?: AddProfileInviteConfig;
}

export function AddProfileTypeSidePanel({
	open,
	onOpenChange,
	onConfirm,
	isSubmitting = false,
	invite,
}: AddProfileTypeSidePanelProps): React.ReactElement {
	const [kind, setKind] = useState<AddableKind>("FAMILY");
	const [displayName, setDisplayName] = useState("");
	const [businessType, setBusinessType] = useState<BusinessType | null>(null);
	const [inviteEmail, setInviteEmail] = useState("");
	const [additionalProfileIds, setAdditionalProfileIds] = useState<string[]>(
		[],
	);
	const [inviteError, setInviteError] = useState<string | null>(null);

	const trimmedName = displayName.trim();
	const trimmedInviteEmail = inviteEmail.trim();
	const showInvite = kind === "FAMILY" && Boolean(invite);
	const namePlaceholder =
		kind === "FAMILY" ? "Family member name" : "Business name";
	const wantsInvite =
		showInvite && Boolean(invite?.canInvite) && trimmedInviteEmail.length > 0;
	const confirmLabel = wantsInvite ? "Create & invite" : "Create profile";
	const actionLabel = isSubmitting ? "Creating…" : confirmLabel;

	const canCreate =
		trimmedName.length > 0 && (kind !== "BUSINESS" || businessType !== null);

	function resetForm() {
		setDisplayName("");
		setKind("FAMILY");
		setBusinessType(null);
		setInviteEmail("");
		setAdditionalProfileIds([]);
		setInviteError(null);
	}

	function handleKindChange(nextKind: AddableKind) {
		setKind(nextKind);
		if (nextKind !== "BUSINESS") {
			setBusinessType(null);
		}
		if (nextKind !== "FAMILY") {
			setInviteEmail("");
			setAdditionalProfileIds([]);
			setInviteError(null);
		}
	}

	async function handleConfirm() {
		if (!canCreate) return;

		if (wantsInvite && !EMAIL_REGEX.test(trimmedInviteEmail)) {
			setInviteError("Enter a valid email address.");
			return;
		}

		setInviteError(null);

		const payload: AddProfileConfirmInput = {
			kind,
			displayName: trimmedName,
		};

		if (kind === "BUSINESS" && businessType) {
			payload.businessType = businessType;
		}

		if (wantsInvite) {
			payload.invite = {
				email: trimmedInviteEmail,
				additionalProfileLinkIds: additionalProfileIds,
			};
		}

		await onConfirm(payload);
		resetForm();
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void handleConfirm();
	}

	let businessTypeField: React.ReactNode = null;
	if (kind === "BUSINESS") {
		businessTypeField = (
			<BusinessTypeSelect
				disabled={isSubmitting}
				onValueChange={setBusinessType}
				value={businessType}
			/>
		);
	}

	let inviteSection: React.ReactNode = null;
	if (showInvite && invite) {
		inviteSection = (
			<FamilyInviteFields
				blockedMessage={invite.blockedMessage}
				canInvite={invite.canInvite}
				disabled={isSubmitting}
				email={inviteEmail}
				error={inviteError}
				isLoading={invite.isLoading}
				onEmailChange={(value) => {
					setInviteEmail(value);
					if (inviteError) setInviteError(null);
				}}
				onSelectedAdditionalProfileIdsChange={setAdditionalProfileIds}
				profiles={invite.profiles}
				selectedAdditionalProfileIds={additionalProfileIds}
			/>
		);
	}

	return (
		<SidePanel
			onOpenChange={(next) => {
				if (!next) {
					resetForm();
				}
				onOpenChange(next);
			}}
			open={open}
		>
			<SidePanelContent size="md">
				<form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
					<SidePanelHeader>
						<SidePanelTitle>Add profile</SidePanelTitle>
						<SidePanelDescription>
							Each profile is a full separate financial view. A business profile
							keeps business spending out of your personal picture.
						</SidePanelDescription>
					</SidePanelHeader>
					<SidePanelBody className="space-y-4">
						<div className="grid gap-2">
							{ADDABLE_PROFILE_KINDS.map((option) => {
								const Icon = option.icon;
								const selected = kind === option.kind;
								return (
									<button
										className={cn(
											"flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors hover:bg-muted",
											selected && "border-foreground bg-muted",
										)}
										key={option.kind}
										onClick={() => handleKindChange(option.kind)}
										type="button"
									>
										<Icon className="mt-0.5 h-4 w-4 shrink-0" />
										<div className="min-w-0">
											<p className="font-medium text-sm">{option.label}</p>
											<p className="text-muted-foreground text-xs">
												{option.description}
											</p>
										</div>
									</button>
								);
							})}
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="profile-display-name">Name</Label>
							<Input
								id="profile-display-name"
								onChange={(event) => setDisplayName(event.target.value)}
								placeholder={namePlaceholder}
								required
								value={displayName}
							/>
						</div>
						{businessTypeField}
						{inviteSection}
					</SidePanelBody>
					<SidePanelFooter>
						<Button
							disabled={isSubmitting}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button disabled={isSubmitting || !canCreate} type="submit">
							{actionLabel}
						</Button>
					</SidePanelFooter>
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}
