import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mulberry32 } from "../../../shared/rng.js";
import { judge, roundAngle } from "../logic/judge.js";
import { angleAt } from "../logic/pendulum.js";
import { roundParams } from "../logic/params.js";
import { updateBest, diffOf, isValidBest } from "../logic/best.js";
import { shareText } from "../logic/share-text.js";

const data = JSON.parse(readFileSync(new URL("../data/game.json", import.meta.url), "utf8"));

test("judge: 境界値ごとの判定（推奨 20°）", () => {
  const cases = [
    [-0.1, "hankou"],
    [-30, "hankou"],
    [0, "chokuritsu"],
    [2.9, "chokuritsu"],
    [3, "eshaku"],
    [16.9, "eshaku"],
    [17, "shusse"],
    [18.9, "shusse"],
    [19, "yakuin"],
    [20, "yakuin"],
    [21, "yakuin"],
    [21.1, "shusse"],
    [23, "shusse"],
    [23.1, "yaya-kobi"],
    [32, "yaya-kobi"],
    [32.1, "kobi"],
    [55, "kobi"],
  ];
  const wrong = cases
    .map(([angle, want]) => ({ angle, want, got: judge(angle, 20) }))
    .filter((c) => c.got !== c.want);
  assert.deepEqual(wrong, []);
});

test("judge: 返す判定はすべて game.json の tiers にある", () => {
  const ids = new Set([-10, 0, 5, 18, 20, 25, 40].map((a) => judge(a, 20)));
  assert.equal(ids.size, 7);
  for (const id of ids) assert.ok(data.tiers[id], id);
});

test("roundAngle: 小数第1位に丸める", () => {
  assert.equal(roundAngle(17.34), 17.3);
  assert.equal(roundAngle(17.35), 17.4);
  assert.equal(roundAngle(-4.26), -4.3);
});

