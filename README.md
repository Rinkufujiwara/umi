# Umi

湖に浮かぶブイでタスクを管理するダッシュボード。終えたタスクは沈めて、湖底に積もっていきます。

A task dashboard where tasks float as buoys on a low-poly lake. Finish one and it sinks, piling up on the lake bed.

## しくみ

- **置き場所**：奥＝時間の余裕（期限までの日数 − 作業にかかる日数）、右＝重さ（軽い・ふつう・重い、必須は少し右）
- **沈める**：ブイを押して「沈める」。湖底の山にそのまま積もる
- **見え方の切り替え**：ホイールで 空から見る一覧 ↔ 水面 ↔ 湖底
- **空と水面**：時刻で明るさが変わり、やることの詰まり具合（今日の潮位・7日先の詰まり・遅れ・急ぎ）で天気と波が変わる
- **急ぎの知らせ**：小さな背びれがブイのまわりを回り、ときどき触れて揺らす
- **すばやい入力**：「明日15時 統計の課題 #大学 1時間 必須 重い」のように打つと読み取る

データはブラウザの中（localStorage）だけに保存します。

## 使っているもの

three.js（Water・Sky）、GSAP（Observer）、SunCalc、chrono-node、SortableJS、tinykeys、Lenis。ビルドは不要で、静的ファイルとして配信できます。

```
python -m http.server 8835
```
