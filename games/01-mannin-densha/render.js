// 駅のホームと車両の断面の描画。Canvas 1枚に全部描くので、そのまま結果画像として保存できる。

import { shakeOffset, drawFlash, drawImpactLines, drawConfetti } from "../../shared/effects.js";
import { TIMELINE, verdictHits, countUp } from "./effects.js";
import { CAR, PLATFORM, isInside } from "./logic/world.js";

export const W = 400;
export const H = 640;

const RED = "#c42a2a";
const TEXT = "#2b2620";
const MINCHO = '"Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif';
const GOTHIC = 'system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif';
const HUD_H = 48;
const ROOF = 66;
const FRAME = "#b9c0c7";
const STRIPE = "#2f9e5b";

export function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// scene: { data, passengers, phase, timeLeft, insideNow, door, result, vt, seed }
//   phase: "ready" | "play" | "closing" | "verdict" | "done"
//   door: ドアの閉まり具合 0〜1
//   result: ドアが閉まったあとの { inside, pinched, pinchedIds, rate, score, tier }（それまでは null）
//   vt: ドアが閉まってからの ms（それまでは null、演出を飛ばしたら Infinity）
export function drawScene(ctx, scene) {
  const { vt, result } = scene;
  ctx.save();
  if (vt !== null) {
    const s = shakeOffset(vt, verdictHits(result.score));
    ctx.translate(s.x, s.y);
  }
  drawStation(ctx);
  drawCar(ctx, scene);
  const squish = vt === null ? 0 : Math.min(1, (vt - TIMELINE.squish) / 120);
  const pinched = new Set(result?.pinchedIds ?? []);
  for (const p of scene.passengers) drawPassenger(ctx, p, squish, pinched.has(p.id));
  for (const p of scene.passengers) {
    if (p.dashing) drawDash(ctx, p);
    // 特別な乗客は、車内に入るまで★を出す
    if (p.type.bonus > 0 && vt === null && !isInside(p.body.position)) drawStar(ctx, p);
  }
  drawDoor(ctx, scene.door);
  ctx.restore();

  drawHud(ctx, scene);
  if (scene.phase === "ready") drawReadyHint(ctx);
  if (vt !== null) drawVerdict(ctx, scene);
}

