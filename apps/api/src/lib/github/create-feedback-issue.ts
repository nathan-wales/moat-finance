import { Octokit } from "octokit";
import {
	buildFeedbackIssueBody,
	buildFeedbackIssueLabels,
	buildFeedbackIssueTitle,
	type FeedbackIssueInput,
} from "./format-feedback-issue";
import { getGitHubFeedbackConfig } from "./is-github-feedback-enabled";

export type CreateFeedbackIssueInput = FeedbackIssueInput;

export type CreateFeedbackIssueResult = {
	issueNumber: number;
	issueUrl: string;
};

let octokitClient: Octokit | undefined;

function getOctokitClient(token: string): Octokit {
	if (!octokitClient) {
		octokitClient = new Octokit({ auth: token });
	}

	return octokitClient;
}

export async function createFeedbackIssue(
	input: CreateFeedbackIssueInput,
): Promise<CreateFeedbackIssueResult> {
	const { token, owner, repo, labels } = getGitHubFeedbackConfig();
	const octokit = getOctokitClient(token);

	const { data } = await octokit.rest.issues.create({
		owner,
		repo,
		title: `[Feedback] ${buildFeedbackIssueTitle(input.message)}`,
		body: buildFeedbackIssueBody(input),
		labels: buildFeedbackIssueLabels(input.type, labels),
	});

	return {
		issueNumber: data.number,
		issueUrl: data.html_url,
	};
}
