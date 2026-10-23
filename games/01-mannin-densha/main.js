import { load, save } from "../../shared/storage.js";
import { openXIntent, downloadCanvas, pageUrl } from "../../shared/share.js";
import { createWorld } from "./logic/world.js";
import { scoreOf, tierOf, updateBest, isValidBest } from "./logic/score.js";
import { shareText } from "./logic/share-text.js";
import { setupCanvas, drawScene, W, H } from "./render.js";
import { DOOR_MS, TIMELINE } from "./effects.js";
import { createSfx } from "./sfx.js";

const BEST_KEY = "mannin-densha:best";
const INTRO_KEY = "mannin-densha:intro-seen";
const MUTED_KEY = "mannin-densha:muted";
const STEP_MS = 1000 / 60;
// 処理落ちしたときに、まとめて進める物理のステップ数の上限
const MAX_STEPS_PER_FRAME = 4;

// Matter.js は index.html の <script> で読み込んである（UMD のため ES Module では読めない）
const Matter = window.Matter;

const $ = (id) => document.getElementById(id);
const canvas = $("stage-canvas");
const ctx = setupCanvas(canvas);
const sfx = createSfx();

// 公開時は main.js?v=<ビルドID> で読まれるので、同じクエリをデータにも付けて古いキャッシュを避ける
const dataUrl = new URL(`./data/game.json${new URL(import.meta.url).search}`, import.meta.url);
const data = await (await fetch(dataUrl)).json();
let best = loadBest();
let muted = load(MUTED_KEY, false) === true;

let world = null;
let seed = 0;
// phase: "ready"（最初につかむまで） | "play" | "closing"（ドアが閉まっている途中） | "verdict"（結果発表） | "done"
let phase = "ready";
let playStart = 0;
let closeStart = 0;
let verdictStart = 0;
let lastFrame = 0;
let carry = 0; // 物理を進めきれなかった時間（ms）
let result = null;
let isNewBest = false;
let fired = new Set();
let pointerId = null;
let rafId = 0;

function loadBest() {
  const b = load(BEST_KEY, null);
  return isValidBest(b) ? b : null;
}

function timeLeft(now) {
  if (phase === "ready") return data.timeLimitSec;
  if (phase === "play") return Math.max(0, data.timeLimitSec - (now - playStart) / 1000);
  return 0;
}

function sceneFor(now) {
  return {
    data,
    passengers: world.passengers,
    phase,
    timeLeft: timeLeft(now),
    insideNow: world.insideCount(),
    door: phase === "closing" ? Math.min(1, (now - closeStart) / DOOR_MS) : phase === "verdict" || phase === "done" ? 1 : 0,
    result,
    vt: phase === "verdict" ? now - verdictStart : phase === "done" ? Infinity : null,
    seed,
  };
}

function frame(now) {
  if (phase === "ready" || phase === "play" || phase === "closing") {
    carry = Math.min(carry + (now - lastFrame), STEP_MS * MAX_STEPS_PER_FRAME);
    while (carry >= STEP_MS) {
      world.step(STEP_MS);
      carry -= STEP_MS;
    }
  }
  lastFrame = now;

  if (phase === "play") {
    const left = timeLeft(now);
    // 残り3秒から1秒ごとに鳴らす
    for (const s of [3, 2, 1]) cue(`tick${s}`, left <= s, () => sfx.tick());
    cue("runner", left <= data.runnerAtSec, () => {
      world.launchRunner();
      sfx.dash();
    });
    if (left <= 0) startClosing(now);
  }
  if (phase === "closing" && now - closeStart >= DOOR_MS) finishClosing(now);
  if (phase === "verdict") {
    const vt = now - verdictStart;
    playCues(vt);
    if (vt >= TIMELINE.panel && $("result").hidden) showResult();
    if (vt >= TIMELINE.end) phase = "done";
  }
  drawScene(ctx, sceneFor(now));
  rafId = phase === "done" ? 0 : requestAnimationFrame(frame);
}

// 条件を満たしたら、その回の中で一度だけ鳴らす
function cue(name, when, play) {
  if (when && !fired.has(name)) {
    fired.add(name);
    play();
  }
}

