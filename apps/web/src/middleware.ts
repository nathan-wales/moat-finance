import { withFreshLogin } from "~/lib/extension-auth-callback";
import { auth } from "~/server/auth/edge";

export default auth((req) => {
	const { nextUrl } = req;

	const isLoggedIn = !!req.auth;
	const requiresTwoFactor = req.auth?.requiresTwoFactor ?? false;

	const isAuthPage = nextUrl.pathname.startsWith("/auth");
	const isGetStartedPage = nextUrl.pathname === "/get-started";
	const isApiRoute = nextUrl.pathname.startsWith("/api");
	const isSharedReport = nextUrl.pathname.startsWith("/r/");
	const is2FARoute = nextUrl.pathname === "/auth/verify-2fa";
	const isDesktopAuthRoute = nextUrl.pathname === "/auth/desktop";
	const isAuthErrorRoute = nextUrl.pathname === "/auth/error";
	const isExtensionAuthRoute = nextUrl.pathname === "/extension/auth";

	if (nextUrl.pathname === "/api/auth/error") {
		const dest = new URL("/auth/error", nextUrl);
		dest.search = nextUrl.search;
		return Response.redirect(dest);
	}
	const isDemoMode = req.cookies.get("activeAppContext")?.value === "demo";
	const isPublic =
		isAuthPage ||
		isGetStartedPage ||
		isApiRoute ||
		isSharedReport ||
		isDemoMode;

	if (!isLoggedIn && !isPublic) {
		const url = new URL("/auth/signin", nextUrl);
		let callbackUrl = `${nextUrl.pathname}${nextUrl.search}`;
		if (isExtensionAuthRoute) {
			callbackUrl = withFreshLogin(callbackUrl);
		}
		url.searchParams.set("callbackUrl", callbackUrl);
		// Public demo links (e.g. /overview?demoMode=true) land on sign-in, which
		// auto-enters demo mode when demoMode=true is a top-level param.
		if (nextUrl.searchParams.get("demoMode") === "true") {
			url.searchParams.set("demoMode", "true");
		}
		return Response.redirect(url);
	}

	// Redirect authenticated users away from auth pages, but not the 2FA page
	// or the desktop pairing page (which must keep the opaque pair id).
	// Keep demoMode so desktop "Open web demo" still enters demo after this hop.
	if (
		isLoggedIn &&
		isAuthPage &&
		!is2FARoute &&
		!isDesktopAuthRoute &&
		!isAuthErrorRoute
	) {
		const dest = new URL("/overview", nextUrl);
		if (nextUrl.searchParams.get("demoMode") === "true") {
			dest.searchParams.set("demoMode", "true");
		}
		return Response.redirect(dest);
	}

	// Redirect to 2FA verification if pending
	if (isLoggedIn && requiresTwoFactor && !is2FARoute && !isApiRoute) {
		const url = nextUrl.clone();
		url.pathname = "/auth/verify-2fa";
		url.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
		return Response.redirect(url);
	}
});

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.ico$).*)",
	],
};
