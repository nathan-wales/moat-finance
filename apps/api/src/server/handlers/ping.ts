import { withPublic } from "../handler-wrappers";

export const ping = {
	get: withPublic(async () => ({ status: "ok" })),
};
