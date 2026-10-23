// X に投稿する文。URL は最後の行に置く（本文に入れないとリンクにならない環境があるため）。
export function shareText({ score, pinched, specials = 0, label, url }) {
  const lines = ["満員電車押し込みパズル", `乗車率 ${score}%`];
  if (specials > 0) lines.push(`特別な乗客 ${specials}人`);
  if (pinched > 0) lines.push(`駆け込み乗車 ${pinched}人`);
  lines.push(`判定: ${label}`, url);
  return lines.join("\n");
}
