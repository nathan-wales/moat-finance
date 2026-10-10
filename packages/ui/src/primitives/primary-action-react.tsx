"use client";

import {
	type ButtonHTMLAttributes,
	createContext,
	type ReactNode,
	type Ref,
	useCallback,
	useContext,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { KbdShortcut } from "./kbd-shortcut";
import {
	getActivePrimaryActionId,
	popOverlayScope,
	pushOverlayScope,
	registerPrimaryAction,
	subscribePrimaryAction,
	unregisterPrimaryAction,
} from "./primary-action";

const OverlayScopeContext = createContext<number | null>(null);
const FooterContext = createContext(false);

const ICON_SIZES = new Set(["icon", "icon-xs", "icon-sm", "icon-lg"]);

export type ButtonShortcut = "mod+enter" | false;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
	if (typeof ref === "function") {
		ref(value);
		return;
	}
	if (ref) {
		ref.current = value;
	}
}

export function PrimaryActionScope({ children }: { children: ReactNode }) {
	const [scopeId, setScopeId] = useState<number | null>(null);

	useLayoutEffect(() => {
		const id = pushOverlayScope();
		setScopeId(id);
		return () => {
			popOverlayScope(id);
			setScopeId(null);
		};
	}, []);

	return (
		<OverlayScopeContext.Provider value={scopeId}>
			{children}
		</OverlayScopeContext.Provider>
	);
}

export function PrimaryActionFooter({ children }: { children: ReactNode }) {
	return (
		<FooterContext.Provider value={true}>{children}</FooterContext.Provider>
	);
}

export function usePrimaryActionButton({
	asChild,
	disabled,
	ariaDisabled,
	shortcut,
	size,
	type,
	variant,
}: {
	asChild: boolean;
	disabled?: boolean;
	ariaDisabled?: boolean | "true" | "false";
	shortcut?: ButtonShortcut;
	size?: string | null;
	type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
	variant?: string | null;
}): {
	setButtonNode: (node: HTMLButtonElement | null) => void;
	showShortcut: boolean;
} {
	const overlayScopeId = useContext(OverlayScopeContext);
	const inFooter = useContext(FooterContext);
	const nodeRef = useRef<HTMLButtonElement | null>(null);
	const registrationIdRef = useRef<number | null>(null);
	const [formEl, setFormEl] = useState<HTMLElement | null>(null);
	const [registrationId, setRegistrationId] = useState<number | null>(null);

	const isIcon = size != null && ICON_SIZES.has(size);
	const isDefaultVariant = variant == null || variant === "default";
	const isExplicitSubmit = type === "submit";
	const enabled = !disabled && ariaDisabled !== true && ariaDisabled !== "true";

	const shouldRegister =
		!asChild &&
		shortcut !== false &&
		(shortcut === "mod+enter" ||
			(inFooter && isDefaultVariant && !isIcon) ||
			isExplicitSubmit);

	const setButtonNode = useCallback((node: HTMLButtonElement | null) => {
		nodeRef.current = node;
		setFormEl(node?.form ?? null);
	}, []);

	useLayoutEffect(() => {
		if (!shouldRegister) {
			registrationIdRef.current = null;
			setRegistrationId(null);
			return;
		}

		const form = isExplicitSubmit && !inFooter ? formEl : null;
		const id = registerPrimaryAction({
			overlayScopeId,
			form,
			enabled,
			click: () => {
				const node = nodeRef.current;
				if (!node || node.disabled) return;
				node.click();
			},
		});
		registrationIdRef.current = id;
		setRegistrationId(id);
		return () => {
			unregisterPrimaryAction(id);
			if (registrationIdRef.current === id) {
				registrationIdRef.current = null;
			}
		};
	}, [
		shouldRegister,
		overlayScopeId,
		formEl,
		enabled,
		isExplicitSubmit,
		inFooter,
	]);

	const activeId = useSyncExternalStore(
		subscribePrimaryAction,
		getActivePrimaryActionId,
		() => null,
	);

	return {
		setButtonNode,
		showShortcut:
			shouldRegister &&
			enabled &&
			registrationId !== null &&
			activeId === registrationId,
	};
}

export function mergeButtonRefs(
	setButtonNode: (node: HTMLButtonElement | null) => void,
	ref: Ref<HTMLButtonElement> | undefined,
): (node: HTMLButtonElement | null) => void {
	return (node) => {
		setButtonNode(node);
		assignRef(ref, node);
	};
}

export function PrimaryActionShortcutHint({
	className,
}: {
	className?: string;
}) {
	return <KbdShortcut className={className} tone="onPrimary" />;
}
