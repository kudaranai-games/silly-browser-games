// 稟議書の描画。Canvas 1枚に全部描くので、そのまま結果画像として保存できる。

import {
  TIMELINE,
  shakeOffset,
  drawFlash,
  drawImpactLines,
  drawParticles,
  drawSplatter,
  drawConfetti,
  drawRays,
} from "./effects.js";

export const W = 400;
export const H = 640;

const INK = "rgba(196, 42, 42, 0.9)";
const TEXT = "#2b2620";
const MUTED = "#8a8073";
const LINE = "#5a5046";
const MINCHO = '"Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif';
const GOTHIC = 'system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif';

const TABLE = { x: 40, top: 240, colW: 80, headH: 26, boxH: 84 };
const SWING = { cx: 200, cy: 505, r: 56, arcR: 96 };
const VERDICT_TOP = 372;
const SEAL = { x: W - 92, y: VERDICT_TOP + 86 };
const GOOD_TIERS = ["yakuin", "shusse"];

export function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// 「上司の方へ deg 度」を画面上の回転（ラジアン、時計回りが正）に直す
function screenRad(deg, side) {
  return ((side === "left" ? -1 : 1) * deg * Math.PI) / 180;
}

// 承認欄の並び。上司が左なら 社長・部長・課長・担当 の順。
function columns(data, side) {
  const cols = [...data.superiors.map((s, i) => ({ ...s, index: i })), { ...data.player, isPlayer: true }];
  return side === "left" ? cols : cols.reverse();
}

function boxCenter(colIndex) {
  return {
    x: TABLE.x + TABLE.colW * colIndex + TABLE.colW / 2,
    y: TABLE.top + TABLE.headH + TABLE.boxH / 2,
  };
}

// scene: { data, params, dateText, swingAngle, press, stamped, vt, seed }
//   swingAngle: 揺れているハンコの角度（押す前のみ）
//   press: 押した直後のアニメーション進行度 0〜1（押す前は null）
//   stamped: { angle, tier } 押した結果（押す前は null）
//   vt: 判定演出の経過時間 ms。演出が終わったあとは Infinity（押す前・押した直後は null）
//   seed: 演出の乱数シード（しぶきや紙吹雪の配置）
export function drawScene(ctx, scene) {
  const { data, params } = scene;
  const fx = scene.vt === null ? null : verdictFx(scene);
  const animating = fx !== null && Number.isFinite(scene.vt);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#e9e4d8";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (animating) {
    const s = shakeOffset(scene.vt, fx.hits);
    ctx.translate(s.x, s.y);
  }
  drawPaper(ctx);
  drawHeader(ctx, scene);

  const cols = columns(data, params.side);
  drawTable(ctx, cols, !scene.stamped);
  cols.forEach((col, i) => {
    const { x, y } = boxCenter(i);
    if (!col.isPlayer) {
      drawStamp(ctx, x, y, 27, col.name, screenRad(params.superiorTilts[col.index], params.side));
    } else if (scene.stamped) {
      const alpha = scene.press === null ? 1 : Math.min(1, scene.press * 2);
      drawStamp(ctx, x, y, 27, col.name, screenRad(scene.stamped.angle, params.side), alpha);
    }
  });

  if (fx === null) {
    drawSwing(ctx, scene, cols);
  } else {
    drawVerdict(ctx, scene, fx);
  }
  ctx.restore();

  // 揺れの外側に描く全画面の演出
  if (animating) {
    const t = scene.vt - TIMELINE.seal;
    drawFlash(ctx, W, H, t, fx.approved ? "#ffffff" : "#ff2a2a");
    if (fx.good) drawConfetti(ctx, W, H, t, scene.seed);
  }
}

// 判定ごとの演出の強さ
function verdictFx({ data, stamped }) {
  const approved = data.tiers[stamped.tier].approved;
  return {
    approved,
    good: GOOD_TIERS.includes(stamped.tier),
    halo: stamped.tier === "yakuin",
    hits: [
      { at: TIMELINE.label, strength: 4, duration: 200 },
      { at: TIMELINE.seal, strength: approved ? 10 : 16, duration: approved ? 450 : 600 },
    ],
  };
}

