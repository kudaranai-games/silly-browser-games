import { load, save } from "../../shared/storage.js";
import { openXIntent, downloadCanvas, pageUrl } from "../../shared/share.js";
import { roundParams } from "./logic/params.js";
import { angleAt } from "./logic/pendulum.js";
import { judge, roundAngle } from "./logic/judge.js";
import { updateBest, diffOf, isValidBest } from "./logic/best.js";
import { shareText } from "./logic/share-text.js";
import { setupCanvas, drawScene } from "./render.js";
import { TIMELINE } from "./effects.js";
import { createSfx } from "./sfx.js";

const BEST_KEY = "ojigi-hanko:best";
const INTRO_KEY = "ojigi-hanko:intro-seen";
const MUTED_KEY = "ojigi-hanko:muted";
const PRESS_MS = 450;
const GOOD_TIERS = ["yakuin", "shusse"];

const $ = (id) => document.getElementById(id);
const canvas = $("paper");
const ctx = setupCanvas(canvas);
const sfx = createSfx();

// 公開時は main.js?v=<ビルドID> で読まれるので、同じクエリをデータにも付けて古いキャッシュを避ける
const dataUrl = new URL(`./data/game.json${new URL(import.meta.url).search}`, import.meta.url);
const data = await (await fetch(dataUrl)).json();
let best = loadBest();
let muted = load(MUTED_KEY, false) === true;

// params: 今遊んでいる稟議書の条件。seed: 演出の乱数シード
let params = null;
let seed = 0;
// phase: "swing"（揺れている） | "press"（押した直後） | "verdict"（判定演出中） | "done"（結果表示）
let phase = "swing";
let swingStart = 0;
let pressStart = 0;
let verdictStart = 0;
let stamped = null;
let isNewBest = false;
// この回の演出で、もう鳴らした効果音
let fired = new Set();

function loadBest() {
  const b = load(BEST_KEY, null);
  return isValidBest(b) ? b : null;
}

function sceneFor(now) {
  const swingAngle = phase === "swing" ? angleAt((now - swingStart) / 1000, params) : 0;
  const press = phase === "press" ? Math.min(1, (now - pressStart) / PRESS_MS) : null;
  const vt = phase === "verdict" ? now - verdictStart : phase === "done" ? Infinity : null;
  const d = new Date();
  return {
    data,
    params,
    dateText: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
    swingAngle,
    press,
    stamped,
    vt,
    seed,
  };
}

function frame(now) {
  if (phase === "press" && now - pressStart >= PRESS_MS) {
    phase = "verdict";
    verdictStart = now;
  }
  if (phase === "verdict") {
    const vt = now - verdictStart;
    playCues(vt);
    if (vt >= TIMELINE.panel && $("result").hidden) showResult();
    if (vt >= TIMELINE.end) phase = "done";
  }
  drawScene(ctx, sceneFor(now));
  if (phase !== "done") requestAnimationFrame(frame);
}

// タイムラインの各時刻を過ぎたら一度だけ鳴らす
function playCues(vt) {
  const cue = (name, at, play) => {
    if (vt >= at && !fired.has(name)) {
      fired.add(name);
      play();
    }
  };
  cue("label", TIMELINE.label, () => sfx.thud(0.4));
  cue("seal", TIMELINE.seal, () => {
    const approved = data.tiers[stamped.tier].approved;
    sfx.thud(approved ? 0.85 : 1);
    if (GOOD_TIERS.includes(stamped.tier)) sfx.fanfare();
    else if (!approved) sfx.buzzer();
  });
}

function startRound() {
  params = roundParams(Math.random, data);
  seed = Math.floor(Math.random() * 2 ** 32);
  stamped = null;
  fired = new Set();
  phase = "swing";
  swingStart = performance.now();
  $("result").hidden = true;
  $("controls").hidden = false;
  requestAnimationFrame(frame);
}

function press() {
  if (phase !== "swing" || !$("intro").hidden) return;
  const now = performance.now();
  const angle = roundAngle(angleAt((now - swingStart) / 1000, params));
  stamped = { angle, tier: judge(angle, params.target) };
  const next = updateBest(best, { ...stamped, target: params.target });
  isNewBest = next !== best;
  if (isNewBest) {
    best = next;
    save(BEST_KEY, best);
  }
  sfx.pon();
  phase = "press";
  pressStart = now;
  $("controls").hidden = true;
}

// 演出を最後まで飛ばす
function skipVerdict() {
  phase = "done";
  if ($("result").hidden) showResult();
  drawScene(ctx, sceneFor(performance.now()));
}

function showResult() {
  $("result-tier").textContent = data.tiers[stamped.tier].label;
  $("result-detail").textContent = `角度 ${stamped.angle.toFixed(1)}°（推奨 ${params.target}°）`;
  $("best-info").textContent =
    `${isNewBest ? "自己ベスト更新！ " : "自己ベスト: "}推奨との差 ${diffOf(best).toFixed(1)}°（${data.tiers[best.tier].label}）`;
  $("result").hidden = false;
}

// 揺れている間は押す、演出中は飛ばす、結果表示中は次の稟議書へ
function onTap() {
  if (phase === "swing") press();
  else if (phase === "press" || phase === "verdict") skipVerdict();
  else if (phase === "done") startRound();
}

function updateMuteButton() {
  $("mute-btn").textContent = muted ? "🔇 音なし" : "🔊 音あり";
  $("mute-btn").setAttribute("aria-pressed", String(muted));
  sfx.setMuted(muted);
}

$("stamp-btn").addEventListener("click", press);
canvas.addEventListener("pointerdown", onTap);
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat) return;
  // 揺れている間以外にボタンへフォーカスがあるときは、そのボタンの操作を優先する
  if (phase !== "swing" && e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  onTap();
});
$("next-btn").addEventListener("click", startRound);
$("share-btn").addEventListener("click", () => {
  const text = shareText({
    subject: params.subject,
    angle: stamped.angle,
    target: params.target,
    label: data.tiers[stamped.tier].label,
    url: pageUrl(),
  });
  openXIntent(text);
});
// 演出の途中で保存しても、完成した稟議書の画像になるようにする
$("save-btn").addEventListener("click", () => {
  if (phase !== "done") skipVerdict();
  downloadCanvas(canvas, "ojigi-hanko.png");
});
$("mute-btn").addEventListener("click", () => {
  muted = !muted;
  save(MUTED_KEY, muted);
  updateMuteButton();
});
$("intro-ok").addEventListener("click", () => {
  $("intro").hidden = true;
  save(INTRO_KEY, true);
  swingStart = performance.now();
});

updateMuteButton();
if (!load(INTRO_KEY, false)) $("intro").hidden = false;
startRound();
