import { randRange, randInt, pick } from "../../../shared/rng.js";

// 1枚の稟議書の条件を作る。rng は [0, 1) を返す関数。
// side: 上司の印が並ぶ側（"left" | "right"）。お辞儀はこちらへ傾ける。
// target: 推奨角度（度）。amplitude: 揺れ幅（度）。period: 揺れの周期（秒）。
// wobble: 揺れの不規則さ（0 なら単純な振り子）。
export function roundParams(rng, data) {
  const side = rng() < 0.5 ? "left" : "right";
  const target = randInt(rng, 10, 25);
  // 推奨角度より必ず十分大きく振れるようにする
  const amplitude = randRange(rng, Math.max(target + 12, 32), 55);
  const period = randRange(rng, 0.9, 1.5);
  const wobble = randRange(rng, 0, 0.25);
  const subject = pick(rng, data.subjects);
  // 上司たちもそれぞれ上の人へ傾けて押している。社長には上がいないのでまっすぐ。
  const superiorTilts = data.superiors.map((s) =>
    s.rank === 0 ? 0 : randRange(rng, 6, 24)
  );
  return { side, target, amplitude, period, wobble, subject, superiorTilts };
}
