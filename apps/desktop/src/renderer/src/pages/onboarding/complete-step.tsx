import { MoatLogo } from "@moat/ui";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import type React from "react";

export function CompleteStep(): React.ReactElement {
	return (
		<motion.div
			animate={{ opacity: 1, y: 0 }}
			className="flex flex-col items-center gap-6 rounded-2xl border bg-gradient-to-b from-background to-muted/30 p-8 text-center"
			initial={{ opacity: 0, y: 16 }}
			transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
		>
			<motion.div
				animate={{ scale: 1, rotate: 0 }}
				initial={{ scale: 0.8, rotate: -8 }}
				transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
			>
				<MoatLogo showWordmark size={44} />
			</motion.div>

			<motion.div
				animate={{ opacity: 1, scale: 1 }}
				className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
				initial={{ opacity: 0, scale: 0.6 }}
				transition={{ delay: 0.25, duration: 0.4 }}
			>
				<CheckCircle2 className="h-7 w-7 text-primary" />
			</motion.div>

			<div className="space-y-2">
				<motion.h2
					animate={{ opacity: 1, y: 0 }}
					className="font-semibold text-xl"
					initial={{ opacity: 0, y: 8 }}
					transition={{ delay: 0.35 }}
				>
					You are ready
				</motion.h2>
				<motion.p
					animate={{ opacity: 1, y: 0 }}
					className="max-w-sm text-muted-foreground text-sm"
					initial={{ opacity: 0, y: 8 }}
					transition={{ delay: 0.45 }}
				>
					Explore overview, transactions, and settings — or replay onboarding
					anytime from Settings.
				</motion.p>
			</div>

			<motion.div
				animate={{ opacity: 1 }}
				className="flex items-center gap-2 text-muted-foreground text-xs"
				initial={{ opacity: 0 }}
				transition={{ delay: 0.6 }}
			>
				<Sparkles className="h-3.5 w-3.5" />
				<span>Your data stays on this device</span>
			</motion.div>
		</motion.div>
	);
}
