// 時刻 t（秒）でのハンコの角度（度）。正の値は上司の方へ傾いている。
// 2つの正弦波を混ぜ、wobble が大きいほど揺れが不規則になる。|角度| は amplitude を超えない。
export function angleAt(t, { amplitude, period, wobble }) {
  const w = (2 * Math.PI) / period;
  return amplitude * ((1 - wobble) * Math.sin(w * t) + wobble * Math.sin(1.7 * w * t + 1));
}
