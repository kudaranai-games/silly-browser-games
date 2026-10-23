// 公開用ファイルを dist/pages/ に集める。
// usage: node tools/build.mjs
//
// - 公開するのは index.html・shared/・games/ だけ。その中の tests/ と *.test.js は除く。
// - ブラウザに古いJS・CSSを使わせないよう、相対参照に ?v=<ビルドID> を付ける。
// - 出力を検査し、問題があれば失敗する（参照切れ、ID の付け忘れ、テストの混入、一覧ページからのリンク漏れ、アクセス解析の入れ忘れ）。

import { cp, rm, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLISH = ["index.html", "shared", "games"];

// JS の相対 import（静的・動的・副作用のみ）。例: from "./a.js" / import("../b.js") / import "./c.js"
const JS_IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']*)\2/g;
// HTML の src / href
const HTML_REF = /(\s(?:src|href)=)(["'])([^"']*)\2/g;
// 全ページに入れる Cloudflare Web Analytics のスクリプト
const ANALYTICS_BEACON = "https://static.cloudflareinsights.com/beacon.min.js";

export async function build({ outDir = join(ROOT, "dist", "pages"), buildId = defaultBuildId() } = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  for (const entry of PUBLISH) {
    await cp(join(ROOT, entry), join(outDir, entry), { recursive: true, filter: (src) => !isTestPath(src) });
  }
  for (const file of await listFiles(outDir)) {
    if (file.endsWith(".js")) await rewrite(file, (s) => versionJsImports(s, buildId));
    else if (file.endsWith(".html")) await rewrite(file, (s) => versionHtmlRefs(s, buildId));
  }
  const files = await listFiles(outDir);
  const problems = await validate(outDir, files, buildId);
  return { outDir, buildId, files: files.map((f) => toPosix(relative(outDir, f))), problems };
}

export function versionJsImports(src, id) {
  return src.replace(JS_IMPORT, (m, pre, q, spec) => `${pre}${q}${withVersion(spec, id)}${q}`);
}

export function versionHtmlRefs(src, id) {
  return src.replace(HTML_REF, (m, pre, q, ref) =>
    isLocalRef(ref) && /\.(js|css)$/.test(ref) ? `${pre}${q}${withVersion(ref, id)}${q}` : m
  );
}

// 出力を検査して、問題の一覧を返す（空なら合格）
export async function validate(outDir, files, buildId) {
  const problems = [];
  const exists = new Set(files.map((f) => resolve(f)));
  const check = (from, ref, needsVersion) => {
    const [path, query = ""] = ref.split("?");
    let target = resolve(dirname(from), path);
    if (path.endsWith("/")) target = join(target, "index.html");
    const where = toPosix(relative(outDir, from));
    if (!exists.has(target)) problems.push(`${where}: 参照先がない ${ref}`);
    if (needsVersion && query !== `v=${buildId}`) problems.push(`${where}: ビルドIDが付いていない ${ref}`);
  };

  for (const file of files) {
    const rel = toPosix(relative(outDir, file));
    if (isTestPath(rel)) problems.push(`${rel}: テスト用のファイルが含まれている`);
    if (file.endsWith(".js")) {
      const src = await readFile(file, "utf8");
      for (const [, , , spec] of src.matchAll(JS_IMPORT)) check(file, spec, true);
    } else if (file.endsWith(".html")) {
      const src = await readFile(file, "utf8");
      for (const [, , , ref] of src.matchAll(HTML_REF)) {
        if (isLocalRef(ref)) check(file, ref, /\.(js|css)(\?|$)/.test(ref));
      }
      if (!src.includes(ANALYTICS_BEACON)) problems.push(`${rel}: アクセス解析のスクリプトがない`);
    }
  }

  // すべてのゲームが一覧ページからリンクされているか
  const indexHtml = await readFile(join(outDir, "index.html"), "utf8");
  const games = (await readdir(join(outDir, "games"), { withFileTypes: true })).filter((d) => d.isDirectory());
  if (games.length === 0) problems.push("games/: ゲームが1本もない");
  for (const game of games) {
    if (!indexHtml.includes(`href="games/${game.name}/"`)) problems.push(`index.html: games/${game.name}/ へのリンクがない`);
  }
  return problems;
}

function withVersion(ref, id) {
  return ref.includes("?") ? ref : `${ref}?v=${id}`;
}

function isLocalRef(ref) {
  return ref !== "" && !/^([a-z]+:|\/\/|#)/i.test(ref);
}

function isTestPath(path) {
  return path.split(/[\\/]/).includes("tests") || /\.test\.m?js$/.test(path);
}

function toPosix(path) {
  return path.split("\\").join("/");
}

async function rewrite(file, fn) {
  await writeFile(file, fn(await readFile(file, "utf8")));
}

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(path)));
    else out.push(path);
  }
  return out;
}

// GitHub Actions ではコミットのハッシュ、手元では git のハッシュ、どちらもなければ時刻
function defaultBuildId() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { outDir, buildId, files, problems } = await build();
  if (problems.length > 0) {
    console.error(`ビルド失敗: ${problems.length} 件の問題`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`ビルド完了: ${toPosix(relative(ROOT, outDir))}/（ビルドID ${buildId}、${files.length} ファイル）`);
  for (const f of files) console.log(`  ${f}`);
}
