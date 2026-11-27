# 放課後ヒント部

高校生がテスト前のつまずきを選んで投稿し、友達が段階別のヒントを届ける掲示板。数学・英語・理科・国語・地歴・情報から選べます。質問とヒントは端末をまたいで共有され、質問は7日間掲載されます。

[公開サイト](https://houkago-hint-board-dfdga6abbdfjancz.koreacentral-01.azurewebsites.net/) · [要件定義](requirements.md)

## 手元で動かす

Node.js 24で、リポジトリの直下から実行します。外部パッケージのインストールは不要です。

```sh
npm start
```

ブラウザで http://localhost:8080 を開きます。2つの別ブラウザで開き、片方で質問を投稿し、もう片方で「一覧を更新」してヒントを送ると、共有を確認できます。試した投稿はローカルの `.local-data/` に保存されます。

## Azure App Serviceで公開する

1. Azure Portalで「App Services」→「Create」→「Web App」を開き、専用のリソースグループを選びます。
2. 公開方法は「Code」、OSは「Linux」、ランタイムは「Node 24 LTS」を指定します。このサイトは学生契約の許可地域「Korea Central」に配置しました。自分の許可地域は「Policy」→「Assignments」→「Allowed resource deployment regions」→「Parameters」で確認できます。
3. 地域を決めてから料金プランを「Free F1」にし、「Review + create」で見積もりが「Free」であることを確認して作成します。
4. 手元のリポジトリ直下で次のコマンドを実行すると、配信用ファイルだけが入ったZIPを作れます。
   
   ```sh
   git archive --format=zip --output=houkago-site.zip HEAD package.json server.js public
   ```
5. 作成したWeb Appの「Deployment Center」→「Manual Deployment (Push)」→「Publish files」でZIPを選び、デプロイします。配信内容を更新するときも同じ手順です。
6. Web Appの「Overview」→「Default domain」を開き、画面の表示と「一覧を更新」を確認します。

## ファイル構成

- `public/` はブラウザに配信するHTML・CSS・JavaScriptと質問カードです。
- `server.js` は静的ファイルを配信し、`/api/posts` と `/api/hints` で質問とヒントを扱います。
- 1インスタンス・1プロセスでの利用を想定しています。Azureでの保存先は `/home/data/houkago-hint-board/` です。テスト用の保存先は環境変数 `BOARD_DATA_DIR` で指定できます。
