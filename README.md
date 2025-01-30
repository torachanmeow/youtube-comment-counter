# YouTubeライブチャット集計 & ポイント計算システム

## 概要
このシステムは、YouTubeのライブチャットをリアルタイムで取得し、スーパーチャット、メンバーシップ登録、高評価、特定ワードの出現頻度を集計し、ポイント化するツールです。

## 主な機能
### ✅ ライブチャットの取得
- YouTube APIを使用し、指定した動画のライブチャットを一定間隔で取得
- チャットメッセージの表示とハイライト
- ユーザーごとの発言履歴を管理し、特定ワードのカウント

### ✅ 統計情報の集計
- スーパーチャット金額の合計
- スーパーステッカー金額の合計
- メンバーシップの登録数
- 高評価数の取得・更新
- 特定ワードの出現回数カウント

### ✅ ポイント計算
- 各要素に対して重みを設定し、ポイント化
- 特定ワードごとに重みを設定し、累積ポイントを計算
- スーパーチャットの金額を為替レートに基づいて日本円に換算し、スコア計算

### ✅ UI機能
- APIキー & 動画IDの入力欄
- 為替レートの手動調整モーダル
- 集計結果のリアルタイム表示
- 合計ポイントの表示 & クリップボードコピー
- ライブチャットメッセージの色分け
  - スーパーチャット → **赤**
  - メンバー加入 → **緑**
  - 特定ワードを含む発言 → **ハイライト表示**
- 通知システム
  - APIエラーや処理の完了を通知

## システムの動作フロー
1. APIキー & 動画IDを入力し、「開始」ボタンを押す
2. YouTube APIからライブチャットのIDを取得
3. YouTube APIから動画情報を取得（タイトル、チャンネル名、高評価数など）
4. ライブチャットを一定間隔で取得 & 解析
5. スーパーチャット・特定ワード・メンバー登録などをカウント
6. 各データをポイントに変換し、画面に表示
7. 「停止」ボタンを押すと、処理を終了 & UIをリセット

## 技術構成
- **言語:** JavaScript (Vanilla JS)
- **API:** YouTube Data API v3
- **ストレージ:** localStorage（為替レート & 設定情報の保存）
- **UI:** HTML + CSS（簡易的なデザイン & モーダル機能）
- **データ管理:**
  - `liveChatData` → ライブチャットのデータ格納
  - `exchangeRates` → 為替レートデータ
  - `userWordHistory` → ユーザーごとの発言履歴

## 使い方
### 1. 必要な情報を入力
- YouTube APIキーを取得し、APIキー欄に入力
- 解析したい動画のIDを入力

### 2. 設定を調整
- 特定ワードと重みを設定
- 高評価・スーパーチャット・メンバーシップの重みを設定
- 為替レートを調整（必要に応じて）

### 3. ライブチャットの解析を開始
- 「開始」ボタンを押すとデータ取得開始
- 一定間隔でチャットの更新・解析を実施

### 4. 解析結果の確認
- 集計結果がリアルタイムで画面に表示
- 特定ワードの出現回数が記録
- ポイントが自動で計算される

### 5. 停止 & データリセット
- 「停止」ボタンを押すと、処理が終了
- 入力欄が再び編集可能に

## ライセンス
このプロジェクトはMITライセンスのもとで提供されます。
