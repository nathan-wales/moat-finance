import type { ClientLogPlatform, LogApp, LogPlatform } from "./types";

export function mapClientLogPlatform(platform: ClientLogPlatform): {
	app: LogApp;
	platform: LogPlatform;
	source: string;
} {
	switch (platform) {
		case "IOS":
			return {
				app: "ios",
				platform: "ios",
				source: "ios-client",
			};
		case "WEB":
			return {
				app: "web",
				platform: "nextjs",
				source: "nextjs-client",
			};
		case "DESKTOP":
			return {
				app: "desktop",
				platform: "electron",
				source: "electron-main",
			};
	}
}