test("roundParams: 同じ乱数列なら同じ条件、違えば違う条件", () => {
  const a = roundParams(mulberry32(1), data);
  const b = roundParams(mulberry32(1), data);
  const c = roundParams(mulberry32(2), data);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("roundParams: 1000枚分の条件がすべて範囲内で、推奨角度に必ず届く", () => {
  const problems = [];
  const sides = new Set();
  const rng = mulberry32(12345);
  for (let i = 0; i < 1000; i++) {
    const p = roundParams(rng, data);
    sides.add(p.side);
    if (p.target < 10 || p.target > 25) problems.push([i, "target", p.target]);
    if (p.amplitude < p.target + 12 || p.amplitude > 55) problems.push([i, "amplitude", p.amplitude]);
    if (p.period < 0.9 || p.period > 1.5) problems.push([i, "period", p.period]);
    if (!data.subjects.includes(p.subject)) problems.push([i, "subject", p.subject]);
    if (p.superiorTilts.length !== data.superiors.length) problems.push([i, "tilts", p.superiorTilts]);
    // 実際に揺らして、推奨角度±1°（役員候補）の範囲を通過する瞬間があるか
    let reached = false;
    for (let t = 0; t < 10 && !reached; t += 0.002) {
      if (Math.abs(angleAt(t, p) - p.target) <= 1) reached = true;
    }
    if (!reached) problems.push([i, "unreachable", p]);
  }
  assert.deepEqual(problems, []);
  assert.deepEqual([...sides].sort(), ["left", "right"]);
});

test("angleAt: 揺れ幅を超えず、正負の両方に振れる", () => {
  const p = { amplitude: 40, period: 1.2, wobble: 0.25 };
  let min = Infinity;
  let max = -Infinity;
  for (let t = 0; t < 5; t += 0.001) {
    const a = angleAt(t, p);
    min = Math.min(min, a);
    max = Math.max(max, a);
  }
  assert.ok(max <= 40 && min >= -40, `${min}..${max}`);
  assert.ok(max > 30 && min < -30, `${min}..${max}`);
});

test("diffOf: 推奨角度との差の絶対値（小数第1位）", () => {
  assert.equal(diffOf({ angle: 17.3, target: 18 }), 0.7);
  assert.equal(diffOf({ angle: 18.7, target: 18 }), 0.7);
  assert.equal(diffOf({ angle: -4.2, target: 18 }), 22.2);
});

test("updateBest: 記録なし・更新・据え置き・同点", () => {
  const first = updateBest(null, { angle: 15, target: 18, tier: "eshaku" });
  assert.deepEqual(first, { angle: 15, target: 18, tier: "eshaku" });
  // 差が小さければ更新
  const better = updateBest(first, { angle: 20.5, target: 20, tier: "yakuin" });
  assert.deepEqual(better, { angle: 20.5, target: 20, tier: "yakuin" });
  // 差が大きければ据え置き（同じオブジェクトを返す）
  assert.equal(updateBest(better, { angle: 30, target: 20, tier: "yaya-kobi" }), better);
  // 同点なら先の記録を残す（逆向きでも差が同じなら同点）
  assert.equal(updateBest(better, { angle: 9.5, target: 10, tier: "yakuin" }), better);
  // 余計なプロパティは保存しない
  assert.deepEqual(Object.keys(updateBest(null, { angle: 1, target: 2, tier: "x", extra: 1 })).sort(), ["angle", "target", "tier"]);
});

test("isValidBest: 壊れた保存データは使わない", () => {
  assert.equal(isValidBest({ angle: 1, target: 2, tier: "yakuin" }), true);
  const invalid = [null, 5, "x", {}, { angle: "1", target: 2, tier: "a" }, { angle: 1, target: NaN, tier: "a" }, { angle: 1, target: 2 }];
  assert.deepEqual(invalid.filter(isValidBest), []);
});

test("subjects: 重複がなく、稟議書の件名欄（2行）に収まる長さ", () => {
  const dupes = data.subjects.filter((s, i) => data.subjects.indexOf(s) !== i);
  assert.deepEqual(dupes, []);
  // 件名欄は幅312px・15px明朝で2行。全角1文字15pxとして1行20文字、余裕を見て合計34文字まで
  const tooLong = data.subjects.filter((s) => [...s].length > 34);
  assert.deepEqual(tooLong, []);
});

// X の文字数の数え方: URL は一律23、それ以外は全角2・半角1で、上限280
function xWeightedLength(text) {
  const urls = text.match(/https?:\/\/\S+/g) ?? [];
  const rest = urls.reduce((t, u) => t.replace(u, ""), text);
  let n = urls.length * 23;
  for (const ch of rest) n += ch.codePointAt(0) <= 0x10ff ? 1 : 2;
  return n;
}

test("shareText: どの件名・判定の組み合わせでも X の文字数上限に収まる", () => {
  const labels = Object.values(data.tiers).map((t) => t.label);
  const over = [];
  for (const subject of data.subjects) {
    for (const label of labels) {
      const text = shareText({ subject, angle: -55.5, target: 25, label, url: "https://example.github.io/silly-browser-games/games/02-ojigi-hanko/" });
      const n = xWeightedLength(text);
      if (n > 280) over.push([subject, label, n]);
    }
  }
  assert.deepEqual(over, []);
});

test("shareText: 件名・角度・推奨角度・判定・URLが1行ずつ入る", () => {
  const text = shareText({
    subject: "朱肉の補充について",
    angle: 17.3,
    target: 18,
    label: "出世コース",
    url: "https://example.com/games/02-ojigi-hanko/",
  });
  assert.equal(
    text,
    "お辞儀ハンコ\n件名: 朱肉の補充について\n角度 17.3°（推奨 18°）\n判定: 出世コース\nhttps://example.com/games/02-ojigi-hanko/"
  );
  assert.match(shareText({ subject: "x", angle: -4, target: 18, label: "反抗的", url: "u" }), /角度 -4\.0°/);
});