function drawPaper(ctx) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(16, 16, W - 32, H - 32);
  ctx.restore();
}

function drawHeader(ctx, { data, params, dateText }) {
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = TEXT;
  ctx.textAlign = "center";
  ctx.font = `bold 30px ${MINCHO}`;
  ctx.fillText("稟　議　書", W / 2, 88);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  line(ctx, 120, 98, 280, 98);
  line(ctx, 120, 101, 280, 101);

  ctx.textAlign = "left";
  ctx.font = `12px ${GOTHIC}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("件名", 44, 132);
  ctx.fillStyle = TEXT;
  ctx.font = `15px ${MINCHO}`;
  wrapText(ctx, params.subject, 44, 154, W - 88, 20);

  ctx.font = `13px ${MINCHO}`;
  ctx.fillText(`起案日　${dateText}`, 44, 206);
  ctx.fillText(`起案者　総務部　${data.player.name}`, 44, 226);
}

function drawTable(ctx, cols, highlightPlayer) {
  const { x, top, colW, headH, boxH } = TABLE;
  const width = colW * cols.length;
  cols.forEach((col, i) => {
    if (col.isPlayer && highlightPlayer) {
      ctx.fillStyle = "#fff4c2";
      ctx.fillRect(x + colW * i, top + headH, colW, boxH);
    }
  });
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, top, width, headH + boxH);
  line(ctx, x, top + headH, x + width, top + headH);
  for (let i = 1; i < cols.length; i++) line(ctx, x + colW * i, top, x + colW * i, top + headH + boxH);

  ctx.fillStyle = TEXT;
  ctx.font = `13px ${MINCHO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  cols.forEach((col, i) => ctx.fillText(col.title, x + colW * i + colW / 2, top + headH / 2 + 1));
}

// 揺れているハンコと分度器。押した直後は縮みながら消える。
function drawSwing(ctx, { params, swingAngle, press, stamped }, cols) {
  const { cx, cy, r, arcR } = SWING;
  const sign = params.side === "left" ? -1 : 1;

  ctx.fillStyle = MUTED;
  ctx.font = `13px ${GOTHIC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(params.side === "left" ? "← 上司はこちら" : "上司はこちら →", cx, cy + r + 34);

  // 分度器（真上が 0°、上司の方へ正）
  const maxDeg = Math.ceil(params.amplitude / 10) * 10;
  ctx.strokeStyle = MUTED;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, arcR, -Math.PI / 2 - (maxDeg * Math.PI) / 180, -Math.PI / 2 + (maxDeg * Math.PI) / 180);
  ctx.stroke();
  for (let d = -maxDeg; d <= maxDeg; d += 10) {
    tick(ctx, cx, cy, arcR, screenRad(d, params.side), d === 0 ? 10 : 6, MUTED, 1);
  }

  // 推奨角度の目盛り
  const targetRad = screenRad(params.target, params.side);
  tick(ctx, cx, cy, arcR, targetRad, 16, INK, 2.5);
  const lx = cx + Math.sin(targetRad) * (arcR + 26);
  const ly = cy - Math.cos(targetRad) * (arcR + 26);
  ctx.fillStyle = INK;
  ctx.font = `bold 13px ${GOTHIC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`推奨 ${params.target}°`, lx, ly);

  const angle = stamped ? stamped.angle : swingAngle;
  const rad = screenRad(angle, params.side);
  const alpha = press === null ? 1 : Math.max(0, 1 - press);
  const scale = press === null ? 1 : 1 - 0.3 * press;

  // 針（印面の文字にかからないよう、印の外側だけに引く）
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = TEXT;
  ctx.lineWidth = 1.5;
  const inner = r * scale + 16;
  line(ctx, cx + Math.sin(rad) * inner, cy - Math.cos(rad) * inner, cx + Math.sin(rad) * (arcR - 2), cy - Math.cos(rad) * (arcR - 2));
  ctx.restore();

  drawStamp(ctx, cx, cy, r * scale, cols.find((c) => c.isPlayer).name, rad, alpha, true);
}

// 押したあとの人事部所見。判定の文字 → 角印の順に、上からドンと押される。
function drawVerdict(ctx, { data, params, stamped, vt, seed }, fx) {
  const tier = data.tiers[stamped.tier];
  const top = VERDICT_TOP;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(40, top, W - 80, 220);

  ctx.fillStyle = TEXT;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold 14px ${MINCHO}`;
  ctx.fillText("【人事部所見】", 54, top + 28);
  ctx.font = `13px ${MINCHO}`;
  ctx.fillText(`押印角度　${stamped.angle.toFixed(1)}°（推奨 ${params.target}°）`, 54, top + 56);

  // 判定の文字: 大きく半透明の状態から落ちてくる
  const labelFrom = TIMELINE.label - 150;
  if (vt >= labelFrom) {
    const p = Math.min(1, (vt - labelFrom) / 150);
    const scale = 1 + 1.6 * (1 - p) ** 2;
    ctx.save();
    ctx.translate(54, top + 110);
    ctx.scale(scale, scale);
    ctx.globalAlpha = p;
    ctx.fillStyle = INK;
    ctx.font = `bold 34px ${MINCHO}`;
    ctx.fillText(tier.label, 0, 0);
    ctx.restore();
  }

  const verdictFrom = TIMELINE.label + 200;
  if (vt >= verdictFrom) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (vt - verdictFrom) / 200);
    ctx.fillStyle = TEXT;
    ctx.font = `15px ${MINCHO}`;
    wrapText(ctx, tier.verdict, 54, top + 150, W - 108, 22);
    ctx.restore();
  }

  // 角印: 巨大な影から迫ってきて、着地でつぶれて戻る
  const t = vt - TIMELINE.seal;
  if (fx.halo) drawRays(ctx, SEAL.x, SEAL.y, t);
  if (vt >= TIMELINE.sealFrom && t < 0) {
    const p = (vt - TIMELINE.sealFrom) / (TIMELINE.seal - TIMELINE.sealFrom);
    const e = p * p;
    ctx.save();
    ctx.globalAlpha = 0.1 + 0.25 * e;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(SEAL.x, SEAL.y + 4, 44 + 120 * (1 - e), 30 + 80 * (1 - e), -0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawSeal(ctx, tier.approved, 1 + 3.2 * (1 - e), 0.15 + 0.6 * e);
  }
  if (t >= 0) {
    drawSplatter(ctx, SEAL.x, SEAL.y, seed);
    drawSeal(ctx, tier.approved, t < 140 ? 0.88 + 0.12 * (t / 140) : 1, 1);
    drawParticles(ctx, SEAL.x, SEAL.y, t, seed);
    drawImpactLines(ctx, W, H, SEAL.x, SEAL.y, t, seed);
  }
}

// 承認／差し戻しの角印
function drawSeal(ctx, approved, scale, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(SEAL.x, SEAL.y);
  ctx.rotate(-0.14);
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(-38, -24, 76, 48);
  ctx.font = `bold 20px ${MINCHO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(approved ? "承　認" : "差戻し", 0, 1);
  ctx.restore();
}

// 丸い印。名前は2文字を縦に並べる。withNotch は向きがわかるよう上端に印（アタリ）を付ける。
function drawStamp(ctx, cx, cy, r, name, rad, alpha = 1, withNotch = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `bold ${r * 0.74}px ${MINCHO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = [...name];
  ctx.fillText(chars[0] ?? "", 0, -r * 0.38);
  ctx.fillText(chars[1] ?? "", 0, r * 0.4);
  if (withNotch) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92 - 4);
    ctx.lineTo(-7, -r * 0.92 - 15);
    ctx.lineTo(7, -r * 0.92 - 15);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function tick(ctx, cx, cy, radius, rad, length, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  line(ctx, cx + s * radius, cy - c * radius, cx + s * (radius + length), cy - c * (radius + length));
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// 日本語は単語の区切りがないので、1文字ずつ詰めて幅を超えたら改行する
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let lineText = "";
  for (const ch of text) {
    if (ctx.measureText(lineText + ch).width > maxWidth && lineText) {
      ctx.fillText(lineText, x, y);
      lineText = ch;
      y += lineHeight;
    } else {
      lineText += ch;
    }
  }
  ctx.fillText(lineText, x, y);
}
