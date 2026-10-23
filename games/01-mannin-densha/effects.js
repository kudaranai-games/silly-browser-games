// 結果発表の演出のタイムライン（ドアが閉まりきってからの ms）。共通の演出は shared/effects.js にある。

export const DOOR_MS = 600; // ドアが閉まるのにかかる時間

export const TIMELINE = {
  squish: 0, // ドアが閉まった衝撃で全員がつぶれる
  announce: 350, // 挟まった人がいれば車内放送
  count: 700, // 乗車率の数字が回り始める
  slam: 1600, // 乗車率が確定して叩きつけられる
  panel: 2100, // 結果パネルを出す
  end: 4200, // 演出終了
};

// 画面揺れ（shared/effects.js の shakeOffset に渡す）
export function verdictHits(score) {
  const big = score >= 250;
  return [
    { at: TIMELINE.squish, strength: 7, duration: 350 },
    { at: TIMELINE.slam, strength: big ? 16 : 10, duration: big ? 650 : 450 },
  ];
}

// 乗車率の数字の回り方。最初は速く、最後はゆっくり止まる。
export function countUp(vt, score) {
  const t = Math.max(0, Math.min(1, (vt - TIMELINE.count) / (TIMELINE.slam - TIMELINE.count)));
  return Math.round(score * (1 - (1 - t) ** 3));
}
