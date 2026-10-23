import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreOf, tierOf, updateBest, isValidBest } from "../logic/score.js";
import { shareText } from "../logic/share-text.js";
import { pickWeighted } from "../logic/world.js";
import { mulberry32 } from "../../../shared/rng.js";

const data = JSON.parse(readFileSync(new URL("../data/game.json", import.meta.url), "utf8"));
const URL_ = "https://example.github.io/silly-browser-games/games/01-mannin-densha/";

test("scoreOf: 乗車率は 車内の人数 ÷ 定員、挟まり1人ごとに減点、0 未満にはしない", () => {
  const d = { capacity: 5, pinchPenalty: 30 };
  assert.deepEqual(scoreOf({ inside: 14, pinched: 0 }, d), { rate: 280, pinched: 0, penalty: 0, score: 280 });
  assert.deepEqual(scoreOf({ inside: 14, pinched: 2 }, d), { rate: 280, pinched: 2, penalty: 60, score: 220 });
  assert.deepEqual(scoreOf({ inside: 0, pinched: 0 }, d), { rate: 0, pinched: 0, penalty: 0, score: 0 });
  assert.deepEqual(scoreOf({ inside: 1, pinched: 3 }, d), { rate: 20, pinched: 3, penalty: 90, score: 0 });
  // 端数は四捨五入（7 ÷ 3 = 233.3…%）
  assert.equal(scoreOf({ inside: 7, pinched: 0 }, { capacity: 3, pinchPenalty: 30 }).rate, 233);
});

test("tierOf: 境界値ごとの判定", () => {
  const cases = [
    [0, "garagara"],
    [99, "garagara"],
    [100, "tsujo"],
    [149, "tsujo"],
    [150, "yaya"],
    [199, "yaya"],
    [200, "rush"],
    [249, "rush"],
    [250, "oshiya"],
    [299, "oshiya"],
    [300, "genkai"],
    [900, "genkai"],
  ];
  const wrong = cases.map(([s, want]) => ({ s, want, got: tierOf(s, data.tiers).id })).filter((c) => c.got !== c.want);
  assert.deepEqual(wrong, []);
});

test("tiers: 0 から始まり、min が重複せず、ラベルと講評がある", () => {
  const mins = data.tiers.map((t) => t.min);
  assert.ok(mins.includes(0));
  assert.equal(new Set(mins).size, mins.length);
  const broken = data.tiers.filter((t) => !t.id || !t.label || !t.verdict);
  assert.deepEqual(broken, []);
});

test("updateBest: 高い方を残し、同点なら前の記録を残す", () => {
  const a = { score: 200, rate: 230, pinched: 1 };
  assert.deepEqual(updateBest(null, a), a);
  const b = { score: 200, rate: 200, pinched: 0 };
  assert.equal(updateBest(a, b), a);
  const c = { score: 201, rate: 201, pinched: 0, extra: "x" };
  assert.deepEqual(updateBest(a, c), { score: 201, rate: 201, pinched: 0 });
  assert.equal(updateBest(c, a), c);
});

test("isValidBest: 壊れた保存データは使わない", () => {
  assert.equal(isValidBest({ score: 1, rate: 1, pinched: 0 }), true);
  for (const bad of [null, 0, "x", {}, { score: "1", rate: 1, pinched: 0 }, { score: NaN, rate: 1, pinched: 0 }, { score: 1, rate: 1 }]) {
    assert.equal(isValidBest(bad), false, JSON.stringify(bad));
  }
});

test("passengers: 種類ごとに物理の値と描画の色がそろっている", () => {
  const ids = data.passengers.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  const broken = data.passengers.filter(
    (p) =>
      !(p.w > 0 && p.h > 0 && p.density > 0 && p.friction >= 0 && p.weight > 0) ||
      typeof p.clothes !== "string" ||
      typeof p.skin !== "string" ||
      !p.label
  );
  assert.deepEqual(broken, []);
});

test("pickWeighted: 重みに比例して選ぶ", () => {
  const rng = mulberry32(42);
  const counts = Object.fromEntries(data.passengers.map((p) => [p.id, 0]));
  const N = 20000;
  for (let i = 0; i < N; i++) counts[pickWeighted(rng, data.passengers).id]++;
  const total = data.passengers.reduce((s, p) => s + p.weight, 0);
  const off = data.passengers.filter((p) => Math.abs(counts[p.id] / N - p.weight / total) > 0.02);
  assert.deepEqual(off.map((p) => p.id), []);
});

test("shareText: 挟まりがなければその行を出さない", () => {
  assert.equal(
    shareText({ score: 280, pinched: 0, label: "押し屋の鑑", url: URL_ }),
    ["満員電車押し込みパズル", "乗車率 280%", "判定: 押し屋の鑑", URL_].join("\n")
  );
  assert.equal(
    shareText({ score: 220, pinched: 2, label: "通勤ラッシュ", url: URL_ }),
    ["満員電車押し込みパズル", "乗車率 220%", "駆け込み乗車 2人", "判定: 通勤ラッシュ", URL_].join("\n")
  );
});

// X の文字数の数え方: URL は一律23、それ以外は全角2・半角1で、上限280
function xWeightedLength(text) {
  const urls = text.match(/https?:\/\/\S+/g) ?? [];
  const rest = urls.reduce((t, u) => t.replace(u, ""), text);
  let n = urls.length * 23;
  for (const ch of rest) n += ch.codePointAt(0) <= 0x10ff ? 1 : 2;
  return n;
}

test("shareText: どの判定でも X の文字数上限に収まる", () => {
  const over = data.tiers
    .map((t) => shareText({ score: 9999, pinched: data.maxPassengers, label: t.label, url: URL_ }))
    .filter((text) => xWeightedLength(text) > 280);
  assert.deepEqual(over, []);
});
