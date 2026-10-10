const MOAT_THICKNESS = 12;
const INNER_CORNER_RADIUS = 12;
const WHITE_EDGE_WIDTH = 2;
const CREATURE_SCALE = 1.8;
const FLOW_SPEED_PX_PER_S = 14;
const RIPPLE_TRIGGER_DISTANCE = 24;
const RIPPLE_DURATION_S = 0.35;

const WATER_BASE = "#2e6da4";
const ANT_BLACK = "#1a1a1a";

interface RingPoint {
	x: number;
	y: number;
	dirX: number;
	dirY: number;
}

interface InnerBounds {
	x: number;
	y: number;
	w: number;
	h: number;
	r: number;
}

interface RingGeometry {
	cx: number;
	cy: number;
	cw: number;
	ch: number;
	cr: number;
	straightX: number;
	straightY: number;
	arcLen: number;
	per: number;
}

function innerBounds(w: number, h: number): InnerBounds {
	const x = MOAT_THICKNESS;
	const y = MOAT_THICKNESS;
	const bw = w - MOAT_THICKNESS * 2;
	const bh = h - MOAT_THICKNESS * 2;
	const r = Math.min(INNER_CORNER_RADIUS, bw / 2, bh / 2);
	return { x, y, w: bw, h: bh, r };
}

function ringGeometry(w: number, h: number): RingGeometry {
	const inset = MOAT_THICKNESS / 2;
	const inner = innerBounds(w, h);
	const cx = inset;
	const cy = inset;
	const cw = w - MOAT_THICKNESS;
	const ch = h - MOAT_THICKNESS;
	const cr = inner.r + inset;
	const straightX = Math.max(0, cw - 2 * cr);
	const straightY = Math.max(0, ch - 2 * cr);
	const arcLen = (Math.PI / 2) * cr;
	const per = 2 * straightX + 2 * straightY + 4 * arcLen;
	return { cx, cy, cw, ch, cr, straightX, straightY, arcLen, per };
}

function ringPerimeter(w: number, h: number): number {
	return ringGeometry(w, h).per;
}

function traceRoundedRectPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
): void {
	const radius = Math.min(r, w / 2, h / 2);
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + w - radius, y);
	ctx.arcTo(x + w, y, x + w, y + radius, radius);
	ctx.lineTo(x + w, y + h - radius);
	ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
	ctx.lineTo(x + radius, y + h);
	ctx.arcTo(x, y + h, x, y + h - radius, radius);
	ctx.lineTo(x, y + radius);
	ctx.arcTo(x, y, x + radius, y, radius);
	ctx.closePath();
}

function traceMoatBandPath(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
): void {
	ctx.rect(0, 0, w, h);
	const inner = innerBounds(w, h);
	traceRoundedRectPath(ctx, inner.x, inner.y, inner.w, inner.h, inner.r);
}

function pointOnArc(
	centerX: number,
	centerY: number,
	radius: number,
	startAngle: number,
	distance: number,
	arcLen: number,
): RingPoint {
	const angle = startAngle + (distance / arcLen) * (Math.PI / 2);
	const tangent = angle + Math.PI / 2;
	return {
		x: centerX + radius * Math.cos(angle),
		y: centerY + radius * Math.sin(angle),
		dirX: Math.cos(tangent),
		dirY: Math.sin(tangent),
	};
}

/**
 * Maps a distance `t` along the moat centerline (clockwise from the top-left
 * corner) to a canvas point plus the local flow direction.
 */
