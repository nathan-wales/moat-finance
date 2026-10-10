import { MoatLogo } from "@moat/ui";
import { motion, type Variants } from "framer-motion";
import { Bot, Database, Lock, Shield } from "lucide-react";
import type React from "react";

const CALLOUTS = [
	{
		icon: Shield,
		title: "Your data stays on this device",
		description:
			"Financial data is stored in a local SQLite database on this machine — not on Moat servers.",
	},
	{
		icon: Database,
		title: "Local SQLite database",
		description:
			"Accounts, transactions, and charts all read from one private database file you control.",
	},
	{
		icon: Lock,
		title: "Unlock your vault",
		description:
			"Vault unlock protects access to local data. It is not a cloud login and no Moat account is required.",
	},
	{
		icon: Bot,
		title: "Import or connect when ready",
		description:
			"Bring in CSV data or connect through Plaid — everything lands in your local database. Local AI assistants can read from the same data via MCP.",
	},
] as const;

const containerVariants: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.15 },
	},
};

const itemVariants: Variants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
	},
};

export function LocalPrivacyStep(): React.ReactElement {
	return (
		<div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-background to-muted/40 p-6">
			<motion.div
				animate={{ opacity: 0.6, scale: 1 }}
				className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
				initial={{ opacity: 0, scale: 0.8 }}
				transition={{ duration: 1.2, ease: "easeOut" }}
			/>
			<motion.div
				animate={{ opacity: 0.5, scale: 1 }}
				className="pointer-events-none absolute -bottom-16 left-0 h-40 w-40 rounded-full bg-muted-foreground/10 blur-3xl"
				initial={{ opacity: 0, scale: 0.8 }}
				transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
			/>

			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="relative mb-8 flex flex-col items-center gap-4 text-center"
				initial={{ opacity: 0, y: -12 }}
				transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
			>
				<MoatLogo showWordmark size={48} />
				<div className="space-y-2">
					<h2 className="font-semibold text-2xl tracking-tight">
						Private by design
					</h2>
					<p className="max-w-md text-muted-foreground text-sm">
						Moat Finance Desktop is local-first. Your financial fortress lives
						entirely on this device.
					</p>
				</div>
			</motion.div>

			<motion.div
				animate="visible"
				className="relative mb-8 flex items-center justify-center gap-2 px-4 py-3"
				initial="hidden"
				variants={containerVariants}
			>
				<motion.div
					className="rounded-lg border bg-background px-3 py-2 text-center text-xs shadow-sm"
					variants={itemVariants}
				>
					<p className="font-medium">This device</p>
				</motion.div>
				<motion.div
					animate={{ scaleX: 1 }}
					className="h-px w-8 origin-left bg-border"
					initial={{ scaleX: 0 }}
					transition={{ delay: 0.5, duration: 0.4 }}
				/>
				<motion.div
					className="rounded-lg border bg-background px-3 py-2 text-center text-xs shadow-sm"
					variants={itemVariants}
				>
					<p className="font-medium">SQLite file</p>
				</motion.div>
				<motion.div
					animate={{ scaleX: 1 }}
					className="h-px w-8 origin-left bg-border"
					initial={{ scaleX: 0 }}
					transition={{ delay: 0.65, duration: 0.4 }}
				/>
				<motion.div
					className="rounded-lg border bg-background px-3 py-2 text-center text-xs shadow-sm"
					variants={itemVariants}
				>
					<p className="font-medium">Your charts</p>
				</motion.div>
			</motion.div>

			<motion.div
				animate="visible"
				className="relative grid gap-3 sm:grid-cols-2"
				initial="hidden"
				variants={containerVariants}
			>
				{CALLOUTS.map((callout) => {
					const Icon = callout.icon;
					return (
						<motion.div
							className="rounded-xl border bg-background/80 p-4 backdrop-blur-sm"
							key={callout.title}
							variants={itemVariants}
							whileHover={{ y: -2, transition: { duration: 0.2 } }}
						>
							<div className="mb-2 flex items-center gap-2">
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
									<Icon className="h-4 w-4 text-primary" />
								</div>
								<h3 className="font-medium text-sm">{callout.title}</h3>
							</div>
							<p className="text-muted-foreground text-xs leading-relaxed">
								{callout.description}
							</p>
						</motion.div>
					);
				})}
			</motion.div>
		</div>
	);
}
