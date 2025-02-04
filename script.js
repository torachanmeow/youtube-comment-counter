let liveChatPolling = null; // ポーリングの管理
let isPollingActive = false; // ポーリング開始中チェック

const MAX_CHAT_LINES = 500;  // 最大表示チャット行数（画面に見える数）
const MAX_MESSAGE_IDS = 5000; // 取得済みメッセージIDの最大数（カウント管理用）
const USER_HISTORY_LIMIT = 1000; // 最大ユーザー数 (重複コメントカウント管理用)

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

// 通貨コードと国名のマッピング
const currencyCountryMap = Object.freeze({
    "USD": "アメリカ",
    "EUR": "ユーロ圏",
    "JPY": "日本",
    "GBP": "イギリス",
    "CHF": "スイス",
    "CAD": "カナダ",
    "AUD": "オーストラリア",
    "NZD": "ニュージーランド",
    "CNY": "中国",
    "HKD": "香港",
    "SGD": "シンガポール",
    "KRW": "韓国",
    "INR": "インド",
    "BRL": "ブラジル",
    "RUB": "ロシア",
    "MXN": "メキシコ",
    "ZAR": "南アフリカ",
    "TRY": "トルコ",
    "SEK": "スウェーデン",
    "NOK": "ノルウェー",
    "DKK": "デンマーク",
    "PLN": "ポーランド",
    "CZK": "チェコ",
    "HUF": "ハンガリー",
    "MYR": "マレーシア",
    "THB": "タイ",
    "IDR": "インドネシア",
    "VND": "ベトナム",
    "CLP": "チリ",
    "COP": "コロンビア",
    "PEN": "ペルー",
    "ISK": "アイスランド",
    "BGN": "ブルガリア",
    "HRK": "クロアチア",
    "RON": "ルーマニア",
    "KZT": "カザフスタン",
    "SAR": "サウジアラビア",
    "AED": "アラブ首長国連邦",
    "PHP": "フィリピン",
    "TWD": "台湾",
    "ARS": "アルゼンチン"
});

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

// 特定ワード
const wordInputs = [
    document.getElementById('word1'),
    document.getElementById('word2'),
    document.getElementById('word3')
];

// ライブチャットマネージャー
const LiveChatManager = {
    userWordHistory: {}, // ユーザーごとの発言履歴を管理

    data: {}, 

    resetData() {
        this.data = {
            stats: initializeStats(), // 集計データ
            messageIds: new Set(), // 取得済みメッセージIDのリスト（重複チェック）
            superChatIds: new Set(), // 取得済みスーパーチャットのリスト（重複チェック）
            superStickerIds: new Set(), // 取得済みスーパーステッカーのリスト（重複チェック）
            chatLogs: [], // 取得したチャットのリスト
            videoDetails: {} // 動画の詳細情報
        };
        this.userWordHistory = {}; // ユーザー発言履歴もリセット
    },
    
    initializeData() {
        this.resetData();
    }
};

// 集計結果を更新して表示
function updateStatsDisplay(isInitialLoad = false) {
    const stats = LiveChatManager.data.stats;

    if (isInitialLoad) {
        videoDetailsDiv.innerHTML = '';
        liveChatDiv.textContent = '';
        lastFetchTimeDiv.textContent = '00:00:00';
    } else {
       lastFetchTimeDiv.textContent = new Date().toLocaleTimeString(); // 最新取得時間
    }

    // 既存の集計結果表示を更新
    document.getElementById('superChatAmount').textContent = `¥${stats.superChats.toLocaleString()}`;
    document.getElementById('superStickerAmount').textContent = `¥${stats.superStickers.toLocaleString()}`;
    document.getElementById('newMembers').textContent = stats.members;
    document.getElementById('likeCount').textContent = stats.likes;

    // 特定ワードの更新
    wordCountsContainer.innerHTML = ''; 

    Object.entries(stats.wordCounts).forEach(([word, count]) => {
        // 特定ワードを高評価やスーパーチャットと同じ形式で表示
        const wordItem = document.createElement('div');
        wordItem.className = 'stat-item'; // 他と同じスタイルを適用

        const wordLabel = document.createElement('span');
        wordLabel.className = 'stat-label'; // ラベルのスタイル
        wordLabel.textContent = `${word}`; // ワード名

        const wordValue = document.createElement('span');
        wordValue.className = 'stat-value'; // 値のスタイル
        wordValue.textContent = count; // 出現回数

        wordItem.appendChild(wordLabel); // ラベルを追加
        wordItem.appendChild(wordValue); // 値を追加
        wordCountsContainer.appendChild(wordItem); // コンテナに追加
    });
    
    // ポイント換算結果を更新
    updatePointsDisplay();
}

