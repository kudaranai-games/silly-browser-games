// テストで使う Matter.js。公開用と同じファイル（UMD）を読み込む。
import { readFileSync } from "node:fs";

export function loadMatter() {
  const src = readFileSync(new URL("../../../shared/vendor/matter-js/matter.min.js", import.meta.url), "utf8");
  const module = { exports: {} };
  new Function("module", "exports", src)(module, module.exports);
  return module.exports;
}
