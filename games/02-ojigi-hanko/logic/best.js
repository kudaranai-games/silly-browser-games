// ベスト記録。推奨角度との差がいちばん小さかった1回を残す。

// result: { angle, target, tier }
export function diffOf(result) {
  return Math.round(Math.abs(result.angle - result.target) * 10) / 10;
}

// best は null（まだ記録なし）か result。差が同じなら先に出した記録を残す。
export function updateBest(best, result) {
  if (best && diffOf(best) <= diffOf(result)) return best;
  return { angle: result.angle, target: result.target, tier: result.tier };
}

export function isValidBest(best) {
  return (
    best !== null &&
    typeof best === "object" &&
    Number.isFinite(best.angle) &&
    Number.isFinite(best.target) &&
    typeof best.tier === "string"
  );
}
