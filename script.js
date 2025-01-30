let liveChatPolling = null;
let liveChatData = null;
let pendingGiftCount = 0; // 受け取る予定のギフトメンバー数
let userWordHistory = {}; // ユーザーごとの発言履歴を保存するオブジェクト

const MAX_CHAT_LINES = 500;  // 最大表示チャット行数（画面に見える数）
const MAX_MESSAGE_IDS = 5000; // 取得済みメッセージIDの最大数（カウント管理用）
const USER_HISTORY_LIMIT = 1000; // 最大ユーザー数 (重複コメントカウント管理用)

// 為替レートの初期値
let exchangeRates = JSON.parse(localStorage.getItem('LiveChatExchangeRate'))?.exchangeRates || {
    // 主要通貨（メジャーカレンシー / G10通貨）
    "USD": 150,  // アメリカドル
    "EUR": 160,  // ユーロ
    "JPY": 1,    // 日本円
    "GBP": 180,  // イギリスポンド
    "CHF": 155,  // スイスフラン
    "CAD": 110,  // カナダドル
    "AUD": 100,  // オーストラリアドル
    "NZD": 90,   // ニュージーランドドル

    // 取引量の多い新興市場通貨（エマージングマーケット通貨）
    "CNY": 21,   // 中国人民元
    "HKD": 17.5, // 香港ドル
    "SGD": 105,  // シンガポールドル
    "KRW": 0.12, // 韓国ウォン
    "INR": 1.8,  // インドルピー
    "BRL": 28,   // ブラジルレアル
    "RUB": 1.9,  // ロシアルーブル
    "MXN": 8.2,  // メキシコペソ
    "ZAR": 7.5,  // 南アフリカランド
    "TRY": 5.8,  // トルコリラ

    // その他の通貨
    "SEK": 13,   // スウェーデンクローナ
    "NOK": 14,   // ノルウェークローネ
    "DKK": 19,   // デンマーククローネ
    "PLN": 32,   // ポーランドズロチ
    "CZK": 6.5,  // チェココルナ
    "HUF": 0.38, // ハンガリーフォリント
    "MYR": 31,   // マレーシアリンギット
    "THB": 4.2,  // タイバーツ
    "IDR": 0.009, // インドネシアルピア
    "VND": 0.006, // ベトナムドン
    "CLP": 0.16, // チリペソ
    "COP": 0.035, // コロンビアペソ
    "PEN": 38,   // ペルーソル
    "ISK": 1.0,  // アイスランドクローナ
    "BGN": 75,   // ブルガリアレフ
    "HRK": 20,   // クロアチアクーナ
    "RON": 30,   // ルーマニアレイ
    "KZT": 0.3,  // カザフスタンテンゲ
    "SAR": 36,   // サウジアラビアリヤル
    "AED": 37,   // アラブ首長国連邦ディルハム
    "PHP": 2.7,  // フィリピンペソ
    "TWD": 4.8,  // 台湾ドル
    "ARS": 0.6   // アルゼンチンペソ
};

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const apiKeyInput = document.getElementById('apiKey');
const videoIdInput = document.getElementById('videoId');
const videoDetailsDiv = document.getElementById('videoDetails');
const liveChatDiv = document.getElementById('liveChat');
const statusDiv = document.getElementById('status');
const lastFetchTimeDiv = document.getElementById('lastFetchTime');
const pollingIntervalInput = document.getElementById('pollingInterval');
const statsDisplay = document.getElementById('statsDisplay');
const wordCountsContainer = document.getElementById('wordCountsContainer');
const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');

const modal = document.getElementById('exchangeRateModal');
const openBtn = document.getElementById('openExchangeRateModal');
const closeBtn = document.getElementById('closeModal');
const saveExchangeRatesBtn = document.getElementById('saveExchangeRates');

