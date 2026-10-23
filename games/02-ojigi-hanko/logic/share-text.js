// URL も本文に入れる。Intent の url パラメータだと本文の最終行に続けて付くため、改行できない。
export function shareText({ subject, angle, target, label, url }) {
  return [
    "お辞儀ハンコ",
    `件名: ${subject}`,
    `角度 ${angle.toFixed(1)}°（推奨 ${target}°）`,
    `判定: ${label}`,
    url,
  ].join("\n");
}
