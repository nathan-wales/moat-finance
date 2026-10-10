"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function SignOutPage() {
	useEffect(() => {
		void signOut({ callbackUrl: "/auth/signin" });
	}, []);

	return null;
}
