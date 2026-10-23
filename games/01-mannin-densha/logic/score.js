// 乗車率の計算と判定、自己ベスト。

// result: { inside, pinched }（closeDoor の結果）。data: game.json
// rate は減点前の乗車率、score は挟まりの減点後（0 未満にはしない）。
export function scoreOf({ inside, pinched }, data) {
  const rate = Math.round((inside / data.capacity) * 100);
  const penalty = pinched * data.pinchPenalty;
  return { rate, pinched, penalty, score: Math.max(0, rate - penalty) };
}

// score 以上の min を持つ判定のうち、いちばん上のもの
export function tierOf(score, tiers) {
  return [...tiers].sort((a, b) => b.min - a.min).find((t) => score >= t.min) ?? tiers[0];
}

// best は null（まだ記録なし）か { score, rate, pinched }。同点なら先に出した記録を残す。
export function updateBest(best, result) {
  if (best && best.score >= result.score) return best;
  return { score: result.score, rate: result.rate, pinched: result.pinched };
}

export function isValidBest(best) {
  return (
    best !== null &&
    typeof best === "object" &&
    Number.isFinite(best.score) &&
    Number.isFinite(best.rate) &&
    Number.isFinite(best.pinched)
  );
}