// 為替レートをロードする関数
async function loadExchangeRates() {
    try {
        const storedData = localStorage.getItem('LiveChatExchangeRate');
        if (!storedData) {
            showNotification('エラー: 為替レートデータが見つかりません', 'error');
            throw new Error('ローカルストレージに為替レートデータがありません');
        }

        const exchangeRateData = JSON.parse(storedData);

        if (!exchangeRateData.exchangeRates) {
            showNotification('エラー: 為替レート情報が正しくありません', 'error');
            throw new Error('為替レート情報が不正な形式です');
        }

        exchangeRates = exchangeRateData.exchangeRates;
        console.log('為替レートがロードされました:', exchangeRates);
    } catch (error) {
        console.error('為替レートのロードに失敗しました:', error);
        exchangeRates = {}; // 空のオブジェクトにリセット
    }
}

// 特定ワード入力ボックス
const wordInputs = [
    document.getElementById('word1'),
    document.getElementById('word2'),
    document.getElementById('word3')
];

// 特定ワードを取得する関数
function getSpecialWords() {
    const specialWords = wordInputs.map(input => input.value.trim()).filter(word => word !== '');
    console.log("特定ワードリスト:", specialWords); // デバッグログ
    return specialWords;
}

// 集計対象の初期化
function initializeStats() {
    const specialWords = getSpecialWords(); // 特定ワードを取得
    const wordCounts = specialWords.reduce((counts, word) => {
        counts[word] = 0; // 初期値を設定
        return counts;
    }, {});
    return {
        superChats: 0,
        superStickers: 0,
        members: 0,
        likes: 0,
        wordCounts
    };
}

// 入力欄を有効化/無効化する関数
function disableInputs(disable) {
    // リクエスト設定欄
    apiKeyInput.disabled = disable;
    videoIdInput.disabled = disable;
    pollingIntervalInput.disabled = disable;

    // キーワードの入力欄
    document.querySelectorAll('#word1, #word2, #word3').forEach(input => (input.disabled = disable)); 

    // キーワードの重み欄
    document.querySelectorAll('#weight1, #weight2, #weight3').forEach(input => (input.disabled = disable));

    // その他重みの入力欄
    document.querySelectorAll('#likeWeight, #superChatWeight, #superStickerWeight, #memberWeight').forEach(input => (input.disabled = disable));
}

// 集計結果を更新して表示
function updateStatsDisplay(stats) {
   // 既存の集計結果表示を更新
    document.getElementById('superChatAmount').textContent = `¥${stats.superChats.toLocaleString()}`;
    document.getElementById('superStickerAmount').textContent = `¥${stats.superStickers.toLocaleString()}`;
    document.getElementById('newMembers').textContent = stats.members;
    document.getElementById('likeCount').textContent = stats.likes;

    // 特定ワードの更新
    wordCountsContainer.innerHTML = ''; // 特定ワード表示をクリア

    Object.entries(stats.wordCounts).forEach(([word, count]) => {
        // 特定ワードを高評価やスーパーチャットと同じ形式で表示
        const wordItem = document.createElement('div');
        wordItem.className = 'stat-item'; // 他と同じスタイルを適用

        const wordLabel = document.createElement('span');
        wordLabel.className = 'stat-label'; // ラベルのスタイル
        wordLabel.textContent = `${word}:`; // ワード名

        const wordValue = document.createElement('span');
        wordValue.className = 'stat-value'; // 値のスタイル
        wordValue.textContent = count; // 出現回数

        wordItem.appendChild(wordLabel); // ラベルを追加
        wordItem.appendChild(wordValue); // 値を追加
        wordCountsContainer.appendChild(wordItem); // コンテナに追加
    });
    
    // ポイント換算結果を更新
    updatePointsDisplay(stats);
}

