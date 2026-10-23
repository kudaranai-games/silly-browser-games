// お辞儀ハンコの効果音。最初の音は「押す」操作の中で鳴らす。

import { createSynth } from "../../shared/sfx.js";

export function createSfx() {
  const { tone, noise, setMuted } = createSynth();

  return {
    // 自分のハンコ: ポンッ
    pon() {
      tone("sine", 420, 160, 0, 0.09, 0.35);
    },
    // 着地の衝撃。strength は 0〜1。
    thud(strength = 1) {
      tone("sine", 140, 38, 0, 0.35 + 0.25 * strength, 0.9 * strength);
      noise(0, 0.12 + 0.12 * strength, 0.6 * strength, 900);
    },
    // 承認のファンファーレ（チープさが大事）
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.1 + i * 0.11, i === 3 ? 0.6 : 0.14, 0.25));
    },
    // 差し戻しのブザー
    buzzer() {
      tone("square", 110, 105, 0.08, 0.22, 0.18);
      tone("square", 110, 98, 0.36, 0.45, 0.18);
    },
    setMuted,
  };
}
