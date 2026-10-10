import type { CommunityTipOwnerDetail } from "@moat/community-tips";
import {
	COMMUNITY_TIP_BODY_MAX,
	COMMUNITY_TIP_BODY_MIN,
	COMMUNITY_TIP_TITLE_MAX,
	COMMUNITY_TIP_TITLE_MIN,
	createCommunityTipInputSchema,
	updateCommunityTipInputSchema,
} from "@moat/community-tips";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Button,
	Checkbox,
	Input,
	Label,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Textarea,
} from "@moat/ui";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApiClient } from "../api-client-context";
import type { CommunityTipsNotifications } from "./types";
import { splitList } from "./utils";

type CommunityTipSubmitFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	notifications?: CommunityTipsNotifications;
	onSuccess?: () => void;
	editTip?: CommunityTipOwnerDetail | null;
};

export function CommunityTipSubmitForm({
	open,
	onOpenChange,
	notifications,
	onSuccess,
	editTip,
}: CommunityTipSubmitFormProps) {
	const api = useApiClient();
	const isEditing = editTip != null;

	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [attribution, setAttribution] = useState<"PUBLIC" | "ANONYMOUS">(
		"PUBLIC",
	);
	const [tags, setTags] = useState("");
	const [keywords, setKeywords] = useState("");
	const [merchantNames, setMerchantNames] = useState("");
	const [potentialBenefit, setPotentialBenefit] = useState("");
	const [externalUrl, setExternalUrl] = useState("");
	const [personallyTested, setPersonallyTested] = useState(false);

	useEffect(() => {
		if (!open) return;
		if (editTip) {
			setTitle(editTip.title);
			setBody(editTip.body);
			setAttribution(editTip.attribution);
			setTags(editTip.metadata.tags.join(", "));
			setKeywords(editTip.metadata.keywords.join(", "));
			setMerchantNames(editTip.metadata.merchantNames.join(", "));
			setPotentialBenefit(editTip.metadata.potentialBenefit ?? "");
			setExternalUrl(editTip.metadata.externalUrl ?? "");
			setPersonallyTested(editTip.metadata.personallyTested);
			return;
		}
		setTitle("");
		setBody("");
		setAttribution("PUBLIC");
		setTags("");
		setKeywords("");
		setMerchantNames("");
		setPotentialBenefit("");
		setExternalUrl("");
		setPersonallyTested(false);
	}, [open, editTip]);

	const createMutation = useMutation({
		mutationFn: api.createCommunityTip.bind(api),
		onSuccess: () => {
			notifications?.success(
				"Tip submitted for review. Thanks for contributing!",
			);
			onOpenChange(false);
			onSuccess?.();
		},
		onError: () => notifications?.error("Failed to submit tip"),
	});

	const updateMutation = useMutation({
		mutationFn: api.updateCommunityTip.bind(api),
		onSuccess: () => {
			notifications?.success("Tip updated");
			onOpenChange(false);
			onSuccess?.();
		},
		onError: () => notifications?.error("Failed to update tip"),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function buildMetadata() {
		const base = {
			tags: splitList(tags),
			keywords: splitList(keywords),
			merchantNames: splitList(merchantNames),
			potentialBenefit: potentialBenefit.trim() || null,
			externalUrl: externalUrl.trim() || null,
			personallyTested,
		};
		if (!editTip) return base;
		return {
			...base,
			transactionCategories: editTip.metadata.transactionCategories,
			tipType: editTip.metadata.tipType,
			estimatedSavingsPercent: editTip.metadata.estimatedSavingsPercent,
			estimatedSavingsAmount: editTip.metadata.estimatedSavingsAmount,
			countryCodes: editTip.metadata.countryCodes,
			requirements: editTip.metadata.requirements,
			expiresAt: editTip.expiresAt,
		};
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!title.trim() || !body.trim()) return;

		if (isEditing && editTip) {
			const parsed = updateCommunityTipInputSchema.safeParse({
				tipId: editTip.id,
				title: title.trim(),
				body: body.trim(),
				attribution,
				metadata: buildMetadata(),
			});
			if (!parsed.success) {
				notifications?.error(
					parsed.error.issues[0]?.message ?? "Invalid input",
				);
				return;
			}
			await updateMutation.mutateAsync(parsed.data);
			return;
		}

		const parsed = createCommunityTipInputSchema.safeParse({
			title: title.trim(),
			body: body.trim(),
			attribution,
			metadata: buildMetadata(),
		});
		if (!parsed.success) {
			notifications?.error(parsed.error.issues[0]?.message ?? "Invalid input");
			return;
		}
		await createMutation.mutateAsync(parsed.data);
	}

	return (
		<SidePanel onOpenChange={onOpenChange} open={open}>
			<SidePanelContent size="md">
				<form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
					<SidePanelHeader>
						<SidePanelTitle>
							{isEditing ? "Edit tip" : "Add a tip"}
						</SidePanelTitle>
					</SidePanelHeader>
					<SidePanelBody className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="tip-title">Title</Label>
							<Input
								id="tip-title"
								maxLength={COMMUNITY_TIP_TITLE_MAX}
								minLength={COMMUNITY_TIP_TITLE_MIN}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="e.g. Use a Chase Sapphire for dining"
								required
								value={title}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="tip-body">Tip details</Label>
							<Textarea
								className="min-h-32"
								id="tip-body"
								maxLength={COMMUNITY_TIP_BODY_MAX}
								minLength={COMMUNITY_TIP_BODY_MIN}
								onChange={(e) => setBody(e.target.value)}
								placeholder="Describe the tip in detail…"
								required
								rows={6}
								value={body}
							/>
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								checked={attribution === "ANONYMOUS"}
								id="tip-post-anonymously"
								onCheckedChange={(checked) =>
									setAttribution(checked === true ? "ANONYMOUS" : "PUBLIC")
								}
							/>
							<Label htmlFor="tip-post-anonymously">Post anonymously</Label>
						</div>
						<Accordion collapsible type="single">
							<AccordionItem value="metadata">
								<AccordionTrigger className="text-sm">
									Help Moat recommend this tip
								</AccordionTrigger>
								<AccordionContent>
									<div className="space-y-3 pt-1">
										<div className="space-y-1.5">
											<Label htmlFor="tip-tags">Tags (comma-separated)</Label>
											<Input
												id="tip-tags"
												onChange={(e) => setTags(e.target.value)}
												placeholder="credit-card, travel, dining"
												value={tags}
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="tip-keywords">
												Keywords (comma-separated)
											</Label>
											<Input
												id="tip-keywords"
												onChange={(e) => setKeywords(e.target.value)}
												placeholder="rewards, points, cashback"
												value={keywords}
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="tip-merchants">
												Merchants (comma-separated)
											</Label>
											<Input
												id="tip-merchants"
												onChange={(e) => setMerchantNames(e.target.value)}
												placeholder="Starbucks, Amazon, Uber"
												value={merchantNames}
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="tip-benefit">Potential benefit</Label>
											<Input
												id="tip-benefit"
												onChange={(e) => setPotentialBenefit(e.target.value)}
												placeholder="e.g. Up to 5% cashback"
												value={potentialBenefit}
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="tip-url">External URL (optional)</Label>
											<Input
												id="tip-url"
												onChange={(e) => setExternalUrl(e.target.value)}
												placeholder="https://…"
												type="url"
												value={externalUrl}
											/>
										</div>
										<div className="flex items-center gap-2">
											<Checkbox
												checked={personallyTested}
												id="tip-personally-tested"
												onCheckedChange={(checked) =>
													setPersonallyTested(checked === true)
												}
											/>
											<Label htmlFor="tip-personally-tested">
												I've personally used this tip
											</Label>
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</SidePanelBody>
					<SidePanelFooter>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button disabled={isPending} type="submit">
							{isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							{isEditing ? "Save changes" : "Submit tip"}
						</Button>
					</SidePanelFooter>
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}
