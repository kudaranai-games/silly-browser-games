// 押された角度と推奨角度から判定を決める。返り値は data/game.json の tiers のキー。
// angle: 上司の方へ傾いた角度（度）。負なら逆向き。
export function judge(angle, target) {
  if (angle < 0) return "hankou";
  const diff = angle - target;
  if (Math.abs(diff) <= 1) return "yakuin";
  if (Math.abs(diff) <= 3) return "shusse";
  if (diff > 12) return "kobi";
  if (diff > 3) return "yaya-kobi";
  if (angle < 3) return "chokuritsu";
  return "eshaku";
}

// 表示・記録用。小数第1位に丸める。
export function roundAngle(angle) {
  return Math.round(angle * 10) / 10;
}
