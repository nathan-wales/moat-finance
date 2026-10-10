"use client";

import { LogOut, Menu, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import Logo from "../common/logo";
import { Sidebar } from "./sidebar";

export function TopNav() {
	const { data: session } = useSession();
	const initials = session?.user?.name
		?.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
			<div className="flex items-center gap-2 md:hidden">
				<Sheet>
					<SheetTrigger asChild>
						<Button size="icon" variant="ghost">
							<Menu className="h-5 w-5" />
						</Button>
					</SheetTrigger>
					<SheetContent className="w-64 p-0" side="left">
						<Sidebar collapsible={false} />
					</SheetContent>
				</Sheet>
				<Logo showText size="sm" />
			</div>

			<div className="hidden md:block" />

			<div className="flex items-center gap-3">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-9 w-9 rounded-full"
							size="icon"
							variant="ghost"
						>
							<Avatar className="h-8 w-8">
								<AvatarImage
									alt={session?.user?.name ?? ""}
									src={session?.user?.image ?? ""}
								/>
								<AvatarFallback>
									{initials ?? <User className="h-4 w-4" />}
								</AvatarFallback>
							</Avatar>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						<div className="px-2 py-1.5">
							<p className="font-medium text-sm">{session?.user?.name}</p>
							<p className="text-muted-foreground text-xs">
								{session?.user?.email}
							</p>
						</div>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => signOut({ callbackUrl: "/auth/signin" })}
						>
							<LogOut className="mr-2 h-4 w-4" />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
}