// ポイント換算結果を更新する関数
function updatePointsDisplay(stats) {
    // 重みの取得
    const likeWeight = parseFloat(document.getElementById('likeWeight').value) || 0;
    const superChatWeight = parseFloat(document.getElementById('superChatWeight').value) || 0;
    const superStickerWeight = parseFloat(document.getElementById('superStickerWeight').value) || 0;
    const memberWeight = parseFloat(document.getElementById('memberWeight').value) || 0;

    // 各ポイントを計算
    const likePoints = stats.likes * likeWeight;
    const superChatPoints = stats.superChats * superChatWeight;
    const superStickerPoints = stats.superStickers * superStickerWeight;
    const memberPoints = stats.members * memberWeight;

    // 特定ワードのポイントを計算
    const wordPointsContainer = document.getElementById('wordPointsContainer');
    wordPointsContainer.innerHTML = ''; // 初期化
    let totalWordPoints = 0;

    Object.entries(stats.wordCounts).forEach(([word, count], index) => {
        const wordWeight = parseFloat(document.getElementById(`weight${index + 1}`).value) || 0; // 重みを取得
        const wordPoints = count * wordWeight;
        totalWordPoints += wordPoints;

        // 特定ワードポイントを表示
        const wordItem = document.createElement('div');
        wordItem.className = 'points-item';

        const wordLabel = document.createElement('span');
        wordLabel.className = 'points-label';
        wordLabel.textContent = `${word}:`;

        const wordValue = document.createElement('span');
        wordValue.className = 'points-value';
        wordValue.textContent = wordPoints.toFixed(0); // 小数点以下を四捨五入して整数に変換

        wordItem.appendChild(wordLabel);
        wordItem.appendChild(wordValue);
        wordPointsContainer.appendChild(wordItem);
    });

    // 表示を更新
    document.getElementById('likePoints').textContent = likePoints.toFixed(0);
    document.getElementById('superChatPoints').textContent = superChatPoints.toFixed(0);
    document.getElementById('superStickerPoints').textContent = superStickerPoints.toFixed(0);
    document.getElementById('memberPoints').textContent = memberPoints.toFixed(0);
    // document.getElementById('totalPoints').textContent = totalPoints.toFixed(0); // 紛らわしいのでなくす

    // 合計ポイントを「最新のコメント取得時間」の下に表示
    // 端数を処理した状態で加算しないと表示結果と誤差がでる場合あり
    document.getElementById('totalPointsDisplay').textContent = 
        [likePoints, superChatPoints, superStickerPoints, memberPoints, totalWordPoints].map(p => Number(p.toFixed(0))).reduce((sum, p) => sum + p, 0); // 合計を計算
}

// 特定ワードをカウントしつつ、ハイライトを適用
function countWords(authorId, message, wordCounts) {
    if (!userWordHistory[authorId]) {
        userWordHistory[authorId] = { words: new Set(), lastActive: Date.now() };
    }

    userWordHistory[authorId].lastActive = Date.now();

    let matchedWords = new Set(); // **一時的なカウントリスト**

    // **メッセージ内のワードを検出**
    Object.keys(wordCounts).forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        if (message.match(regex)) {
            matchedWords.add(word); // **見つかったワードをセットに追加**
        }
    });

    // **ワードを1回だけカウント**
    matchedWords.forEach(word => {
        if (!userWordHistory[authorId].words.has(word)) {
            wordCounts[word]++;
            userWordHistory[authorId].words.add(word);
        }
    });

    // **ハイライト適用（カウント後に実施）**
    Object.keys(wordCounts).forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        message = message.replace(regex, `<span class="chat-highlight">$1</span>`);
    });

    return message;
}

// ライブチャットデータの初期化
function initializeLiveChatData() {
    return {
        videoDetails: {},
        comments: [],
        stats: initializeStats(),
        fetchedMessageIds: new Set(),
    };
}

// APIリクエストの共通関数
async function fetchYouTubeAPI(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTPエラー: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('APIリクエストエラー:', error);
        return null;
    }
}

