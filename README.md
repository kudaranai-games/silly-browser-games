# silly-browser-games

くだらないけど面白い、短いブラウザゲーム集。
静的ファイルだけで動き、サーバーや外部APIは使わない。

## フォルダ構成

| パス | 内容 |
|---|---|
| `index.html` | ゲーム一覧ページ |
| `shared/` | 全ゲーム共通のモジュール（乱数・保存・シェアなど）と同梱ライブラリ（`vendor/`） |
| `games/<番号>-<名前>/` | 1ゲーム1フォルダ。`logic/` は DOM に依存しない判定ロジックで、`tests/` でテストする |
| `tools/serve.mjs` | 開発用のローカルサーバー |
| `tools/build.mjs` | （未作成）公開用ファイルを `dist/pages/`（GitHub Pages）と `dist/itch/`（itch.io 用 zip）に出力する |

## ローカルで遊ぶ

ES Modules を使っているため、`file://` では動かない。ローカルサーバーで開く。
`tools/serve.mjs` はキャッシュを禁止して返すので、編集後に古いJSが読まれることがない。

```sh
npm run serve
# → http://127.0.0.1:8765/games/02-ojigi-hanko/
```

## テスト

```sh
npm test
```
