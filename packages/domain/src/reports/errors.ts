export class ReportError extends Error {
	readonly statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = "ReportError";
		this.statusCode = statusCode;
	}
}

export function reportError(message: string, statusCode: number): never {
	throw new ReportError(message, statusCode);
}