// ライブチャットIDを取得
async function getLiveChatId(apiKey, videoId) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
    const data = await fetchYouTubeAPI(url);
    if (data && data.items && data.items.length > 0) {
        return data.items[0].liveStreamingDetails?.activeLiveChatId || null;
    }
    return null;
}

// 動画情報を取得
async function getVideoDetails(apiKey, videoId) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;
    const data = await fetchYouTubeAPI(url);
    if (data && data.items && data.items.length > 0) {
        const video = data.items[0];
        return {
            title: video.snippet.title,
            publishedAt: video.snippet.publishedAt,
            channelTitle: video.snippet.channelTitle,
            likeCount: parseInt(video.statistics.likeCount || '0', 10),
        };
    }
    return null;
}

// 動画情報を定期的に取得
async function fetchVideoDetails(apiKey, videoId) {
    const videoDetails = await getVideoDetails(apiKey, videoId);
    if (videoDetails) {
        liveChatData.videoDetails = videoDetails; // 動画情報を更新
        liveChatData.stats.likes = videoDetails.likeCount || 0; // 高評価数を更新
        updateStatsDisplay(liveChatData.stats); // 統計データを表示に反映
        displayVideoDetails(videoDetails); // 整形して動画情報を表示
        console.log('高評価数更新:', videoDetails.likeCount); // デバッグ用ログ
    }
}

// 動画情報を整形して表示
function displayVideoDetails(details) {
    videoDetailsDiv.innerHTML = ''; // 既存の内容をクリア

    // 動画情報を整形して表示
    const videoDetailsContainer = document.createElement('div');
    videoDetailsContainer.className = 'video-details-container';

    // タイトル
    const titleElement = document.createElement('div');
    titleElement.className = 'detail-item';
    titleElement.innerHTML = `<strong>タイトル:</strong> ${details.title}`;
    videoDetailsContainer.appendChild(titleElement);

    // チャンネル名
    const channelElement = document.createElement('div');
    channelElement.className = 'detail-item';
    channelElement.innerHTML = `<strong>チャンネル:</strong> ${details.channelTitle}`;
    videoDetailsContainer.appendChild(channelElement);

    // 公開日時
    const publishedAtElement = document.createElement('div');
    publishedAtElement.className = 'detail-item';
    publishedAtElement.innerHTML = `<strong>公開日:</strong> ${new Date(details.publishedAt).toLocaleString()}`;
    videoDetailsContainer.appendChild(publishedAtElement);

    // 高評価数
    const likeCountElement = document.createElement('div');
    likeCountElement.className = 'detail-item';
    likeCountElement.innerHTML = `<strong>高評価:</strong> ${details.likeCount.toLocaleString()}`;
    videoDetailsContainer.appendChild(likeCountElement);

    // 表示エリアに追加
    videoDetailsDiv.appendChild(videoDetailsContainer);
}