function drawStation(ctx) {
  // 駅の壁
  const wall = ctx.createLinearGradient(0, 0, 0, PLATFORM.floor);
  wall.addColorStop(0, "#e8e2d4");
  wall.addColorStop(1, "#d8d0bf");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  // 駅名標
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#8a8073";
  ctx.lineWidth = 1;
  ctx.fillRect(14, 86, 112, 44);
  ctx.strokeRect(14, 86, 112, 44);
  ctx.fillStyle = STRIPE;
  ctx.fillRect(14, 120, 112, 4);
  ctx.fillStyle = TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 17px ${GOTHIC}`;
  ctx.fillText("くだらない", 70, 102);
  ctx.font = `9px ${GOTHIC}`;
  ctx.fillText("KUDARANAI", 70, 116);
  // 線路
  ctx.fillStyle = "#6f6a63";
  ctx.fillRect(PLATFORM.right, CAR.floor, W - PLATFORM.right, H - CAR.floor);
  ctx.fillStyle = "#8d877e";
  for (let x = PLATFORM.right + 6; x < W; x += 22) ctx.fillRect(x, 560, 12, 8);
  ctx.fillStyle = "#4a4643";
  ctx.fillRect(PLATFORM.right, 552, W - PLATFORM.right, 5);
  // ホーム
  ctx.fillStyle = "#b5afa5";
  ctx.fillRect(0, PLATFORM.floor, PLATFORM.right, H - PLATFORM.floor);
  ctx.fillStyle = "#9f988d";
  ctx.fillRect(0, PLATFORM.floor, PLATFORM.right, 4);
  // 点字ブロック
  ctx.fillStyle = "#e9c43a";
  ctx.fillRect(PLATFORM.right - 34, PLATFORM.floor, 20, 4);
}

function drawCar(ctx, { phase, result }) {
  const outerL = CAR.left - CAR.wall - 8;
  // 車体
  ctx.fillStyle = FRAME;
  roundRect(ctx, outerL, ROOF, W - outerL + 20, CAR.floor + 14 - ROOF, 18);
  ctx.fill();
  // 車内
  ctx.fillStyle = "#f6f2e7";
  ctx.fillRect(CAR.left, CAR.top, CAR.right - CAR.left, CAR.floor - CAR.top);
  // ドアの開口部（ホームが見える）
  ctx.fillStyle = "#ddd5c4";
  ctx.fillRect(CAR.left - CAR.wall - 8, CAR.doorTop, CAR.wall + 8, CAR.floor - CAR.doorTop);
  ctx.fillStyle = "#f6f2e7";
  ctx.fillRect(CAR.left - CAR.wall, CAR.doorTop, CAR.wall, CAR.floor - CAR.doorTop);
  // 帯
  ctx.fillStyle = STRIPE;
  ctx.fillRect(CAR.right, 300, W - CAR.right, 10);
  ctx.fillRect(outerL, CAR.doorTop - 26, CAR.wall + 8, 10);
  // 網棚とつり革
  ctx.strokeStyle = "#9aa3ab";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CAR.left, CAR.top + 14);
  ctx.lineTo(CAR.right, CAR.top + 14);
  ctx.stroke();
  for (let x = CAR.left + 24; x < CAR.right; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, CAR.top + 14);
    ctx.lineTo(x, CAR.top + 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, CAR.top + 40, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 中吊り広告
  ctx.fillStyle = "#fff";
  ctx.fillRect(CAR.left + 70, CAR.top + 2, 60, 10);
  ctx.fillStyle = RED;
  ctx.font = `bold 7px ${GOTHIC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("週刊くだらない", CAR.left + 100, CAR.top + 7);
  // 床
  ctx.fillStyle = "#8f8576";
  ctx.fillRect(CAR.left, CAR.floor - 3, CAR.right - CAR.left, 3);
  // 車輪
  ctx.fillStyle = "#3b3836";
  for (const x of [190, 340]) {
    ctx.beginPath();
    ctx.arc(x, CAR.floor + 26, 15, 0, Math.PI * 2);
    ctx.fill();
  }
  // 乗車率が高すぎると、屋根が少し膨らむ
  if (result && phase !== "closing" && result.tier.id === "genkai") {
    const midX = (outerL + W) / 2;
    ctx.fillStyle = FRAME;
    ctx.beginPath();
    ctx.moveTo(outerL + 14, ROOF + 2);
    ctx.quadraticCurveTo(midX, ROOF - 34, W, ROOF + 2);
    ctx.closePath();
    ctx.fill();
    // きしみ
    ctx.strokeStyle = TEXT;
    ctx.lineWidth = 1.5;
    for (const [x, y, dx, dy] of [[midX - 60, ROOF - 2, -10, 6], [midX + 60, ROOF - 2, 10, 6], [midX - 30, ROOF + 8, -6, 8], [midX + 30, ROOF + 8, 6, 8]]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
  }
}

// door: 0（開いている）〜 1（閉まった）。上から下りてきて、開口部をふさぐ。
function drawDoor(ctx, door) {
  if (door <= 0) return;
  const x = CAR.left - CAR.wall - 8;
  const w = CAR.wall + 8;
  const h = (CAR.floor - CAR.doorTop) * door;
  ctx.fillStyle = "#a7afb7";
  ctx.fillRect(x, CAR.doorTop, w, h);
  ctx.fillStyle = "#cfe3ee";
  if (h > 40) ctx.fillRect(x + 4, CAR.doorTop + 14, w - 8, Math.min(70, h - 24));
  ctx.fillStyle = "#3b3836";
  ctx.fillRect(x, CAR.doorTop + h - 3, w, 3);
}

// squish: ドアが閉まった衝撃で顔がつぶれる度合い 0〜1
function drawPassenger(ctx, { body, type }, squish, isPinched) {
  const { w, h } = type;
  const bagW = type.bagW ?? (type.bag ? 14 : 0);
  const pw = w - bagW; // 人の部分の幅
  const px = -w / 2 + pw / 2; // 人の中心
  const top = h / 2 - (type.personH ?? h); // 人の頭のてっぺん（ギターの人はケースが頭より上に出る）
  const r = Math.max(9, Math.min(pw * 0.36, 13));
  const headY = top + r + 1;
  const bagX = w / 2 - bagW; // 荷物の左端
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.scale(1 - 0.12 * squish, 1);
  // 背負っている荷物（体より奥）
  ctx.fillStyle = type.bag;
  if (type.id === "backpack") {
    roundRect(ctx, bagX - 2, top + r * 2, bagW + 2, h * 0.45, 5);
    ctx.fill();
  } else if (type.id === "climber") {
    // 頭より高い登山リュックと、上に載せたマット
    roundRect(ctx, bagX - 4, -h / 2 + 10, bagW + 4, h * 0.62, 8);
    ctx.fill();
    ctx.fillStyle = "#e9c43a";
    roundRect(ctx, bagX - 2, -h / 2, bagW, 12, 6);
    ctx.fill();
  } else if (type.id === "guitar") {
    // ギターケース（細いネックと、太い胴）
    roundRect(ctx, bagX + 3, -h / 2, bagW - 6, h * 0.45, 3);
    ctx.fill();
    roundRect(ctx, bagX - 2, -h / 2 + h * 0.4, bagW + 2, h * 0.58, 7);
    ctx.fill();
  }
  // 体
  ctx.fillStyle = type.clothes;
  roundRect(ctx, px - pw / 2, headY + r - 2, pw, h / 2 - headY - r + 2, 7);
  ctx.fill();
  // 手に持っている荷物（体より手前）
  if (type.id === "luggage") {
    ctx.fillStyle = type.bag;
    roundRect(ctx, bagX - 2, h / 2 - h * 0.42, bagW + 2, h * 0.42, 3);
    ctx.fill();
  } else if (type.id === "plush") {
    drawBear(ctx, bagX + bagW / 2 - 6, 4, type.bag);
  }
  // 頭
  ctx.save();
  ctx.translate(px, headY);
  ctx.scale(1 - 0.2 * squish, 1 + 0.08 * squish);
  ctx.fillStyle = type.skin;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  if (!type.bald) {
    ctx.fillStyle = "#2b2620";
    ctx.beginPath();
    ctx.arc(0, -1, r, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }
  // 顔
  ctx.strokeStyle = "#2b2620";
  ctx.fillStyle = "#2b2620";
  ctx.lineWidth = 1.4;
  const e = r * 0.38;
  if (squish > 0 || isPinched) {
    // > <
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * e - sx * 3, -3);
      ctx.lineTo(sx * e + sx * 1, 0);
      ctx.lineTo(sx * e - sx * 3, 3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * e, 0, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-3, r * 0.45);
    ctx.lineTo(3, r * 0.45);
    ctx.stroke();
  }
  ctx.restore();
  if (isPinched) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 2.5;
    roundRect(ctx, -w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx, { phase, timeLeft, insideNow, data, result }) {
  ctx.fillStyle = "#24211e";
  ctx.fillRect(0, 0, W, HUD_H);
  const limit = data.timeLimitSec;
  const ratio = Math.max(0, timeLeft / limit);
  ctx.fillStyle = timeLeft <= 3 ? "#e85d3a" : "#e9c43a";
  ctx.fillRect(0, HUD_H - 5, W * ratio, 5);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = `bold 18px ${GOTHIC}`;
  const label = phase === "ready" ? "発車まで" : phase === "play" ? "発車まで" : "発車";
  ctx.fillText(phase === "play" || phase === "ready" ? `${label} ${timeLeft.toFixed(1)}秒` : label, 14, 21);
  ctx.textAlign = "right";
  const inside = result ? result.inside : insideNow;
  ctx.font = `14px ${GOTHIC}`;
  ctx.fillText(`車内 ${inside}人（定員 ${data.capacity}人）`, W - 14, 21);
}

function drawReadyHint(ctx) {
  ctx.save();
  ctx.fillStyle = "rgba(36, 33, 30, 0.85)";
  roundRect(ctx, 12, 300, 128, 58, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 13px ${GOTHIC}`;
  ctx.fillText("乗客をつかんで", 76, 320);
  ctx.fillText("車内へ投げ込む →", 76, 340);
  ctx.restore();
}

function drawVerdict(ctx, { vt, result, seed }) {
  const { score, tier, pinched } = result;
  const plate = { x: 40, y: 150, w: 320, h: 150 };
  const cx = W / 2;
  const numY = plate.y + 82;

  // 挟まった人がいれば車内放送（電光掲示板）
  if (pinched > 0 && vt >= TIMELINE.announce) {
    ctx.fillStyle = "#151311";
    ctx.fillRect(0, 586, W, 42);
    ctx.fillStyle = "#ff9b2f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 16px ${GOTHIC}`;
    ctx.fillText(`駆け込み乗車はおやめください（${pinched}人）`, cx, 607);
  }

  if (vt < TIMELINE.count) return;
  if (score >= 200) drawConfetti(ctx, W, H, vt - TIMELINE.slam, seed);

  // 乗車率の札。回っている間は小さく、確定の瞬間に大きく叩きつける。
  const enter = Math.min(1, (vt - TIMELINE.count) / 200);
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = "rgba(255, 253, 248, 0.96)";
  ctx.strokeStyle = TEXT;
  ctx.lineWidth = 2;
  roundRect(ctx, plate.x, plate.y, plate.w, plate.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 18px ${MINCHO}`;
  ctx.fillText("乗車率", cx, plate.y + 26);

  const landed = vt >= TIMELINE.slam;
  const t = vt - TIMELINE.slam;
  const punch = landed ? 1 + 0.9 * Math.max(0, 1 - t / 140) ** 2 : 1;
  ctx.save();
  ctx.translate(cx, numY);
  ctx.scale(punch, punch);
  ctx.fillStyle = landed ? RED : TEXT;
  ctx.font = `bold 64px ${GOTHIC}`;
  ctx.fillText(`${landed ? score : countUp(vt, score)}%`, 0, 0);
  ctx.restore();

  if (landed) {
    ctx.fillStyle = RED;
    ctx.font = `bold 22px ${MINCHO}`;
    ctx.fillText(tier.label, cx, plate.y + plate.h - 22);
  }
  ctx.restore();

  if (landed) {
    drawImpactLines(ctx, W, H, cx, numY, t, seed);
    drawFlash(ctx, W, H, t, score >= 200 ? "#fff" : "rgba(196, 42, 42, 0.6)");
  }
}

// 抱えている巨大なクマのぬいぐるみ。(x, y) はおなかの中心。
function drawBear(ctx, x, y, color) {
  ctx.fillStyle = color;
  for (const [dx, dy, rr] of [[0, 0, 15], [0, -20, 11], [-9, -29, 4.5], [9, -29, 4.5], [-13, 12, 6], [13, 12, 6]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f2dcc0";
  ctx.beginPath();
  ctx.arc(x, y - 16, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2620";
  for (const dx of [-4, 4]) {
    ctx.beginPath();
    ctx.arc(x + dx, y - 23, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 駆け込み乗車の人の、走っている勢いの線と叫び声
function drawDash(ctx, { body, type }) {
  const { x, y } = body.position;
  ctx.save();
  ctx.strokeStyle = "rgba(43, 38, 32, 0.6)";
  ctx.lineWidth = 2;
  for (const [dy, len] of [[-18, 26], [0, 34], [18, 22]]) {
    ctx.beginPath();
    ctx.moveTo(x - type.w / 2 - 6, y + dy);
    ctx.lineTo(x - type.w / 2 - 6 - len, y + dy);
    ctx.stroke();
  }
  // 吹き出し
  const bx = x + 8;
  const by = y - type.h / 2 - 20;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = TEXT;
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx - 40, by - 13, 80, 22, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 12px ${GOTHIC}`;
  ctx.fillText("乗りまーす！", bx, by - 2);
  ctx.restore();
}

// 特別な乗客の目印
function drawStar(ctx, { body }) {
  ctx.save();
  ctx.fillStyle = "#e9a90a";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 20px ${GOTHIC}`;
  const y = body.bounds.min.y - 12;
  ctx.strokeText("★", body.position.x, y);
  ctx.fillText("★", body.position.x, y);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
