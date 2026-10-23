// 判定時の無駄に豪華な演出。どれも「経過時間 t（ms）と乱数シード」だけから描くので、状態を持たない。

import { mulberry32, randRange } from "../../shared/rng.js";

// 判定演出のタイムライン（自分のハンコを押し終えてからの ms）
export const TIMELINE = {
  label: 250, // 判定の文字が落ちてくる
  sealFrom: 450, // 角印が迫り始める
  seal: 1000, // 角印が着地（ズドンッ）
  panel: 1500, // 結果パネルを出す
  end: 3600, // 演出終了
};

const INK = "196, 42, 42";
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

// 着地の衝撃で飛び散る朱肉のしぶき（重力つき）
export function drawParticles(ctx, cx, cy, t, seed) {
  const duration = 900;
  if (t < 0 || t >= duration) return;
  const rng = mulberry32(seed);
  const s = t / 1000;
  ctx.save();
  ctx.globalAlpha = 1 - t / duration;
  ctx.fillStyle = `rgb(${INK})`;
  for (let i = 0; i < 36; i++) {
    const a = randRange(rng, 0, Math.PI * 2);
    const v = randRange(rng, 120, 520);
    const r = randRange(rng, 1.5, 5);
    const x = cx + Math.cos(a) * v * s;
    const y = cy + Math.sin(a) * v * s + 0.5 * 1400 * s * s;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 紙に残る朱肉の飛び散り。着地後はずっと描く。
export function drawSplatter(ctx, cx, cy, seed) {
  const rng = mulberry32(seed ^ 0x5bd1e995);
  ctx.save();
  ctx.fillStyle = `rgba(${INK}, 0.75)`;
  for (let i = 0; i < 14; i++) {
    const a = randRange(rng, 0, Math.PI * 2);
    const d = randRange(rng, 46, 78);
    const r = randRange(rng, 0.8, 3.2);
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 1.6, r, a, 0, Math.PI * 2);
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

// 後光。金色の光線がゆっくり回る。
export function drawRays(ctx, cx, cy, t) {
  if (t < 0) return;
  const grow = clamp01(t / 400);
  const fade = t < 2200 ? 1 : clamp01(1 - (t - 2200) / 600);
  if (fade <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t / 1600);
  ctx.globalAlpha = 0.55 * fade;
  const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, 260 * grow);
  grad.addColorStop(0, "rgba(255, 214, 10, 0.95)");
  grad.addColorStop(1, "rgba(255, 214, 10, 0)");
  ctx.fillStyle = grad;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 260 * grow, a - 0.09, a + 0.09);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