function pointOnRing(w: number, h: number, t: number): RingPoint {
	const ring = ringGeometry(w, h);
	const { cx, cy, cw, ch, cr, straightX, straightY, arcLen, per } = ring;
	let d = ((t % per) + per) % per;

	if (d < straightX) {
		return { x: cx + cr + d, y: cy, dirX: 1, dirY: 0 };
	}
	d -= straightX;

	if (d < arcLen) {
		return pointOnArc(cx + cw - cr, cy + cr, cr, -Math.PI / 2, d, arcLen);
	}
	d -= arcLen;

	if (d < straightY) {
		return { x: cx + cw, y: cy + cr + d, dirX: 0, dirY: 1 };
	}
	d -= straightY;

	if (d < arcLen) {
		return pointOnArc(cx + cw - cr, cy + ch - cr, cr, 0, d, arcLen);
	}
	d -= arcLen;

	if (d < straightX) {
		return { x: cx + cw - cr - d, y: cy + ch, dirX: -1, dirY: 0 };
	}
	d -= straightX;

	if (d < arcLen) {
		return pointOnArc(cx + cr, cy + ch - cr, cr, Math.PI / 2, d, arcLen);
	}
	d -= arcLen;

	if (d < straightY) {
		return { x: cx, y: cy + ch - cr - d, dirX: 0, dirY: -1 };
	}
	d -= straightY;

	return pointOnArc(cx + cr, cy + cr, cr, Math.PI, d, arcLen);
}

function nearestRingT(w: number, h: number, x: number, y: number): number {
	const ring = ringGeometry(w, h);
	const { cx, cy, cw, ch, cr, straightX, straightY, arcLen, per } = ring;
	const clamp = (v: number, lo: number, hi: number) =>
		Math.max(lo, Math.min(hi, v));

	const dTop = y;
	const dRight = w - x;
	const dBottom = h - y;
	const dLeft = x;
	const min = Math.min(dTop, dRight, dBottom, dLeft);

	if (min === dTop) {
		return clamp(x - (cx + cr), 0, straightX);
	}
	if (min === dRight) {
		return straightX + arcLen + clamp(y - (cy + cr), 0, straightY);
	}
	if (min === dBottom) {
		return (
			straightX +
			arcLen +
			straightY +
			arcLen +
			clamp(cx + cw - cr - x, 0, straightX)
		);
	}
	return (
		straightX +
		arcLen +
		straightY +
		arcLen +
		straightX +
		arcLen +
		clamp(cy + ch - cr - y, 0, straightY)
	);
}

function rand(lo: number, hi: number): number {
	return lo + Math.random() * (hi - lo);
}

interface WaveStreak {
	offset: number;
	lane: number;
	speedFactor: number;
	length: number;
	alpha: number;
}

interface Ant {
	phase: "march" | "swept";
	x: number;
	y: number;
	marchDirX: number;
	marchDirY: number;
	marchSpeed: number;
	scale: number;
	carryingCrumb: boolean;
	t: number;
	lane: number;
	sweptFor: number;
	sweptDuration: number;
	bobSeed: number;
}

type FloaterKind = "leaf" | "coin" | "duck" | "boat" | "shield" | "nessie";

interface Floater {
	kind: FloaterKind;
	t: number;
	speedFactor: number;
	age: number;
	lifetime: number;
}

interface Ripple {
	x: number;
	y: number;
	age: number;
}

type SpritePixel = [
	dx: number,
	dy: number,
	w: number,
	h: number,
	color: string,
];

const FLOATER_SPRITES: Record<FloaterKind, SpritePixel[]> = {
	leaf: [
		[-2, -1, 4, 2, "#3f9d4f"],
		[0, -2, 1, 1, "#2e7d3b"],
	],
	coin: [
		[-2, -2, 4, 4, "#e8b923"],
		[-1, -1, 1, 1, "#fff3b0"],
	],
	duck: [
		[-2, -1, 4, 3, "#f4d03f"],
		[1, -3, 2, 2, "#f4d03f"],
		[3, -2, 2, 1, "#e67e22"],
	],
	boat: [
		[-3, 0, 6, 2, "#8b5a2b"],
		[-1, -4, 1, 4, "#6b4423"],
		[0, -4, 3, 3, "#f5f5f0"],
	],
	shield: [
		[-2, -2, 4, 3, "#9aa5b1"],
		[-1, 1, 2, 1, "#7d8896"],
		[-1, -1, 1, 2, "#d4af37"],
	],
	nessie: [
		[-4, -1, 2, 2, "#2f6b4f"],
		[-1, -2, 2, 2, "#2f6b4f"],
		[2, -2, 1, 3, "#2f6b4f"],
		[2, -4, 2, 2, "#2f6b4f"],
		[3.5, -3.5, 0.5, 0.5, "#0d2b1d"],
	],
};

