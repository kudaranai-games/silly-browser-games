// 満員電車の効果音。最初の音は乗客をつかむ操作の中で鳴らす。

import { createSynth } from "../../shared/sfx.js";

export function createSfx() {
  const { tone, noise, setMuted } = createSynth();

  return {
    // 乗客をつかんだ: うっ
    grab() {
      tone("sine", 320, 220, 0, 0.08, 0.25);
    },
    // 投げた: ひゅっ
    whoosh() {
      noise(0, 0.15, 0.25, 2400);
    },
    // 駆け込み乗車の人の足音（タタタタッ）
    dash() {
      for (let i = 0; i < 6; i++) noise(i * 0.07, 0.04, 0.35, 1400);
    },
    // 残り3秒からの秒読み
    tick() {
      tone("square", 1320, 1320, 0, 0.05, 0.08);
    },
    // 発車ベル（ジリリリ）とドアの空気音（プシュー）
    bell() {
      for (let i = 0; i < 14; i++) tone("square", 1180, 1180, i * 0.04, 0.03, 0.07);
      noise(0.3, 0.5, 0.3, 3500);
    },
    // ドアが閉まった衝撃。strength は 0〜1。
    thud(strength = 1) {
      tone("sine", 140, 38, 0, 0.35 + 0.25 * strength, 0.9 * strength);
      noise(0, 0.12 + 0.12 * strength, 0.6 * strength, 900);
    },
    // 車内放送のチャイム（ピンポーン）
    chime() {
      tone("sine", 988, 988, 0, 0.35, 0.2);
      tone("sine", 784, 784, 0.32, 0.6, 0.2);
    },
    // 乗車率の数字が回る音
    roll() {
      tone("triangle", 660, 700, 0, 0.03, 0.06);
    },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.1 + i * 0.11, i === 3 ? 0.6 : 0.14, 0.25));
    },
    setMuted,
  };
}
