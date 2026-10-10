import type { AiReportRepository } from "@moat/data-access";
import type { AppContext } from "../context";
import { reportError } from "./errors";

export function requireReportsRepository(ctx: AppContext): AiReportRepository {
	const reports = ctx.repositories.reports;
	if (!reports) {
		reportError("Reports repository is not available", 500);
	}
	return reports;
}