const FLOATER_WEIGHTS: [FloaterKind, number][] = [
	["leaf", 25],
	["coin", 20],
	["duck", 20],
	["boat", 15],
	["shield", 15],
	["nessie", 5],
];

function pickFloaterKind(): FloaterKind {
	const total = FLOATER_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
	let roll = Math.random() * total;
	for (const [kind, weight] of FLOATER_WEIGHTS) {
		roll -= weight;
		if (roll <= 0) return kind;
	}
	return "leaf";
}

export interface MoatEngineHandle {
	stop(): void;
}

export function startMoatEngine(canvas: HTMLCanvasElement): MoatEngineHandle {
	const renderingContext = canvas.getContext("2d");
	if (!renderingContext) return { stop: () => {} };
	const ctx: CanvasRenderingContext2D = renderingContext;

	let width = 0;
	let height = 0;
	let streaks: WaveStreak[] = [];
	const ants: Ant[] = [];
	const floaters: Floater[] = [];
	const ripples: Ripple[] = [];

	let simTime = 0;
	let nextAntAt = rand(4, 12);
	let nextFloaterAt = rand(20, 75);
	let rafId = 0;
	let lastFrameAt = 0;
	let stopped = false;

	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const per = ringPerimeter(width, height);
		const streakCount = Math.max(8, Math.floor(per / 55));
		streaks = Array.from({ length: streakCount }, () => ({
			offset: rand(0, per),
			lane: rand(-2.5, 2.5),
			speedFactor: rand(0.7, 1.4),
			length: rand(4, 9),
			alpha: rand(0.12, 0.32),
		}));

		if (reducedMotion) render();
	}

	function spawnAnts() {
		const groupRoll = Math.random();
		const count = groupRoll < 0.15 ? 2 : 1;
		const boss = groupRoll >= 0.95;
		const crumb = groupRoll >= 0.85 && groupRoll < 0.95;

		const edge = Math.floor(rand(0, 4));
		const along = rand(0.15, 0.85);
		const depth = rand(30, 70);
		for (let i = 0; i < count; i++) {
			const stagger = i * 8;
			let x = 0;
			let y = 0;
			let dirX = 0;
			let dirY = 0;
			if (edge === 0) {
				x = width * along + stagger;
				y = depth;
				dirY = -1;
			} else if (edge === 1) {
				x = width - depth;
				y = height * along + stagger;
				dirX = 1;
			} else if (edge === 2) {
				x = width * along + stagger;
				y = height - depth;
				dirY = 1;
			} else {
				x = depth;
				y = height * along + stagger;
				dirX = -1;
			}
			ants.push({
				phase: "march",
				x,
				y,
				marchDirX: dirX,
				marchDirY: dirY,
				marchSpeed: rand(14, 24),
				scale: boss ? 1.6 : 1,
				carryingCrumb: crumb,
				t: 0,
				lane: 0,
				sweptFor: 0,
				sweptDuration: rand(4, 8),
				bobSeed: rand(0, Math.PI * 2),
			});
		}
	}

	function spawnFloater() {
		floaters.push({
			kind: pickFloaterKind(),
			t: rand(0, ringPerimeter(width, height)),
			speedFactor: rand(0.8, 1.1),
			age: 0,
			lifetime: rand(25, 45),
		});
	}

	function update(dt: number) {
		simTime += dt;

		if (simTime >= nextAntAt) {
			spawnAnts();
			nextAntAt = simTime + rand(12, 35);
		}
		if (simTime >= nextFloaterAt) {
			spawnFloater();
			nextFloaterAt = simTime + rand(45, 150);
		}

		for (let i = ants.length - 1; i >= 0; i--) {
			const ant = ants[i];
			if (!ant) continue;
			if (ant.phase === "march") {
				ant.x += ant.marchDirX * ant.marchSpeed * dt;
				ant.y += ant.marchDirY * ant.marchSpeed * dt;
				const edgeDistance = Math.min(
					ant.y,
					width - ant.x,
					height - ant.y,
					ant.x,
				);
				if (edgeDistance <= MOAT_THICKNESS) {
					ant.phase = "swept";
					ant.t = nearestRingT(width, height, ant.x, ant.y);
					ant.lane = rand(-3, 3);
				}
			} else {
				ant.sweptFor += dt;
				ant.t += FLOW_SPEED_PX_PER_S * 1.3 * dt;
				if (ant.sweptFor >= ant.sweptDuration) ants.splice(i, 1);
			}
		}

		for (let i = floaters.length - 1; i >= 0; i--) {
			const floater = floaters[i];
			if (!floater) continue;
			floater.age += dt;
			floater.t += FLOW_SPEED_PX_PER_S * floater.speedFactor * dt;
			if (floater.age >= floater.lifetime) floaters.splice(i, 1);
		}

		for (let i = ripples.length - 1; i >= 0; i--) {
			const ripple = ripples[i];
			if (!ripple) continue;
			ripple.age += dt;
			if (ripple.age >= RIPPLE_DURATION_S) ripples.splice(i, 1);
		}
	}

	function clipToBand() {
		ctx.beginPath();
		traceMoatBandPath(ctx, width, height);
		ctx.clip("evenodd");
	}

	function drawWater() {
		ctx.fillStyle = WATER_BASE;
		ctx.beginPath();
		traceMoatBandPath(ctx, width, height);
		ctx.fill("evenodd");

		const inner = innerBounds(width, height);
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = WHITE_EDGE_WIDTH;
		ctx.beginPath();
		traceRoundedRectPath(ctx, inner.x, inner.y, inner.w, inner.h, inner.r);
		ctx.stroke();
	}

	function drawStreaks() {
		const flowDistance = simTime * FLOW_SPEED_PX_PER_S;
		for (const streak of streaks) {
			const p = pointOnRing(
				width,
				height,
				streak.offset + flowDistance * streak.speedFactor,
			);
			const perpX = -p.dirY;
			const perpY = p.dirX;
			const cx = p.x + perpX * streak.lane;
			const cy = p.y + perpY * streak.lane;
			ctx.fillStyle = `rgba(255, 255, 255, ${streak.alpha})`;
			ctx.fillRect(
				cx - (p.dirX * streak.length) / 2 - Math.abs(perpX),
				cy - (p.dirY * streak.length) / 2 - Math.abs(perpY),
				Math.abs(p.dirX) * streak.length + Math.abs(perpX) * 2,
				Math.abs(p.dirY) * streak.length + Math.abs(perpY) * 2,
			);
		}
	}

	function getAntDrawPosition(ant: Ant): { x: number; y: number } {
		let x = ant.x;
		let y = ant.y;
		if (ant.phase === "swept") {
			const p = pointOnRing(width, height, ant.t);
			const bob = Math.sin(simTime * 5 + ant.bobSeed) * 1.5;
			x = p.x + -p.dirY * (ant.lane + bob * 0.4);
			y = p.y + p.dirX * (ant.lane + bob * 0.4);
		}
		return { x, y };
	}

	function antHitTest(ant: Ant, px: number, py: number): boolean {
		const { x, y } = getAntDrawPosition(ant);
		const s = ant.scale * CREATURE_SCALE;
		const pad = 3;

		const inRect = (
			left: number,
			top: number,
			w: number,
			h: number,
		): boolean => px >= left - pad && px <= left + w + pad && py >= top - pad && py <= top + h + pad;

		if (inRect(x - s, y - s, 2 * s, 2 * s)) return true;
		return inRect(
			x - s + ant.marchDirX * 2 * s,
			y - s + ant.marchDirY * 2 * s,
			s,
			s,
		);
	}

	function findAntAt(px: number, py: number): number {
		for (let i = ants.length - 1; i >= 0; i--) {
			const ant = ants[i];
			if (ant && antHitTest(ant, px, py)) return i;
		}
		return -1;
	}

	function drawAnt(ant: Ant) {
		const { x, y } = getAntDrawPosition(ant);
		let alpha = 1;
		if (ant.phase === "swept") {
			const progress = ant.sweptFor / ant.sweptDuration;
			if (progress > 0.7) alpha = 1 - (progress - 0.7) / 0.3;
		}
		const s = ant.scale * CREATURE_SCALE;
		ctx.globalAlpha = alpha;
		ctx.fillStyle = ANT_BLACK;
		ctx.fillRect(x - s, y - s, 2 * s, 2 * s);
		ctx.fillRect(
			x - s + ant.marchDirX * 2 * s,
			y - s + ant.marchDirY * 2 * s,
			s,
			s,
		);
		if (ant.carryingCrumb) {
			ctx.fillStyle = "#e8b923";
			ctx.fillRect(x - s / 2, y - s - 2 * CREATURE_SCALE, s, s);
		}
		ctx.globalAlpha = 1;
	}

	function drawFloater(floater: Floater) {
		const p = pointOnRing(width, height, floater.t);
		const bob = Math.sin(simTime * 2 + floater.t) * 0.8;
		const x = p.x + -p.dirY * bob;
		const y = p.y + p.dirX * bob;

		const fadeIn = Math.min(floater.age / 2, 1);
		const fadeOut = Math.min((floater.lifetime - floater.age) / 2, 1);
		ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));

		ctx.save();
		ctx.translate(x, y);
		ctx.scale(CREATURE_SCALE, CREATURE_SCALE);
		for (const [dx, dy, w, h, color] of FLOATER_SPRITES[floater.kind]) {
			ctx.fillStyle = color;
			ctx.fillRect(dx, dy, w, h);
		}
		ctx.restore();
		ctx.globalAlpha = 1;
	}

	function drawRipples() {
		ctx.save();
		clipToBand();
		for (const ripple of ripples) {
			const progress = ripple.age / RIPPLE_DURATION_S;
			ctx.beginPath();
			ctx.arc(ripple.x, ripple.y, 2 + progress * 9, 0, Math.PI * 2);
			ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * (1 - progress)})`;
			ctx.lineWidth = 1;
			ctx.stroke();
		}
		ctx.restore();
	}

	function render() {
		ctx.clearRect(0, 0, width, height);
		ctx.save();
		clipToBand();
		drawWater();
		drawStreaks();
		for (const floater of floaters) drawFloater(floater);
		ctx.restore();
		for (const ant of ants) drawAnt(ant);
		drawRipples();
	}

	function frame(now: number) {
		if (stopped) return;
		const dt = Math.min((now - lastFrameAt) / 1000, 0.1);
		lastFrameAt = now;
		update(dt);
		render();
		rafId = requestAnimationFrame(frame);
	}

	function startLoop() {
		lastFrameAt = performance.now();
		rafId = requestAnimationFrame(frame);
	}

	function handleVisibilityChange() {
		if (document.hidden) {
			cancelAnimationFrame(rafId);
		} else if (!stopped && !reducedMotion) {
			startLoop();
		}
	}

	function handlePointerDown(event: PointerEvent) {
		const { clientX: x, clientY: y } = event;
		const antIndex = findAntAt(x, y);
		if (antIndex >= 0) {
			ants.splice(antIndex, 1);
			return;
		}
		const edgeDistance = Math.min(y, width - x, height - y, x);
		if (edgeDistance > RIPPLE_TRIGGER_DISTANCE) return;
		const p = pointOnRing(width, height, nearestRingT(width, height, x, y));
		ripples.push({ x: p.x, y: p.y, age: 0 });
	}

	resize();
	window.addEventListener("resize", resize);

	if (reducedMotion) {
		render();
	} else {
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("pointerdown", handlePointerDown);
		startLoop();
	}

	return {
		stop() {
			stopped = true;
			cancelAnimationFrame(rafId);
			window.removeEventListener("resize", resize);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("pointerdown", handlePointerDown);
			ctx.clearRect(0, 0, width, height);
		},
	};
}
