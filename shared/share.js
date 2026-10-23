// 結果のシェア。X の Web Intent と、Canvas からの画像保存。

export function xIntentUrl(text, url) {
  const params = new URLSearchParams({ text });
  if (url) params.set("url", url);
  // 長く使われている twitter.com の Intent URL。x.com にリダイレクトされる。
  return `https://twitter.com/intent/tweet?${params}`;
}

export function openXIntent(text, url) {
  window.open(xIntentUrl(text, url), "_blank", "noopener");
}

export function downloadCanvas(canvas, filename) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  a.click();
}

// 共有用のURL。クエリやハッシュは付けない。
export function pageUrl() {
  return location.origin + location.pathname;
}