// チャットメッセージを取得して表示
async function fetchLiveChat(apiKey, liveChatId, isInitialLoad = false) {
    const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&maxResults=500&key=${apiKey}`;
    const data = await fetchYouTubeAPI(url);

    if (data && data.items) {
        data.items.forEach(item => {
            const messageId = item.id;
            const authorId = item.authorDetails.channelId;
            const authorName = item.authorDetails.displayName;
            let message = item.snippet.displayMessage;

            if (!isInitialLoad && liveChatData.fetchedMessageIds.has(messageId)) {
                return; // 既に取得済みならスキップ
            }
            liveChatData.fetchedMessageIds.add(messageId);

            // **チャットメッセージの表示エリアを作成**
            const chatMessageDiv = document.createElement('div');
            chatMessageDiv.className = 'chat-message';

            // **名前部分**
            const authorSpan = document.createElement('span');
            authorSpan.className = 'chat-author';
            authorSpan.textContent = `[${authorName}] `;

            // **メッセージ部分**
            const messageSpan = document.createElement('span');
            messageSpan.className = 'chat-text';

            // **特定ワードをカウントしつつ、ハイライトを適用**
            message = countWords(authorId, message, liveChatData.stats.wordCounts);
            messageSpan.innerHTML = message; // ハイライト適用済みのメッセージ

            // **スーパーチャットの処理**
            if (item.snippet.superChatDetails) {
                const amount = parseFloat(item.snippet.superChatDetails.amountDisplayString.replace(/[^\d.-]/g, '')) || 0;
                const currency = item.snippet.superChatDetails.currency;
                const jpyAmount = convertToJPY(amount, currency);

                if (jpyAmount !== null) {
                    messageSpan.classList.add('chat-superchat'); // **赤色**
                    messageSpan.textContent += ` => 日本円: ¥${jpyAmount.toLocaleString()}`;
                    liveChatData.stats.superChats += jpyAmount;
                } else {
                    console.warn(`サポートされていない通貨: ${currency}`);
                }
            }

            // **スーパーステッカーの処理**
            if (item.snippet.superStickerDetails) {
                const amount = parseFloat(item.snippet.superStickerDetails.amountDisplayString.replace(/[^\d.-]/g, '')) || 0;
                const currency = item.snippet.superStickerDetails.currency;
                const jpyAmount = convertToJPY(amount, currency);

                if (jpyAmount !== null) {
                    messageSpan.classList.add('chat-supersticker'); // **赤色**
                    messageSpan.textContent += ` => 日本円: ¥${jpyAmount.toLocaleString()}`;
                    liveChatData.stats.superStickers += jpyAmount;
                }
            }

            // **ギフトメンバーの送信**
            if (isGiftedMembership(message)) {
                const giftCount = getGiftedMembershipCount(message);
                pendingGiftCount += giftCount;
                messageSpan.classList.add('chat-member'); // **緑色**
                messageSpan.textContent += ` => ${giftCount}名にギフトメンバーシップが贈られました！`;
                console.log(`${authorName} が ${giftCount} 名にギフトメンバーシップを贈りました`);
            }

            // **ギフトメンバーの受取**
            if (isReceivedGiftMembership(message)) {
                if (pendingGiftCount > 0) {
                    messageSpan.classList.add('chat-member'); // **緑色**
                    messageSpan.textContent += ` => ギフトメンバーシップを受け取りました！`;
                    liveChatData.stats.members++;
                    pendingGiftCount--;
                }
            }

            // **通常のメンバー加入**
            if (isNewMember(message)) {
                if (pendingGiftCount > 0) {
                    messageSpan.classList.add('chat-member'); // **緑色**
                    messageSpan.textContent += ` => ギフトメンバーシップを受け取りました！`;
                    liveChatData.stats.members++;
                    pendingGiftCount--;
                } else {
                    messageSpan.classList.add('chat-member'); // **緑色**
                    messageSpan.textContent += ` => 通常の新規メンバー加入！`;
                    liveChatData.stats.members++;
                }
            }

            // **名前とメッセージを追加**
            chatMessageDiv.appendChild(authorSpan);
            chatMessageDiv.appendChild(messageSpan);

            // **チャット表示エリアに追加**
            liveChatDiv.appendChild(chatMessageDiv);

            // **コメントデータを保存**
            liveChatData.comments.push({ id: messageId, message: `[${authorName}] ${message}` });
        });

        // **統計を更新**
        lastFetchTimeDiv.textContent = new Date().toLocaleTimeString();
        updateStatsDisplay(liveChatData.stats);

        // **表示制限とメモリ管理**
        limitChatLines(); // 最新 MAX_CHAT_LINES 件だけ表示
        cleanFetchedMessageIds(); // メモリ管理（最大 MAX_MESSAGE_IDS 件のメッセージIDを保持）
        cleanLiveChatData();     // チャット履歴 & ユーザー履歴のメモリ管理
    }
}

// ギフトメンバーを贈ったメッセージの検出
function isGiftedMembership(message) {
    return message.includes("gifted") && message.includes("memberships");
}

// ギフトの受取人メッセージの検出
function isReceivedGiftMembership(message) {
    return message.includes("was gifted a membership by");
}

// 新規メンバー加入のメッセージ（ギフト以外）
function isNewMember(message) {
    return message.includes("just became a member!");
}

// ギフトメンバーの人数を取得（デフォルト1人）
function getGiftedMembershipCount(message) {
    const match = message.match(/gifted (\d+) memberships/);
    return match ? parseInt(match[1], 10) : 1; // 数字がなければ1をデフォルト
}

// チャットの行数を制限
function limitChatLines() {
    const chatMessages = liveChatDiv.children;
    while (chatMessages.length > MAX_CHAT_LINES) {
        liveChatDiv.removeChild(chatMessages[0]); // 最も古いメッセージを削除
    }
}

// ユーザー履歴をリセット
function resetWordHistory() {
    userWordHistory = {}; // 全ユーザーの履歴をリセット
    console.log("🔄 ユーザー履歴がリセットされました");
}

// fetchedMessageIds の容量を抑える (メモリ使用量の削減)
function cleanFetchedMessageIds() {
    if (liveChatData.fetchedMessageIds.size > MAX_MESSAGE_IDS) {
        const oldestIds = Array.from(liveChatData.fetchedMessageIds).slice(0, liveChatData.fetchedMessageIds.size - MAX_MESSAGE_IDS);
        oldestIds.forEach(id => liveChatData.fetchedMessageIds.delete(id)); // 古いIDを削除
    }
}

// メモリ管理：チャット履歴 & ユーザー履歴の制限
function cleanLiveChatData() {
    // **チャット履歴が増えすぎないよう制限**
    if (liveChatData.comments.length > MAX_MESSAGE_IDS) {
        liveChatData.comments.splice(0, liveChatData.comments.length - MAX_MESSAGE_IDS);
    }

    // **userWordHistory のメモリ管理（古いユーザー履歴を削除）**
    if (Object.keys(userWordHistory).length > USER_HISTORY_LIMIT) {
        // ユーザーIDごとに最終発言時刻を取得してソート
        const sortedUsers = Object.entries(userWordHistory)
            .sort((a, b) => a[1].lastActive - b[1].lastActive) // 昇順（古い順）
            .slice(0, Object.keys(userWordHistory).length - USER_HISTORY_LIMIT); // 超過分だけ取得

        // 古いユーザーを削除
        sortedUsers.forEach(([userId]) => delete userWordHistory[userId]);
    }
}

// スーパーチャットの金額を日本円に変換する関数
function convertToJPY(amount, currency) {
    if (!exchangeRates || typeof exchangeRates !== 'object') {
        console.error("エラー: 為替レートがロードされていません。");
        return null;
    }

    if (!currency || typeof currency !== 'string') {
        console.error("エラー: 通貨コードが無効です。");
        return null;
    }

    const rate = exchangeRates[currency.toUpperCase()];
    if (rate) {
        return Math.round(amount * rate); // 円に換算して四捨五入
    }

    console.warn(`サポートされていない通貨: ${currency}`);
    return null; // サポートされていない通貨の場合
}

// 開始ボタンクリックイベント
startBtn.addEventListener('click', async () => {
    // 為替レートのロード
    await loadExchangeRates();

    // 為替レートが空の場合は処理を中止
    if (Object.keys(exchangeRates).length === 0) {
        showNotification("エラー: 為替レートが見つかりません。処理を中止します。", "error");
        return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    const videoId = videoIdInput.value.trim();
    const pollingInterval = parseInt(pollingIntervalInput.value, 10) || 30;

    if (!apiKey || !videoId) {
        // alert('APIキーと動画IDを入力してください。');
        showNotification("APIキーと動画IDを入力してください。", "error");
        return;
    }

    // 集計結果、ライブチャット、動画情報をクリア
    liveChatData = initializeLiveChatData(); // データを初期化
    videoDetailsDiv.innerHTML = ''; // 動画情報をクリア
    liveChatDiv.textContent = ''; // チャット内容をクリア
    wordCountsContainer.innerHTML = ''; // 特定ワードカウントをクリア
    updateStatsDisplay(liveChatData.stats); // 集計結果をリセット
    statusDiv.textContent = ''; // ステータスをリセット
    lastFetchTimeDiv.textContent = '未取得'; // 最新取得時間をリセット

    disableInputs(true);

    const liveChatId = await getLiveChatId(apiKey, videoId);
    const videoDetails = await getVideoDetails(apiKey, videoId);

    if (liveChatId && videoDetails) {
        liveChatData = initializeLiveChatData();
        liveChatData.videoDetails = videoDetails;
        liveChatData.stats.likes = videoDetails.likeCount || 0;

        // 動画情報を整形して表示
        displayVideoDetails(videoDetails);

        // 点滅効果の付与
        document.querySelector('.status').classList.add('executing');

        // ステータス表示を更新
        statusDiv.textContent = 'ライブチャット取得中...';

        showNotification("開始しました！");

        startBtn.disabled = true;
        stopBtn.disabled = false;

        // 初回のライブチャット取得
        await fetchLiveChat(apiKey, liveChatId, true);

        // ライブチャットと動画情報のポーリングを開始
        liveChatPolling = setInterval(() => {
            fetchLiveChat(apiKey, liveChatId, false);
            fetchVideoDetails(apiKey, videoId); // 高評価数なども更新
        }, pollingInterval * 1000);
    } else {
        // alert('ライブチャットIDまたは動画情報が取得できませんでした。');
        showNotification("ライブチャットIDまたは動画情報が取得できませんでした。", "error");
        disableInputs(false);
    }
});

// 停止ボタンクリックイベント
stopBtn.addEventListener('click', () => {
    clearInterval(liveChatPolling); // ポーリングを停止
    resetWordHistory(); // ユーザー履歴をリセット
    liveChatPolling = null;

    // 点滅効果の削除
    document.querySelector('.status').classList.remove('executing');

    // ステータスをリセット
    statusDiv.textContent = ''; 

    showNotification("停止しました！");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    disableInputs(false);
});

// APIキーのマスキング切り替えイベント
toggleApiKeyBtn.addEventListener("click", function () {
    const apiKeyInput = document.getElementById("apiKey");
    if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text"; // 表示
        this.textContent = "隠す";
    } else {
        apiKeyInput.type = "password"; // マスキング
        this.textContent = "表示";
    }
});

// 設定を保存する関数
function saveSettings() {
    const settings = {
        apiKey: apiKeyInput.value.trim(),
        videoId: videoIdInput.value.trim(),
        pollingInterval: pollingIntervalInput.value.trim(),
        likeWeight: document.getElementById('likeWeight').value.trim(),
        superChatWeight: document.getElementById('superChatWeight').value.trim(),
        superStickerWeight: document.getElementById('superStickerWeight').value.trim(),
        memberWeight: document.getElementById('memberWeight').value.trim(),
        word1: document.getElementById('word1').value.trim(),
        weight1: document.getElementById('weight1').value.trim(),
        word2: document.getElementById('word2').value.trim(),
        weight2: document.getElementById('weight2').value.trim(),
        word3: document.getElementById('word3').value.trim(),
        weight3: document.getElementById('weight3').value.trim(),
    };
    localStorage.setItem('LiveChatSettings', JSON.stringify(settings));
    console.log('設定が保存されました:', settings);
}

// 設定をロードする関数
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('LiveChatSettings'));
    if (settings) {
        apiKeyInput.value = settings.apiKey || '';
        videoIdInput.value = settings.videoId || '';
        pollingIntervalInput.value = settings.pollingInterval || '10';
        document.getElementById('likeWeight').value = settings.likeWeight || '0';
        document.getElementById('superChatWeight').value = settings.superChatWeight || '0';
        document.getElementById('superStickerWeight').value = settings.superStickerWeight || '0';
        document.getElementById('memberWeight').value = settings.memberWeight || '0';
        document.getElementById('word1').value = settings.word1 || '';
        document.getElementById('weight1').value = settings.weight1 || '0';
        document.getElementById('word2').value = settings.word2 || '';
        document.getElementById('weight2').value = settings.weight2 || '0';
        document.getElementById('word3').value = settings.word3 || '';
        document.getElementById('weight3').value = settings.weight3 || '0';
        console.log('設定がロードされました:', settings);
    }
}

// 入力変更時に自動で保存するイベントリスナーを設定
function setupAutoSave() {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', saveSettings);
    });
}

// 為替レートリストをモーダル画面のリストに展開
function renderExchangeRates() {
    const tableBody = document.getElementById('exchangeRateTable');
    tableBody.innerHTML = '';
    Object.keys(exchangeRates).forEach(currency => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${currency}</td>
            <td><input type="number" step="0.01" value="${exchangeRates[currency]}" data-currency="${currency}"></td>
        `;
        tableBody.appendChild(row);
    });
}

