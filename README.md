# silly-browser-games

くだらないけど面白い、短いブラウザゲーム集。
静的ファイルだけで動き、サーバーや外部APIは使わない。

## フォルダ構成

| パス | 内容 |
|---|---|
| `index.html` | ゲーム一覧ページ。ゲームを追加したらここにリンクを足す（足さないとビルドが失敗する） |
| `shared/` | 全ゲーム共通のモジュール（乱数・保存・シェア・演出・効果音） |
| `shared/vendor/` | 外部ライブラリ（ライセンスファイルと一緒に置く）。物理演算の Matter.js 0.20.0（MIT）は npm の配布物の `build/matter.min.js` をそのまま置いている |
| `games/<番号>-<名前>/` | 1ゲーム1フォルダ。`logic/` は DOM に依存しない判定ロジックで、`tests/` でテストする |
| `tools/serve.mjs` | 開発用のローカルサーバー |
| `tools/build.mjs` | 公開用ファイルを `dist/pages/` に出力する |
| `.github/workflows/pages.yml` | main への push で、テスト → ビルド → GitHub Pages へのデプロイを行う |

## ローカルで遊ぶ

ES Modules を使っているため、`file://` では動かない。ローカルサーバーで開く。
`tools/serve.mjs` はキャッシュを禁止して返すので、編集後に古いJSが読まれることがない。

```sh
npm run serve
# → http://127.0.0.1:8765/games/01-mannin-densha/ など
```

## テスト

```sh
npm test
```

## 公開

```sh
npm run build
```

- `index.html`・`shared/`・`games/` だけを `dist/pages/` にコピーする。`tests/` と `*.test.js` は除く。
- JS・CSS・データの参照に `?v=<コミットのハッシュ>` を付け、更新後に古いキャッシュが使われないようにする。
- 出力を検査し、参照切れ・ビルドIDの付け忘れ・テストの混入・一覧ページからのリンク漏れ・アクセス解析の入れ忘れがあれば失敗する。

GitHub Pages の公開元（Settings → Pages → Source）は「GitHub Actions」にする。
