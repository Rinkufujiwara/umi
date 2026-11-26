# ボタンと「押したあとの出方」の見直し（調査と案）

2026-11-27。背景の3Dはさわらない。対象はダッシュボードのボタンと、押したあとに出る画面（ポップアップ・追加・設定・ダイブ・トースト）。

## 1. いまの問題
- ボタンの見た目が約7種類（btn / btn pri / addbtn / calm / nav / linkish / ダイブの時間ボタン）
- 濃い色（btn pri）を「実行」（沈める・潜る）と「選んでいる状態」（重さ・季節・時間）の両方に使っている
- ポップアップには7つのボタンがほぼ同じ重さで並ぶ。どれが主な操作かわからない
- 開き方が場所ごとに違う（ふわっと・下へ広がる・すぐ出る）、速さもばらばら

## 2. 調べた30件と採点
採点：① タスク管理として使いやすい・見やすい ×3、② シンプルでむだがない ×2、③ 湖・凪のコンセプトに合う ×1（各5点、満点30）。★＝採用。

| # | 出どころ | 名前 | 何が良いか | ① | ② | ③ | 計 |
|---|---|---|---|---|---|---|---|
| 1 | GitHub 129k★ | [shadcn/ui](https://github.com/shadcn-ui/ui) | ボタンを default / secondary / outline / ghost / link / destructive の6つの役で分ける。高さ36px、フォーカスの輪3px | 5 | 5 | 3 | 28 ★ |
| 2 | GitHub 19.6k | [Radix Primitives](https://github.com/radix-ui/primitives) | ポップアップ・切り替えの「ふるまい」（Esc、フォーカス、矢印キー） | 5 | 4 | 3 | 26 ★ |
| 3 | GitHub 8.9k | [Radix Themes](https://github.com/radix-ui/themes) | solid / soft / surface / ghost の段階と、切り替え（Segmented Control） | 5 | 4 | 3 | 26 ★ |
| 4 | GitHub 23.6k | [Magic UI](https://github.com/magicuidesign/magicui) | 光る・きらめくボタンなどの演出 | 2 | 2 | 3 | 13 |
| 5 | GitHub 11.2k | [coss.com/ui（Cal.com）](https://github.com/cosscom/ui) | 実務のアプリの、落ち着いた部品 | 4 | 4 | 3 | 23 |
| 6 | GitHub 13.3k | [Sonner](https://github.com/emilkowalski/sonner) | トーストの重なり方。少しゆっくり、ease | 4 | 5 | 4 | 26 ★ |
| 7 | GitHub 8.8k | [Vaul](https://github.com/emilkowalski/vaul) | スマホの下から出る引き出し | 4 | 4 | 4 | 24 |
| 8 | GitHub 13.2k | [cmdk](https://github.com/dip/cmdk) | キーボードで呼ぶコマンドメニュー | 4 | 4 | 2 | 22 |
| 9 | GitHub 35.6k | [Motion](https://github.com/motiondivision/motion) | JS だけで使える press・animate・layout | 4 | 4 | 4 | 24 |
| 10 | GitHub 7.0k | [motion-primitives](https://github.com/ibelick/motion-primitives) | 動きつき部品の型 | 3 | 3 | 3 | 18 |
| 11 | GitHub 52.8k | [React Bits](https://github.com/DavidHDev/react-bits) | 飾りのアニメーションが多い | 2 | 2 | 3 | 13 |
| 12 | GitHub 5.5k | [Ark UI](https://github.com/chakra-ui/ark) | 切り替え・スイッチの状態の扱い | 4 | 4 | 3 | 23 |
| 13 | GitHub 16.1k | [React Spectrum](https://github.com/adobe/react-spectrum) | マウス・指・キーボードで同じに反応する「押す」 | 4 | 3 | 2 | 20 |
| 14 | GitHub 31.3k | [HeroUI](https://github.com/heroui-inc/heroui) | 押したときの縮みと波紋 | 3 | 3 | 3 | 18 |
| 15 | GitHub 43.0k | [daisyUI](https://github.com/saadeghi/daisyui) | クラス名だけでボタンの役を分ける | 3 | 4 | 2 | 19 |
| 16 | GitHub 28.8k | [Headless UI](https://github.com/tailwindlabs/headlessui) | 出るとき・消えるときを別の速さにする書き方 | 4 | 5 | 3 | 25 ★ |
| 17 | GitHub 5.1k | [Animate UI](https://github.com/imskyleen/animate-ui) | 動きつき部品の配布 | 3 | 3 | 3 | 18 |
| 18 | GitHub 7.7k | [Cult UI](https://github.com/nolly-studio/cult-ui) | 目を引く演出の部品 | 2 | 2 | 3 | 13 |
| 19 | GitHub 1.4k | [Web Awesome](https://github.com/shoelace-style/webawesome) | フレームワークなしで使える部品 | 3 | 3 | 2 | 17 |
| 20 | GitHub 11.5k | [Material Web](https://github.com/material-components/material-web) | 動きの長さとカーブを決まりとして持つ | 4 | 3 | 2 | 20 |
| 21 | motion.dev | [Press](https://motion.dev/examples/js-press) | 押すと縮み、離すとばねで戻る | 4 | 5 | 3 | 25 ★ |
| 22 | motion.dev | [Long press](https://motion.dev/examples/js-press-hold) / [Hold to confirm](https://motion.dev/examples/js-hold-to-confirm) | 押し続ける間、輪が満ちる（Umi はもう同じ形） | 4 | 4 | 4 | 24 |
| 23 | motion.dev | [Tab select](https://motion.dev/examples/js-tab-select) | 選んだ所へ白い札がすべる（0.3秒） | 5 | 5 | 4 | 29 ★ |
| 24 | motion.dev | [Shared layout](https://motion.dev/examples/js-shared-layout-animation) | 下線が移り、絵が上下に入れ替わる | 4 | 4 | 4 | 24 |
| 25 | motion.dev | [Modal dialog](https://motion.dev/examples/js-modal) | 標準の dialog に、出入りの動きと背景 | 4 | 4 | 3 | 23 |
| 26 | motion.dev | [Notifications stack](https://motion.dev/examples/js-notifications-stack) | 通知が重なり、押すと広がる | 3 | 3 | 3 | 18 |
| 27 | motion.dev | [Accordion](https://motion.dev/examples/js-accordion) | 開閉の高さの動き | 3 | 4 | 3 | 20 |
| 28 | motion.dev | [Reorder items](https://motion.dev/examples/js-reorder-items) | 並べ替え | 3 | 3 | 3 | 18 |
| 29 | まとめサイト | [Emil Kowalski「Great animations」](https://emilkowal.ski/ui/great-animations) | 300ms未満、出るときは ease-out、キー操作は動かさない、transform と opacity だけ | 5 | 5 | 4 | 29 ★ |
| 30 | まとめサイト | [Apple HIG：Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | 目立つボタンは1画面に1〜2つ、押せる範囲は44×44以上 | 5 | 5 | 3 | 28 ★ |

採らなかったもの：光る・きらめく演出（#4・#11・#18）は目を引くが、凪の「静か」に反する。

## 3. 案：ボタンの決まり（3つの役＋切り替え）
| 役 | 見た目 | 使う所 |
|---|---|---|
| 主 | 濃い青緑、白い文字。**1画面に1つだけ** | 沈める、潜る（設定の画面）、浮かべる、タスクを追加 |
| ふつう | 白に近い面＋細い線 | 潜る（カード）、＋1日／＋3日／＋1週、もう一度潜る |
| 静か | 文字だけ。押せる所はふれると薄く色が出る | 明日へ、浅瀬へ、一覧で編集、やめる、水面へ戻る |
| 危ない | 静かと同じ形で、赤い文字。右端 | 削除 |
| 切り替え | 灰色の溝の中を、白い札がすべる（#23） | 重さ、季節、天気、1日の時間、ダイブの時間、音 |
| スイッチ | いまの凪モードの形のまま | 凪モード |

- 高さは36px（スマホでは押せる範囲を44pxまで広げる）、角の丸み10px。いまの「丸いピル形」はやめて、パネルの角とそろえる
- 押したとき：0.97まで縮み、離すとすぐ戻る（#21。0.8 は大きすぎるので弱める）

## 4. 案：出方の決まり（全部同じにする）
| 動き | 長さ | カーブ | 形 |
|---|---|---|---|
| 開く（ポップアップ・追加・設定・ダイブ） | 220ms | ease-out（cubic-bezier(.2,.8,.2,1)） | 押したボタンの方から、下から8px浮かびながら現れる（0.96→1、透明→不透明） |
| 閉じる | 160ms | ease-in | 6px沈みながら消える（水に沈むように） |
| 切り替えの札 | 300ms | cubic-bezier(.4,0,.2,1)（#23と同じ） | 横にすべる |
| トースト | 400ms | ease（#6） | 下から浮かぶ |
| キーボードで開いたとき | 動かさない（#29） | | |
| 「動きを減らす」設定 | 透明度だけ、120ms | | |

コンセプトとのつながり：開く＝「浮かぶ」、閉じる＝「沈む」。演出はこの2つだけにして、波紋や光は足さない。

## 5. 前と後
`before-after.png`（`mock.html` を画像にしたもの）。左がいま、右が案。

## 6. 進め方（承認後）
1. 戻す地点のタグを作る
2. 決まりを CSS の変数（色・高さ・長さ・カーブ）にまとめ、全ボタンと出方を置きかえる
3. tools/align-check で、3つの幅とスマホでずれとはみ出しを測る
4. 実際に押して確かめ、コミット・プッシュ・公開
5. そのあと、空から見た一覧でブイの大きさをそろえる件（カメラの移動に合わせて少しずつ）