// 為替レートの状態を更新する関数
function updateExchangeRateDisplay() {
    const exchangeRateInput = document.getElementById('exchangeRateInput'); // 入力欄の要素
    const storedRates = localStorage.getItem('LiveChatExchangeRate');

    if (storedRates) {
        exchangeRateInput.value = "設定済です。必要のつど調整してください"; // 設定されている場合
    } else {
        exchangeRateInput.value = "未設定。設定が必要です"; // 未設定の場合
    }
}

// クリップボードにコピー
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const text = element.innerText;
        navigator.clipboard.writeText(text)
            .then(() => {
                showNotification("コピーしました！");
            })
            .catch(err => {
                console.error("コピーに失敗しました:", err);
                showNotification("コピーに失敗しました...", "error");
            });
    }
}

// 通知を表示
function showNotification(message, type = "success") {
    // 既存の通知があれば削除（重複防止）
    let existingNotification = document.querySelector(".notification");
    if (existingNotification) {
        existingNotification.remove();
    }

    // 通知を作成
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerText = message;

    document.body.appendChild(notification);

    // 一定時間後に通知を削除
    setTimeout(() => {
        notification.remove();
    }, 3000); // 3秒後に消える
}

// モーダルを開く
openBtn.addEventListener('click', () => {
    modal.classList.add('show');
});