function playCues(vt) {
  cue("squish", vt >= TIMELINE.squish, () => sfx.thud(0.8));
  cue("announce", result.pinched > 0 && vt >= TIMELINE.announce, () => sfx.chime());
  // 数字が回っている間は、カタカタ鳴らし続ける
  if (vt >= TIMELINE.count && vt < TIMELINE.slam) cue(`roll${Math.floor(vt / 70)}`, true, () => sfx.roll());
  cue("slam", vt >= TIMELINE.slam, () => {
    sfx.thud(result.score >= 250 ? 1 : 0.7);
    if (result.score >= 200) sfx.fanfare();
  });
}

function startRound() {
  world = createWorld(Matter, data, Math.random);
  seed = Math.floor(Math.random() * 2 ** 32);
  result = null;
  fired = new Set();
  phase = "ready";
  carry = 0;
  lastFrame = performance.now();
  $("result").hidden = true;
  // 結果発表の途中で次へ進んだときに、ループが2本にならないようにする
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

function startClosing(now) {
  world.release();
  pointerId = null;
  phase = "closing";
  closeStart = now;
  sfx.bell();
}

function finishClosing(now) {
  const closed = world.closeDoor();
  const s = scoreOf(closed, data);
  result = { ...closed, ...s, tier: tierOf(s.score, data.tiers) };
  const next = updateBest(best, result);
  isNewBest = next !== best;
  if (isNewBest) {
    best = next;
    save(BEST_KEY, best);
  }
  phase = "verdict";
  verdictStart = now;
}

// 演出を最後まで飛ばす
function skipVerdict() {
  phase = "done";
  if ($("result").hidden) showResult();
  drawScene(ctx, sceneFor(performance.now()));
}

function showResult() {
  $("result-tier").textContent = result.tier.label;
  $("result-detail").textContent = `乗車率 ${result.score}%（車内 ${result.inside}人・定員 ${data.capacity}人）`;
  $("result-specials").textContent = result.specials > 0 ? `特別な乗客 ${result.specials}人で +${result.bonus}%` : "";
  $("result-pinched").textContent =
    result.pinched > 0 ? `駆け込み乗車 ${result.pinched}人で −${result.penalty}%` : "";
  $("result-verdict").textContent = result.tier.verdict;
  $("best-info").textContent = `${isNewBest ? "自己ベスト更新！ " : "自己ベスト: "}乗車率 ${best.score}%`;
  $("result").hidden = false;
  // スマホではキャンバスが画面いっぱいなので、シェアのボタンまで見えるようにする
  $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// 画面上の位置を、キャンバスの論理座標に直す
function toWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
}

canvas.addEventListener("pointerdown", (e) => {
  if (!$("intro").hidden) return;
  if (phase === "verdict") return skipVerdict();
  if (phase === "done") return startRound();
  if (phase !== "ready" && phase !== "play") return;
  const { x, y } = toWorld(e);
  if (!world.grab(x, y)) return;
  e.preventDefault();
  pointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  sfx.grab();
  if (phase === "ready") {
    phase = "play";
    playStart = performance.now();
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerId !== pointerId) return;
  const { x, y } = toWorld(e);
  world.drag(x, y);
});
const letGo = (e) => {
  if (e.pointerId !== pointerId) return;
  pointerId = null;
  if (world.isHolding()) {
    world.release();
    sfx.whoosh();
  }
};
canvas.addEventListener("pointerup", letGo);
canvas.addEventListener("pointercancel", letGo);

function updateMuteButton() {
  $("mute-btn").textContent = muted ? "🔇 音なし" : "🔊 音あり";
  $("mute-btn").setAttribute("aria-pressed", String(muted));
  sfx.setMuted(muted);
}

$("next-btn").addEventListener("click", startRound);
$("share-btn").addEventListener("click", () => {
  openXIntent(
    shareText({ score: result.score, pinched: result.pinched, specials: result.specials, label: result.tier.label, url: pageUrl() })
  );
});
// 演出の途中で保存しても、結果が出そろった画像になるようにする
$("save-btn").addEventListener("click", () => {
  if (phase !== "done") skipVerdict();
  downloadCanvas(canvas, "mannin-densha.png");
});
$("mute-btn").addEventListener("click", () => {
  muted = !muted;
  save(MUTED_KEY, muted);
  updateMuteButton();
});
$("intro-ok").addEventListener("click", () => {
  $("intro").hidden = true;
  save(INTRO_KEY, true);
});

updateMuteButton();
if (!load(INTRO_KEY, false)) $("intro").hidden = false;
startRound();
