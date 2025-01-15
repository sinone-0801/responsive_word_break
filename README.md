## responsive word break とは
HTML や PHP で描画される web ページにおいて、画面サイズが変動しても単語内で改行が入らないようにするツール。
日本語・英語・数字に対応。

## JS版の使い方
# htmlと同じディレクトリに responsive-word-break.js を配置
htmlやphpに以下を書き込み。
DOMを読み込んだ後に動作するので、レンダリングは遅いが、サーバーサイドの文字列も処理可能。
```
<head>
    <!-- kuromoji.jsの読み込み -->
    <script src="https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js"></script>
    <!-- スクリプトの読み込み -->
    <script src="responsive-word-break.js"></script>
</head>
```

## Python版の使い方
# 以下を実行すると、 out ディレクトリに入力ファイル名と同名の編集済みファイルができる。
基本的にhtml専用。
サーバーサイドの文字列は処理できないが、事前に処理をしてくれるので、レンダリングは高速。
```
python responsive-word-break.py <input_html_file>
```
