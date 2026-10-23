import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, validate, versionJsImports, versionHtmlRefs } from "./build.mjs";

test("versionJsImports: 相対 import だけに ID を付ける", () => {
  const src = [
    'import { a } from "./a.js";',
    "import { b } from '../../shared/b.js';",
    'import "./side.js";',
    'const m = await import("./dyn.js");',
    'import x from "https://cdn.example.com/x.js";',
    'import y from "bare-package";',
    'const url = new URL("./data/game.json", import.meta.url);',
  ].join("\n");
  assert.equal(
    versionJsImports(src, "abc"),
    [
      'import { a } from "./a.js?v=abc";',
      "import { b } from '../../shared/b.js?v=abc';",
      'import "./side.js?v=abc";',
      'const m = await import("./dyn.js?v=abc");',
      'import x from "https://cdn.example.com/x.js";',
      'import y from "bare-package";',
      'const url = new URL("./data/game.json", import.meta.url);',
    ].join("\n")
  );
});

test("versionHtmlRefs: ローカルの JS・CSS だけに ID を付ける", () => {
  const src =
    '<link rel="stylesheet" href="style.css"><script type="module" src="main.js"></script>' +
    '<a href="games/02-ojigi-hanko/">x</a><a href="https://x.com/">y</a><script src="//cdn.example.com/a.js"></script>';
  assert.equal(
    versionHtmlRefs(src, "abc"),
    '<link rel="stylesheet" href="style.css?v=abc"><script type="module" src="main.js?v=abc"></script>' +
      '<a href="games/02-ojigi-hanko/">x</a><a href="https://x.com/">y</a><script src="//cdn.example.com/a.js"></script>'
  );
});

test("build: 実際のプロジェクトから、公開してよいファイルだけが ID 付きで出力される", async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), "silly-build-"));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const { files, problems } = await build({ outDir, buildId: "t3st" });

  assert.deepEqual(problems, []);
  // 公開してはいけないもの
  const leaked = files.filter((f) => /(^|\/)(tests|planning|tools|dist|node_modules)\//.test(f) || /\.test\.m?js$/.test(f) || /(^|\/)(README\.md|package\.json|\.gitignore)$/.test(f));
  assert.deepEqual(leaked, []);
  // 公開しなければいけないもの
  for (const f of ["index.html", "games/02-ojigi-hanko/index.html", "games/02-ojigi-hanko/main.js", "games/02-ojigi-hanko/data/game.json", "shared/rng.js"]) {
    assert.ok(files.includes(f), f);
  }
  const html = await readFile(join(outDir, "games/02-ojigi-hanko/index.html"), "utf8");
  assert.match(html, /src="main\.js\?v=t3st"/);
  assert.match(html, /href="style\.css\?v=t3st"/);
  const main = await readFile(join(outDir, "games/02-ojigi-hanko/main.js"), "utf8");
  assert.match(main, /from "\.\.\/\.\.\/shared\/storage\.js\?v=t3st"/);
});

test("validate: 参照切れ・ID の付け忘れ・テストの混入・リンク漏れ・アクセス解析の入れ忘れを見つける", async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), "silly-build-"));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const { files } = await build({ outDir, buildId: "t3st" });

  const main = join(outDir, "games/02-ojigi-hanko/main.js");
  const src = await readFile(main, "utf8");
  await writeFile(main, src.replace('"./render.js?v=t3st"', '"./render.js"') + '\nimport "./missing.js?v=t3st";\n');
  await writeFile(join(outDir, "index.html"), (await readFile(join(outDir, "index.html"), "utf8")).replace('href="games/02-ojigi-hanko/"', 'href="games/"'));
  const gameHtml = join(outDir, "games/02-ojigi-hanko/index.html");
  await writeFile(gameHtml, (await readFile(gameHtml, "utf8")).replace(/<!-- Cloudflare Web Analytics -->.*<!-- End Cloudflare Web Analytics -->/, ""));
  const leakedTest = join(outDir, "shared/rng.test.js");
  await writeFile(leakedTest, "");

  const problems = await validate(outDir, [...files.map((f) => join(outDir, f)), leakedTest], "t3st");
  const expected = [
    "games/02-ojigi-hanko/main.js: ビルドIDが付いていない ./render.js",
    "games/02-ojigi-hanko/main.js: 参照先がない ./missing.js?v=t3st",
    "shared/rng.test.js: テスト用のファイルが含まれている",
    "index.html: games/02-ojigi-hanko/ へのリンクがない",
    "games/02-ojigi-hanko/index.html: アクセス解析のスクリプトがない",
  ];
  assert.deepEqual(expected.filter((p) => !problems.includes(p)), []);
});
