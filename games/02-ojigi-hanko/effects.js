// 判定時の無駄に豪華な演出。どれも「経過時間 t（ms）と乱数シード」だけから描くので、状態を持たない。

import { mulberry32, randRange } from "../../shared/rng.js";

export { shakeOffset, drawFlash, drawImpactLines, drawConfetti } from "../../shared/effects.js";

// 判定演出のタイムライン（自分のハンコを押し終えてからの ms）
export const TIMELINE = {
  label: 250, // 判定の文字が落ちてくる
  sealFrom: 450, // 角印が迫り始める
  seal: 1000, // 角印が着地（ズドンッ）
  panel: 1500, // 結果パネルを出す
  end: 3600, // 演出終了
};

const INK = "196, 42, 42";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

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
