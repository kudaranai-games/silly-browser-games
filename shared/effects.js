// どのゲームでも使う、無駄に豪華な演出。どれも「経過時間 t（ms）と乱数シード」だけから描くので、状態を持たない。

import { mulberry32, randRange } from "./rng.js";

const CONFETTI_COLORS = ["#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#457b9d", "#9b5de5", "#ffffff"];

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// 画面揺れ。着地からの経過時間ごとに減衰する。
export function shakeOffset(vt, hits) {
  let amp = 0;
  for (const { at, strength, duration } of hits) {
    const t = vt - at;
    if (t >= 0 && t < duration) amp += strength * (1 - t / duration) ** 2;
  }
  return { x: amp * Math.sin(vt * 0.13), y: amp * Math.cos(vt * 0.17) };
}

// 全画面フラッシュ
export function drawFlash(ctx, w, h, t, color, duration = 180) {
  if (t < 0 || t >= duration) return;
  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - t / duration);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// 集中線。画面の外から着地点へ向かう黒い楔。
export function drawImpactLines(ctx, w, h, cx, cy, t, seed) {
  const duration = 380;
  if (t < 0 || t >= duration) return;
  const rng = mulberry32(seed);
  const reach = Math.hypot(w, h);
  const inner = 70 + 90 * (t / duration);
  ctx.save();
  ctx.globalAlpha = 0.75 * (1 - t / duration);
  ctx.fillStyle = "#1a1714";
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + randRange(rng, -0.05, 0.05);
    const width = randRange(rng, 0.008, 0.03);
    const start = inner + randRange(rng, 0, 60);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * start, cy + Math.sin(a) * start);
    ctx.lineTo(cx + Math.cos(a - width) * reach, cy + Math.sin(a - width) * reach);
    ctx.lineTo(cx + Math.cos(a + width) * reach, cy + Math.sin(a + width) * reach);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// 紙吹雪。上から降ってきて、ひらひら回る。
export function drawConfetti(ctx, w, h, t, seed) {
  if (t < 0) return;
  const rng = mulberry32(seed ^ 0x27d4eb2d);
  const s = t / 1000;
  const fade = t < 2000 ? 1 : clamp01(1 - (t - 2000) / 600);
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  for (let i = 0; i < 90; i++) {
    const x0 = randRange(rng, -20, w + 20);
    const y0 = randRange(rng, -260, -10);
    const vy = randRange(rng, 140, 300);
    const sway = randRange(rng, 10, 30);
    const spin = randRange(rng, 4, 12);
    const phase = randRange(rng, 0, Math.PI * 2);
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const x = x0 + Math.sin(s * 3 + phase) * sway;
    const y = y0 + vy * s;
    if (y > h + 20) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s * spin + phase);
    ctx.scale(1, Math.cos(s * spin * 1.3 + phase));
    ctx.fillStyle = color;
    ctx.fillRect(-4, -2.5, 8, 5);
    ctx.restore();
  }
  ctx.restore();
}