// モーダルを閉じる（× ボタン）
closeBtn.addEventListener('click', () => {
    modal.classList.remove('show');
});

// モーダルを閉じる（外側をクリック）
window.onclick = event => {
    if (event.target === modal) {
        modal.classList.remove('show');
    }
};

// 保存ボタンを押した時にモーダルを閉じる
saveExchangeRatesBtn.addEventListener('click', () => {
    // 為替レートを更新してローカルストレージに保存
    document.querySelectorAll('#exchangeRateTable input').forEach(input => {
        const currency = input.getAttribute('data-currency');
        exchangeRates[currency] = parseFloat(input.value) || 0;
    });
    const settings = JSON.parse(localStorage.getItem('LiveChatExchangeRate')) || {};
    settings.exchangeRates = exchangeRates;
    localStorage.setItem('LiveChatExchangeRate', JSON.stringify(settings));
    // alert('為替レートを保存しました');
    showNotification("為替レートを保存しました");

    // 為替レートの状態を更新
    updateExchangeRateDisplay();

    modal.classList.remove('show');
});

// ページロード時に設定を適用し、イベントリスナーを設定
window.addEventListener('DOMContentLoaded', () => {
    loadSettings(); // 画面設定をロードする関数
    setupAutoSave(); // イベントリスナー設定
    renderExchangeRates(); // 為替レートリストのDOM展開
    updateExchangeRateDisplay(); // 為替レートの状態を更新
});