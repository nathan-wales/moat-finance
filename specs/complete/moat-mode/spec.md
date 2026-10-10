# Moat Mode

## Summary

A brand easter egg: a 10px animated "moat" river flowing clockwise around the entire app viewport. Activated from the bottom-left profile menu in both the web app and the desktop app. Implemented once in `@moat/features` (`moat-mode` slice) and consumed by both apps.

## Behavior

- **Toggle**: profile popup menu item. Copy is "Activate Moat Mode" when inactive, "Lower the drawbridge" when active. State persists per device in `localStorage` (`moat-mode-active`).
- **River**: max 10px band around the viewport edge, water flows clockwise very slowly. Rendered on a single full-viewport `<canvas>` with `pointer-events: none`, so it never blocks interaction.
- **Ants**: every ~12–35s a tiny ant (a few black pixels) marches from inside the app toward the nearest edge, touches the moat, gets swept clockwise with the current, and fades away. Variants: single ant, two ants marching together, a slightly bigger "boss ant", an ant carrying a tiny gold crumb.
- **Rare floaters**: every ~45–150s a tiny pixel object drifts by in the moat: leaf, coin, rubber duck, paper boat, shield. Ultra-rare: Nessie.
- **Ripples**: clicking within ~24px of a viewport edge spawns a ~350ms ripple in the moat at that spot.
- **Activation toast** (web): "Moat Mode activated. Fortifications online."

## Respectful defaults

- `prefers-reduced-motion`: render a static moat band, no animation, no ants/floaters.
- Tab/window hidden: animation loop pauses; resumes on visible.
- Animation is delta-time based and capped; no work when inactive (overlay unmounts the canvas and all listeners).

## Architecture

| Piece | Location |
|-------|----------|
| Animation engine (pure TS, no React) | `packages/features/src/moat-mode/moat-engine.ts` |
| Provider + hook (`MoatModeProvider`, `useMoatMode`) | `packages/features/src/moat-mode/moat-mode-context.tsx` |
| Overlay component (`MoatOverlay`) | `packages/features/src/moat-mode/moat-overlay.tsx` |
| Web mount | `apps/web/src/app/(dashboard)/layout.tsx` |
| Web toggle | profile popover in `apps/web/src/components/layout/sidebar.tsx` |
| Desktop mount | `apps/desktop/src/renderer/src/desktop-shell.tsx` |
| Desktop toggle | sidebar footer in `apps/desktop/src/renderer/src/components/sidebar.tsx` |

## Analytics

- Web only (desktop has no PostHog): `moat_mode_toggled` with `{ active: boolean }` plus standard identity props.

## Out of scope (future fun)

- Drawbridge animation near the profile menu while it is open.
- Money-event reactions (ants on duplicate transactions, boat lap on account connect).
- Seasonal moat skins.
