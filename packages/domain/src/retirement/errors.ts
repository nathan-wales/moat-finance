export function retirementNotFoundError(): Error & { status: number } {
	const error = new Error("Retirement scenario not found") as Error & {
		status: number;
	};
	error.status = 404;
	return error;
}