// ポイント換算結果を更新する関数
function updatePointsDisplay() {
    const stats = LiveChatManager.data.stats;

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

    // 特定ワードと重みを ペアで管理 するオブジェクトリストを取得
    const specialWordsWithWeights = getSpecialWordsWithWeights();

    specialWordsWithWeights.forEach(({ word, weight }) => {
        const count = stats.wordCounts[word] || 0;
        const wordPoints = count * weight;
        totalWordPoints += wordPoints;

        // 特定ワードポイントを表示
        const wordItem = document.createElement('div');
        wordItem.className = 'points-item';

        const wordLabel = document.createElement('span');
        wordLabel.className = 'points-label';
        wordLabel.textContent = `${word}`;

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

    // 合計ポイントを「最新のコメント取得時間」の下に表示
    // 端数を処理した状態で加算しないと表示結果と誤差がでる場合あり
    document.getElementById('totalPointsDisplay').textContent = 
        [likePoints, superChatPoints, superStickerPoints, memberPoints, totalWordPoints].map(p => Number(p.toFixed(0))).reduce((sum, p) => sum + p, 0); // 合計を計算
}

// 特定ワードと重みを ペアで管理 するオブジェクトリスト
function getSpecialWordsWithWeights() {
    let specialWords = [];

    wordInputs.forEach((input, index) => {
        const word = input.value.trim();
        const weight = parseFloat(document.getElementById(`weight${index + 1}`).value) || 0;

        if (word) {
            specialWords.push({ word, weight, index }); // index を追加して区別
        }
    });

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

// 特定ワードを取得する関数
function getSpecialWords() {
    const specialWords = wordInputs.map(input => input.value.trim()).filter(word => word !== '');
    return specialWords;
}

// APIリクエストの共通関数
async function fetchData(url) {
    const controller = new AbortController(); // タイムアウト制御用
    const timeout = setTimeout(() => controller.abort(), 10000); // 10秒でタイムアウト

    try {
        // APIリクエストを送信
        const response = await fetch(url, { signal: controller.signal });

        // タイムアウト解除
        clearTimeout(timeout);

        // レスポンスのステータスを確認
        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (jsonError) {
                // console.warn("APIエラー: JSON変換に失敗", jsonError);
            }

            const error = new Error(`APIエラー: ${errorData.error?.message || "不明なエラー"}`);
            error.reason = errorData.error?.errors?.[0]?.reason || "unknown";
            error.status = response.status;
            error.details = { url, status: response.status, response: errorData };
            
            throw error;
        }

        // JSONレスポンスを返す
        return await response.json();
    } catch (error) {
        if (error.name === "AbortError") {
            error.reason = "timeout";
            error.status = 408; // リクエストタイムアウト
            error.details = { url };
        } else if (!error.reason) {
            error.reason = "unknown";
            error.status = error.status || 500; // デフォルト500
            error.details = { url };
        }

        throw error;
    } finally {
        // タイムアウトクリア（念のため）
        clearTimeout(timeout);
    }
}

// ライブチャットIDを取得
async function getLiveChatId(apiKey, videoId) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;

    const data = await fetchData(url);

    if (!data || !data.items || data.items.length === 0) {
        const error = new Error("動画情報が取得できません。動画IDが無効です。");
        error.reason = "invalidVideoId"; // エラー種別を追加
        error.details = { videoId }; // デバッグ用の詳細情報
        throw error;
    }

    const liveChatId = data.items[0].liveStreamingDetails?.activeLiveChatId;
    if (!liveChatId) {
        const error = new Error("ライブチャットが無効または存在しない可能性があります。");
        error.reason = "noLiveChat"; // エラー種別を追加
        error.details = { videoId }; // デバッグ用の詳細情報
        throw error;
    }

    return liveChatId;
}

// 動画情報を取得
async function getVideoDetails(apiKey, videoId, fetchSnippet = false) {
    const part = fetchSnippet ? "snippet,statistics" : "statistics"; // 必要に応じて取得
    const url = `https://www.googleapis.com/youtube/v3/videos?part=${part}&id=${videoId}&key=${apiKey}`;

    const data = await fetchData(url);

    if (!data || !data.items || data.items.length === 0) {
        const error = new Error("動画情報が取得できません。動画IDが無効です。");
        error.reason = "invalidVideoId";
        error.details = { videoId, url };
        throw error;
    }

    return {
        title: fetchSnippet ? data.items[0].snippet.title : null,
        channelTitle: fetchSnippet ? data.items[0].snippet.channelTitle : null,
        publishedAt: fetchSnippet ? data.items[0].snippet.publishedAt : null,
        likeCount: parseInt(data.items[0].statistics.likeCount || "0", 10),
    };
}

// 動画情報を定期的に取得
async function fetchVideoDetails(apiKey, videoId, isInitialLoad = false) {
    try {
        const videoDetails = await getVideoDetails(apiKey, videoId, isInitialLoad);
        
        if (videoDetails) {
            if (isInitialLoad) {
                // 初回ロード時にタイトルやチャンネル名などを更新
                LiveChatManager.data.videoDetails = videoDetails;
                LiveChatManager.data.stats.likes = videoDetails.likeCount || 0;
                displayVideoDetails(videoDetails); // 初回のみ詳細表示
            }

            // 高評価数を常に更新
            LiveChatManager.data.stats.likes = videoDetails.likeCount || 0;
        }
    } catch (error) {
        throw error;
    }
}

// 動画情報を整形して表示
function displayVideoDetails(details) {
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

    // 表示エリアに追加
    videoDetailsDiv.appendChild(videoDetailsContainer);
}

// チャットメッセージを取得して表示
async function fetchLiveChat(apiKey, liveChatId, isInitialLoad = false) {
    if (!liveChatId) {
        return;
    }

    const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&maxResults=500&key=${apiKey}`;
    
    const data = await fetchData(url);
    if (!data || !data.items) {
        return;
    }

    // データを時系列順にソート
    data.items.sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));

    // **チャットメッセージを処理**
    data.items.forEach(item => processChatMessage(item, isInitialLoad));

    // **統計を更新**
    updateStatsDisplay();

    // **表示制限とメモリ管理**
    manageChatMemory();
}

// **チャットメッセージを処理**
function processChatMessage(item, isInitialLoad) {
    if (!item.snippet.hasDisplayContent) return;

    const messageId = item.id;

    // メッセージIDの重複チェック
    if (!isInitialLoad && LiveChatManager.data.messageIds.has(messageId)) return;  
    LiveChatManager.data.messageIds.add(messageId);

    if (LiveChatManager.data.messageIds.size > MAX_MESSAGE_IDS) {
        LiveChatManager.data.messageIds.delete(LiveChatManager.data.messageIds.values().next().value);
    }

    const authorId = item.authorDetails.channelId;
    const authorName = item.authorDetails.displayName;
    const publishedAt = item.snippet.publishedAt; 

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

    const specialWordsWithWeights = getSpecialWordsWithWeights();
    let message = item.snippet.displayMessage || "";

     // **単語カウントを処理**
     countWords(authorId, message, specialWordsWithWeights);

     // **ハイライト適用**
     message = highlightWords(message, specialWordsWithWeights);
     
     // **メッセージ設定**
     messageSpan.innerHTML = message; 

    // **スーパーチャットの処理**
    processSuperChat(item, messageSpan, authorName, publishedAt);

    // **スーパーステッカーの処理**
    processSuperSticker(item, messageSpan, authorName, publishedAt);

    // **メンバーシップの処理**
    processMembershipEvent(item, messageSpan);

    // **名前とメッセージを追加**
    chatMessageDiv.appendChild(authorSpan);
    chatMessageDiv.appendChild(messageSpan);

    // **チャット表示エリアに追加**
    liveChatDiv.appendChild(chatMessageDiv);

    // **コメントデータを保存**
    LiveChatManager.data.chatLogs.push({ id: messageId, message: `[${authorName}] ${message}` });
}

// **単語カウントを処理**
function countWords(authorId, message, specialWordsWithWeights) {
    if (message == null) return message;

    if (typeof message !== 'string') {
        message = String(message);
    }

    message = sanitizeHTML(message); // **XSS対策のためサニタイズ**

    if (!LiveChatManager.userWordHistory[authorId]) {
        LiveChatManager.userWordHistory[authorId] = { words: new Set(), lastActive: Date.now() };
    }

    LiveChatManager.userWordHistory[authorId].lastActive = Date.now();

    let matchedWords = [];

    specialWordsWithWeights.forEach(({ word }) => {
        const regex = new RegExp(`(${word})`, 'gi');
        const matches = message.match(regex);
        if (matches) {
            matchedWords.push(...matches.map(() => ({ word })));
        }
    });

    const uniqueWords = new Set(matchedWords.map(({ word }) => word));

    uniqueWords.forEach(word => {
        if (LiveChatManager.data.stats.wordCounts[word] === undefined) {
            LiveChatManager.data.stats.wordCounts[word] = 0;
        }
        if (!LiveChatManager.userWordHistory[authorId].words.has(word)) {
            LiveChatManager.data.stats.wordCounts[word]++;
            LiveChatManager.userWordHistory[authorId].words.add(word);
        }
    });

    return message;
}

// **HTMLをサニタイズ**
function sanitizeHTML(str) {
    const tempDiv = document.createElement("div");
    tempDiv.textContent = str;
    return tempDiv.innerHTML;
}

// **ハイライト適用**
function highlightWords(message, specialWordsWithWeights) {
    if (message == null) return message;

    specialWordsWithWeights.forEach(({ word }) => {
        const regex = new RegExp(`(${word})`, 'gi');
        message = message.replace(regex, `<span class="chat-highlight">$1</span>`);
    });

    return message;
}

// **スーパーチャットを処理**
function processSuperChat(item, messageSpan, authorName, publishedAt) {
    if (!item.snippet.superChatDetails) return;

    const amount = parseFloat(item.snippet.superChatDetails.amountDisplayString.replace(/[^\d.-]/g, '')) || 0;
    const currency = item.snippet.superChatDetails.currency;
    const jpyAmount = convertToJPY(amount, currency);
    const superChatKey = `${authorName}_${amount}_${currency}_${publishedAt}`;

    if (LiveChatManager.data.superChatIds.has(superChatKey)) return;
    LiveChatManager.data.superChatIds.add(superChatKey);

    if (LiveChatManager.data.superChatIds.size > MAX_MESSAGE_IDS) {
        LiveChatManager.data.superChatIds.delete([...LiveChatManager.data.superChatIds][0]);
    }

    if (jpyAmount !== null) {
        messageSpan.classList.add('chat-superchat');
        messageSpan.textContent += ` => 日本円: ¥${jpyAmount.toLocaleString()}`;
        LiveChatManager.data.stats.superChats += jpyAmount;
    } 
}

// **スーパーステッカーを処理**
function processSuperSticker(item, messageSpan, authorName, publishedAt) {
    if (!item.snippet.superStickerDetails) return;

    const amount = parseFloat(item.snippet.superStickerDetails.amountDisplayString.replace(/[^\d.-]/g, '')) || 0;
    const currency = item.snippet.superStickerDetails.currency;
    const jpyAmount = convertToJPY(amount, currency);
    const superStickerKey = `${authorName}_${amount}_${currency}_${publishedAt}`;

    if (LiveChatManager.data.superStickerIds.has(superStickerKey)) return;
    LiveChatManager.data.superStickerIds.add(superStickerKey);

    if (LiveChatManager.data.superStickerIds.size > MAX_MESSAGE_IDS) {
        LiveChatManager.data.superStickerIds.delete([...LiveChatManager.data.superStickerIds][0]);
    }

    if (jpyAmount !== null) {
        messageSpan.classList.add('chat-supersticker');
        messageSpan.textContent += ` => 日本円: ¥${jpyAmount.toLocaleString()}`;
        LiveChatManager.data.stats.superStickers += jpyAmount;
    }
}

// **メンバーシップ関連のイベントを処理**
function processMembershipEvent(item, messageSpan) {
    if (item.snippet.type === "membershipGiftingEvent") {
        // メンバーシップギフト情報の取得
        const giftCount = item.snippet.membershipGiftingDetails?.giftMembershipsCount || 1; // デフォルト1名
        const membershipLevel = item.snippet.membershipGiftingDetails?.giftMembershipsLevelName || "Unknown";
        messageSpan.classList.add('chat-member');
        messageSpan.textContent = ` => ${giftCount}名に「${membershipLevel}」メンバーシップがギフトされました！`;
        LiveChatManager.data.stats.members += giftCount;
    }

    // **ギフトメンバーの受取**
    if (item.snippet.type === "giftMembershipReceivedEvent") {
        messageSpan.classList.add('chat-giftmember');
        messageSpan.textContent += ` => ギフトメンバーシップを受け取りました！`;
    }

    // **新規メンバー加入**
    if (item.snippet.type === "newSponsorEvent" && (item.snippet.newSponsorDetails?.isUpgrade === false || item.snippet.newSponsorDetails?.isUpgrade === undefined)) {
        messageSpan.classList.add('chat-member');
        messageSpan.textContent += ` => 新規メンバーシップ加入！（${item.snippet.newSponsorDetails.memberLevelName}）`;
        LiveChatManager.data.stats.members++;
    }

    // **メンバーシップのアップグレード**
    if (item.snippet.type === "newSponsorEvent" && item.snippet.newSponsorDetails?.isUpgrade === true) {
        messageSpan.classList.add('chat-member');
        messageSpan.textContent += ` => メンバーシップアップグレード！（${item.snippet.newSponsorDetails.memberLevelName}）`;
        LiveChatManager.data.stats.members++;
    }
}

// チャット表示とメモリ管理を統合する関数
function manageChatMemory() {
    // **チャットの行数を制限**
    while (liveChatDiv.children.length > MAX_CHAT_LINES) {
        liveChatDiv.removeChild(liveChatDiv.children[0]); // 最も古いメッセージを削除
    }

    // **取得済みメッセージIDのメモリ管理**
    if (LiveChatManager.data.messageIds.size > MAX_MESSAGE_IDS) {
        const oldestIds = Array.from(LiveChatManager.data.messageIds).slice(0, LiveChatManager.data.messageIds.size - MAX_MESSAGE_IDS);
        oldestIds.forEach(id => LiveChatManager.data.messageIds.delete(id)); // 古いIDを削除
    }

    // **チャット履歴のメモリ管理**
    if (LiveChatManager.data.chatLogs.length > MAX_MESSAGE_IDS) {
        LiveChatManager.data.chatLogs.splice(0, LiveChatManager.data.chatLogs.length - MAX_MESSAGE_IDS);
    }

    // **ユーザー発言履歴のメモリ管理**
    if (Object.keys(LiveChatManager.userWordHistory).length > USER_HISTORY_LIMIT) {
        // ユーザーIDごとに最終発言時刻を取得してソート
        const sortedUsers = Object.entries(LiveChatManager.userWordHistory)
            .sort((a, b) => a[1].lastActive - b[1].lastActive) // 昇順（古い順）
            .slice(0, Object.keys(LiveChatManager.userWordHistory).length - USER_HISTORY_LIMIT); // 超過分だけ取得

        // 古いユーザーを削除
        sortedUsers.forEach(([userId]) => delete LiveChatManager.userWordHistory[userId]);
    }
}

// スーパーチャットの金額を日本円に変換する関数
function convertToJPY(amount, currency) {
    if (!exchangeRates || typeof exchangeRates !== 'object') {
        return null;
    }

    const rate = exchangeRates[currency.toUpperCase()];
    if (!rate) {
        // console.warn(`未登録の通貨: ${currency}`);
        return null;
    }

    return Math.round(amount * rate); // 円換算
}

// ライブチャットと動画情報のポーリングを開始
async function startPolling(apiKey, videoId) {
    // 既存のポーリングを停止（重複実行を防ぐ）
    clearInterval(liveChatPolling);

    const pollingInterval = parseInt(pollingIntervalInput.value, 10) || 30;

    try {
        // 初期化処理を実行
        initializePolling();
        
        // ライブチャットIDを取得
        const liveChatId = await getLiveChatId(apiKey, videoId);
        if (!liveChatId) {
            showNotification("ライブチャットIDが取得できませんでした", "error");
            return;
        }

        // 初回データ取得
        await fetchVideoDetails(apiKey, videoId, true);
        await fetchLiveChat(apiKey, liveChatId, true);

        // ステータスを設定 (取得開始)
        setStatus(true);

        showNotification("開始しました！");

        // ポーリング開始
        liveChatPolling = setInterval(async () => {
            try {
                await fetchVideoDetails(apiKey, videoId, false);
                await fetchLiveChat(apiKey, liveChatId, false);
            } catch (error) {
                // ポーリング中にエラーが発生した場合の処理
                if (error.reason === "liveChatEnded" || error.reason === "invalidVideoId") {
                    showNotification("ライブ配信は終了しました。", "error");
                    stopPolling(); // ポーリングを停止
                    setStatus(false); // 停止したことを画面にも残す  
                }
            }
        }, pollingInterval * 1000);

    } catch (error) {
        handleAPIError(error);
        stopPolling(); // ポーリングを停止
    }
}

// ステータスを設定
function setStatus(isRunning) {
    if (!statusDiv) return;

    statusDiv.classList.add("status"); // 常に適用

    if (isRunning) {
        statusDiv.classList.remove("stopped");
        statusDiv.classList.add("executing"); 
        statusDiv.textContent = "ライブチャット取得中...";
    } else {
        statusDiv.classList.remove("executing");
        statusDiv.classList.add("stopped");
        statusDiv.textContent = "ライブ配信は終了しました";
    }
}

// ステータスをクリア
function clearStatus() {
    if (!statusDiv) return;

    statusDiv.classList.remove("executing", "stopped");
    statusDiv.textContent = ""; 
}

// 初期化処理を行う関数
function initializePolling() {
    LiveChatManager.initializeData(); // ライブ情報の初期化
    updateStatsDisplay(true); // 集計結果の初期化
    clearStatus(); // ステータスをクリア
    toggleControls(true);
}

// 停止処理を行う関数
function stopPolling() {
    clearInterval(liveChatPolling); // ポーリングを停止
    liveChatPolling = null;
    clearStatus(); // ステータスをクリア
    toggleControls(false);
}

// ボタンと入力欄の有効/無効を切り替える関数
function toggleControls(isPolling) {
    startBtn.disabled = isPolling;
    stopBtn.disabled = !isPolling;
    disableInputs(isPolling);
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
    }
}

// 入力変更時に自動で保存するイベントリスナーを設定
function setupAutoSave() {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', saveSettings);
    });
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
    } catch (error) {
        // console.error('為替レートのロードに失敗しました:', error);
        exchangeRates = {}; // 空のオブジェクトにリセット
    }
}

// 開始ボタンクリックイベント
startBtn.addEventListener('click', async () => {
    if (isPollingActive) {
        return; // 処理が進行中なら何もしない
    }
    isPollingActive = true; // ポーリング開始中のフラグを立てる
    
    try {
        // 為替レート未設定は処理を中止
        await loadExchangeRates();
        if (Object.keys(exchangeRates).length === 0) {
            showNotification("エラー: 為替レートが見つかりません。処理を中止します。", "error");
            return;
        }
        
        // APIキーと動画ID未設定は処理を中止
        const apiKey = apiKeyInput.value.trim();
        const videoId = videoIdInput.value.trim();
        if (!apiKey || !videoId) {
            showNotification("APIキーと動画IDを入力してください。", "error");
            return;
        }

        // ポーリングを開始
        await startPolling(apiKey, videoId);

    } catch (error){
        // 何もしない
    } finally {
        isPollingActive = false; // フラグをリセット
    }
});

// 停止ボタンクリックイベント
stopBtn.addEventListener('click', () => {
    try {
        stopPolling(); // ポーリングを停止
        showNotification("停止しました！");
    } catch (error) {
        showNotification("停止処理中にエラーが発生しました。", "error");
    }
});

// APIキーのマスキング切り替えイベント
toggleApiKeyBtn.addEventListener("click", () => {
    const apiKeyInput = document.getElementById("apiKey");
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
    toggleApiKeyBtn.textContent = apiKeyInput.type === "password" ? "表示" : "隠す";
});

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
    showNotification("為替レートを保存しました");

    // 為替レートの状態を更新
    updateExchangeRateDisplay();

    modal.classList.remove('show');
});

// 通貨ソート用の関数
function setupCurrencySorting() {
    const currencyHeader = document.getElementById("sortableCurrencyHeader");
    const currencySortArrow = document.getElementById("currencySortArrow");
    let ascending = true; // 初期状態は昇順

    // ヘッダークリック時にソート方向を切り替え
    currencyHeader.addEventListener("click", function () {
        ascending = !ascending; // 昇順・降順を切り替え
        currencySortArrow.textContent = ascending ? "▲" : "▼"; // 矢印を変更
        renderExchangeRates(ascending); // ソートを適用して再描画
    });

    // 初回表示は昇順
    renderExchangeRates(ascending);
}

// 通貨リストをテーブルに表示する関数
function renderExchangeRates(ascending = true) {
    const table = document.getElementById("exchangeRateTable");
    const tableBody = table.querySelector("tbody");

    tableBody.innerHTML = '';

    // 通貨コード順にソート
    const sortedRates = Object.entries(exchangeRates).sort((a, b) =>
        ascending ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])
    );

    sortedRates.forEach(([currency, rate]) => {
        const country = currencyCountryMap[currency] || "不明"; // 国名を取得（未定義なら"不明"）

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${currency}</td>
            <td>${country}</td>
            <td><input type="number" step="0.01" value="${rate}" data-currency="${currency}"></td>
        `;
        tableBody.appendChild(row);
    });
}

// APIエラーの共通ハンドリング
function handleAPIError(error) {
    let reason = error?.reason || "unknown";
    let message = error.message || "不明なエラーが発生しました。";

    // ネストされたresponseエラーがある場合を処理
    if (error?.response?.error) {
        reason = error.response.error.errors?.[0]?.reason || reason;
        message = error.response.error.message || message;
    }

    // ユーザーへの通知を表示
    showNotification(`${message} (${reason})`, "error");
}

// ページロード時に設定を適用し、イベントリスナーを設定
window.addEventListener('DOMContentLoaded', () => {
    loadSettings(); // 画面設定をロードする関数
    setupAutoSave(); // イベントリスナー設定
    setupCurrencySorting(); // 通貨のソート機能を適用
    updateExchangeRateDisplay(); // 為替レートの状態を更新
});