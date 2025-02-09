(() => {
    "use strict";

    // URLのパラメータ debug=true デバッグモード
    const urlParams = new URLSearchParams(window.location.search);
    window.DEBUG = urlParams.get('debug') === 'true' || false;    

    let liveChatPolling = null;        // ポーリングの管理
    let isAscending = true;            // 通貨ソート状態 初期値は昇順
    let isAutoScrollEnabled = true;    // 初期値ON

    const CONFIG = {
        MAX_CHAT_LINES: 500,            // 最大表示チャット行
        MAX_MESSAGE_IDS: 5000,          // 内部ログデータ上限
        USER_HISTORY_LIMIT: 2000,       // ユーザー履歴
        POLLING_TIMEOUT_MS: 10000,      // APIのタイムアウトミリ秒
        POLLING_INTERVAL_DEFAULT: 30    // ポーリングインターバルの初期値
    };

    // 初期値を定義
    const DEFAULT_VALUES = {
        totalPointsFontSize: 30,
        totalPointsTextColor: '#495057',
        totalPointsBgColor: '#F8F9FA',
        totalPointsBgTransparent: false,
        totalPointsOnly: false,  
    };

    // CSSクラス
    const CLASS_NAMES = {
        chatMessage: 'chat-message',
        chatAuthor: 'chat-author',
        chatText: 'chat-text',
        chatSuperChat: 'chat-superchat',
        chatSuperSticker: 'chat-supersticker',
        chatMembership: 'chat-membership',
        chatMembershipgift: 'chat-membershipgift',
        chatSpecialWord: 'chat-specialword',
        statItem: 'stat-item',
        statLabel: 'stat-label',
        statValue: 'stat-value',
        pointsItem: 'points-item',
        pointsLabel: 'points-label',
        pointsValue: 'points-value',
        notification: 'notification',
        detailItem: 'detail-item',
        status: 'status',
        executing: 'executing',
        stopped: 'stopped',
        show: 'show',
    };

    // CSS 変数の定数オブジェクト
    const CSS_VARIABLES = {
        totalPointsFontSize: '--totalPointsFontSize',
        totalPointsTextColor: '--totalPointsTextColor',
        totalPointsBgColor: '--totalPointsBgColor'
    };

    // HTML要素
    const elements = {
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        apiKeyInput: document.getElementById('apiKey'),
        videoIdInput: document.getElementById('videoId'),
        videoDetailsDiv: document.getElementById('videoDetails'),
        liveChatDiv: document.getElementById('liveChat'),
        statusDiv: document.getElementById('status'),
        lastFetchTimeDiv: document.getElementById('lastFetchTime'),
        copyChatBtn: document.getElementById('copyChatBtn'),
        autoScrollToggle: document.getElementById('autoScrollToggle'),
        copyDetailsBtn: document.getElementById('copyDetailsBtn'),
        pollingIntervalInput: document.getElementById('pollingInterval'),
        statsDisplay: document.getElementById('statsDisplay'),
        keyWordContainer: document.getElementById('keyWordContainer'),
        toggleApiKeyBtn: document.getElementById('toggleApiKeyBtn'),
        modal: document.getElementById('exchangeRateModal'),
        openBtn: document.getElementById('openExchangeRateModal'),
        closeBtn: document.getElementById('closeModal'),
        resetExchangeRatesBtn: document.getElementById('resetExchangeRates'),
        saveExchangeRatesBtn: document.getElementById('saveExchangeRates'),    
        currencySortArrow: document.getElementById("currencySortArrow"),

        // 為替レート関連
        exchangeRateInput: document.getElementById('exchangeRateInput'),
        exchangeRateTable: document.getElementById('exchangeRateTable'),
        sortableCurrencyHeader: document.getElementById('sortableCurrencyHeader'),

        // 合計ポイントデザイン設定
        textColorCode: document.getElementById('textColorCode'),
        bgColorCode: document.getElementById('bgColorCode'),
        totalPointsFontSize: document.getElementById('totalPointsFontSize'),
        totalPointsTextColor: document.getElementById('totalPointsTextColor'),
        totalPointsBgColor: document.getElementById('totalPointsBgColor'),
        totalPointsBgTransparent: document.getElementById('totalPointsBgTransparent'),
        totalPointsResetBtn: document.getElementById('totalPointsResetBtn'),
        totalPointsOnly: document.getElementById('totalPointsOnly'),
        totalPointsContainer: document.querySelector('.totalPoints-container'),
        totalPointsLabel: document.querySelector('.totalPoints-label'), 
        totalPointsDisplay: document.getElementById('totalPointsDisplay'),

        // 集計表示関連
        superChatAmount: document.getElementById('superChatAmount'),
        superStickerAmount: document.getElementById('superStickerAmount'),
        newMembers: document.getElementById('newMembers'),
        likeCount: document.getElementById('likeCount'),

        // ポイント表示関連
        wordPointsContainer: document.getElementById('wordPointsContainer'),
        superChatPoints: document.getElementById('superChatPoints'),
        superStickerPoints: document.getElementById('superStickerPoints'),
        memberPoints: document.getElementById('memberPoints'),
        likePoints: document.getElementById('likePoints'),

        // 重み付け設定
        superChatWeight: document.getElementById('superChatWeight'),
        superStickerWeight: document.getElementById('superStickerWeight'),
        memberWeight: document.getElementById('memberWeight'),
        likeWeight: document.getElementById('likeWeight'),

        // 特定ワード（配列として管理）
        wordInputs: [
            document.getElementById('word1'),
            document.getElementById('word2'),
            document.getElementById('word3')
        ],
        weightInputs: [
            document.getElementById('weight1'),
            document.getElementById('weight2'),
            document.getElementById('weight3')
        ]
    };

    // ライブチャットマネージャー
    const LiveChatManager = {
        userWordHistory: {}, // ユーザーごとの発言履歴を管理
        currencyInfo: {},    // 通貨情報
        exchangeRates: {},   // 為替レート
        isProcessing: false, // 連打防止用
        pollingInterval: CONFIG.POLLING_INTERVAL_DEFAULT, // ポーリングのインターバル
        
        data: {},           // モニタリングデータ

        async initialize() {
            this.data = {
                stats: initializeStats(),           // 集計値
                weights : initializeWeights(),      // 係数(重み付け)
                messageIds: new Set(),              // 取得済みメッセージID
                superChatIds: new Set(),            // 取得済みスーパーチャット）
                superStickerIds: new Set(),         // 取得済みスーパーステッカー）
                membershipIds: new Set(),           // 取得済みメンバーリスト                    
                membershipGiftIds: new Set(),       // 取得済みメンバーギフト        
                chatLogs: [],                       // チャットログ
                videoDetails: {}                    // 動画情報
            };
            this.userWordHistory = {};  // キーワード投稿履歴 
            this.currencyInfo = await fetchCurrencyInfo(); // 通貨情報
            this.exchangeRates = await getValidExchangeRates(); // 為替レート
        }
    };

    // デバッグ時は、ライブチャットマネージャーをグローバルとして定義
    if (window.DEBUG) {
        window.LiveChatManager = LiveChatManager;
    }

    // 初期化処理
    async function initializeApp() {
        // データの初期化
        await LiveChatManager.initialize();
        loadSettings();
        updateTotalPointsStyle();
        updateExchangeRateDisplay();

        // イベントリスナー登録
        setupSettingsListeners();
        elements.startBtn.addEventListener("click", handleStartButtonClick);
        elements.stopBtn.addEventListener("click", handleStopButtonClick);
        elements.toggleApiKeyBtn.addEventListener("click", toggleApiKeyVisibility);
        elements.totalPointsResetBtn.addEventListener('click', resetAllTotalPointsToDefault);
        elements.copyChatBtn.addEventListener("click", copyLiveChat);
        elements.copyDetailsBtn.addEventListener("click", copyVideoDetails);
        elements.openBtn.addEventListener("click", openExchangeRateModal);
        elements.closeBtn.addEventListener("click", closeExchangeRateModal);
        elements.resetExchangeRatesBtn.addEventListener("click", resetExchangeRates);
        elements.saveExchangeRatesBtn.addEventListener("click", saveExchangeRates);
        elements.sortableCurrencyHeader.addEventListener("click", toggleCurrencySort);
        elements.totalPointsFontSize.addEventListener("input", updateTotalPointsStyle);
        elements.totalPointsTextColor.addEventListener("input", updateTotalPointsStyle);
        elements.totalPointsBgColor.addEventListener("input", updateTotalPointsStyle);
        elements.totalPointsBgTransparent.addEventListener("change", updateTotalPointsStyle);
        elements.totalPointsOnly.addEventListener("change", updateTotalPointsStyle);   
        elements.autoScrollToggle.addEventListener("change", liveChatAutoScroll); 

        // モーダルの外側クリック時
        window.addEventListener("click", closeExchangeRateModalOnOutsideClick);

        // 為替レートリストを描画
        renderExchangeRates(isAscending);

        // カラーピッカーの初期化
        updateColorCode(elements.totalPointsTextColor, elements.textColorCode);
        updateColorCode(elements.totalPointsBgColor, elements.bgColorCode);
    }

    // 画面値保存のイベントリスナーまとめ
    function setupSettingsListeners() {
        document.querySelectorAll('[data-save]').forEach(input => {
            input.addEventListener("change", saveSettings);
        });
    }

    // 通貨情報を外部設定ファイルから取得
    async function fetchCurrencyInfo() {
        try {
            const response = await fetch('currencyInfo.json'); // JSONファイルのURL
            if (response.ok) {
                const currencyInfo = await response.json();
                return currencyInfo; // JSONデータを返す
            } else {
                console.warn('外部JSONの取得に失敗しました。HTTPステータス:', response.status);
            }
        } catch (error) {
            console.error('外部JSONの取得中にエラーが発生しました:', error);
            throw new Error('通貨情報を取得できませんでした');
        }
    }

    // 為替レートをAPI & 設定ファイルから取得
    async function fetchExchangeRates() {
        const apiRates = await fetchApiExchangeRates();
        const fileRates = await fetchFileExchangeRates();
        
        // API データが有効なら API を優先し、API にない通貨は設定ファイルで補完
        const exchangeRates = apiRates ? { ...fileRates, ...apiRates } : fileRates;

        // ローカルストレージへ保存（取得時のタイムスタンプも保存）
        localStorage.setItem('LiveChatExchangeRate', JSON.stringify({
            exchangeRates,
            timestamp: Date.now()
        }));

        return exchangeRates;
    }

    // 1週間以内のデータがあればローカルストレージのデータを使う
    async function getValidExchangeRates() {
        const storedData = localStorage.getItem('LiveChatExchangeRate');

        if (storedData) {
            try {
                const parsedData = JSON.parse(storedData);
                const savedTimestamp = parsedData.timestamp || 0;
                const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000); // 1週間前のタイムスタンプ

                if (savedTimestamp >= oneWeekAgo) {
                    // 1週間以内のデータならローカルストレージのデータを使用
                    return parsedData.exchangeRates;
                }
            } catch (error) {
                console.warn("ローカルストレージのデータが破損していたため、再取得します。");
            }
        }

        // 1週間以上前、またはデータがない場合は最新のデータを取得
        return await fetchExchangeRates();
    }
    
    // API から為替レートを取得
    async function fetchApiExchangeRates() {
        try {
            // open-source currency data API (https://frankfurter.dev/)
            const response = await fetch('https://api.frankfurter.app/latest?base=JPY');
            if (!response.ok) return null;

            const apiData = await response.json();
            return apiData.rates;
        } catch (error) {
            return null;
        }
    }

    // 設定ファイルから為替レートを取得
    async function fetchFileExchangeRates() {
        try {
            const response = await fetch('exchangeRates.json');
            return response.ok ? await response.json() : {};
        } catch (error) {
            return {};
        }
    }

    // API で取得できなかった通貨を設定ファイルで補完
    function mergeExchangeRates(apiRates, fileRates) {
        return { ...fileRates, ...apiRates }; // API 優先で統合
    }

    // 集計結果を更新して表示
    function updateStatsDisplay(isInitialLoad = false) {
        const stats = LiveChatManager.data.stats;

        if (isInitialLoad) {
            elements.videoDetailsDiv.innerHTML = '';
            elements.liveChatDiv.textContent = '';
            elements.lastFetchTimeDiv.textContent = '00:00:00';
        } else {
            elements.lastFetchTimeDiv.textContent = new Date().toLocaleTimeString();
        }

        // 特定ワードの更新
        elements.keyWordContainer.innerHTML = ''; 

        for (const [word, count] of Object.entries(stats.keyWord)) {
            const wordItem = document.createElement('div');
            wordItem.className = CLASS_NAMES.statItem;

            const wordLabel = document.createElement('span');
            wordLabel.className = CLASS_NAMES.statLabel;
            wordLabel.textContent = word;

            const wordValue = document.createElement('span');
            wordValue.className = CLASS_NAMES.statValue;
            wordValue.textContent = count;

            wordItem.appendChild(wordLabel);
            wordItem.appendChild(wordValue);
            elements.keyWordContainer.appendChild(wordItem);
        };

        elements.superChatAmount.textContent = `¥${stats.superChats.toLocaleString()}`;
        elements.superStickerAmount.textContent = `¥${stats.superStickers.toLocaleString()}`;
        elements.newMembers.textContent = stats.members;
        elements.likeCount.textContent = stats.likes;

        // ポイント換算結果を更新
        updatePointsDisplay();
    }

    // ポイント換算結果を更新する
    function updatePointsDisplay() {
        const stats = LiveChatManager.data.stats;
        const weights = LiveChatManager.data.weights;

        const likePoints = stats.likes * weights.likes;
        const superChatPoints = stats.superChats * weights.superChats;
        const superStickerPoints = stats.superStickers * weights.superStickers;
        const memberPoints = stats.members * weights.members;

        // 特定ワードのポイントを計算
        const wordPointsContainer = elements.wordPointsContainer;
        wordPointsContainer.innerHTML = '';
        let totalWordPoints = 0;

        for (const [word, count] of Object.entries(stats.keyWord)) {
            const weight = weights.keyWord[word] || 0;
            const wordPoints = count * weight;
            totalWordPoints += wordPoints;

            const wordItem = document.createElement('div');
            wordItem.className = CLASS_NAMES.pointsItem;

            const wordLabel = document.createElement('span');
            wordLabel.className = CLASS_NAMES.pointsLabel;
            wordLabel.textContent = word;

            const wordValue = document.createElement('span');
            wordValue.className = CLASS_NAMES.pointsValue;
            wordValue.textContent = Math.round(wordPoints);

            wordItem.appendChild(wordLabel);
            wordItem.appendChild(wordValue);
            wordPointsContainer.appendChild(wordItem);
        }

        // 合計ポイントの計算
        const totalPoints =
            Math.round(likePoints) +
            Math.round(superChatPoints) +
            Math.round(superStickerPoints) +
            Math.round(memberPoints) +
            Math.round(totalWordPoints);
        
        // 各ポイントを整数で表示
        elements.likePoints.textContent = Math.round(likePoints);
        elements.superChatPoints.textContent = Math.round(superChatPoints);
        elements.superStickerPoints.textContent = Math.round(superStickerPoints);
        elements.memberPoints.textContent = Math.round(memberPoints);
        elements.totalPointsDisplay.textContent = totalPoints;
    }

    // 特定ワードと重みを ペアで管理 するオブジェクトリスト
    function getSpecialWordsWithWeights() {
        return elements.wordInputs
            .map((input, index) => ({
                word: input.value.trim(),
                weight: parseFloat(elements.weightInputs[index].value) || 0,
                index
            }))
            .filter(({ word }) => word); // 空のワードを除外
    }

    // 集計対象の初期化
    function initializeStats() {
        const specialWords = getSpecialWordsWithWeights().map(obj => obj.word);
        const keyWord = specialWords.reduce((obj, word) => {
            obj[word] = 0;
            return obj;
        }, {});
        return {
            superChats: 0,
            superStickers: 0,
            members: 0,
            likes: 0,
            keyWord
        };
    }

    // 係数(重み付け)の初期化
    function initializeWeights() {
        const specialWordsWithWeights = getSpecialWordsWithWeights();
        const keyWord = specialWordsWithWeights.reduce((obj, { word, weight }) => {
            obj[word] = weight;
            return obj;
        }, {});
        return {
            superChats: parseFloat(elements.superChatWeight.value) || 0,
            superStickers: parseFloat(elements.superStickerWeight.value) || 0,
            members: parseFloat(elements.memberWeight.value) || 0,
            likes: parseFloat(elements.likeWeight.value) || 0,
            keyWord
        };
    }

    // APIリクエストの共通関数
    async function fetchData(url, timeoutMs = CONFIG.POLLING_TIMEOUT_MS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, { signal: controller.signal });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // JSON変換失敗時の対策
                throw createFetchError(response.status, errorData, url);
            }

            return await response.json();
        } catch (error) {
            if (error.name === "AbortError") {
                throw createFetchError(408, { message: "リクエストタイムアウト" }, url, "timeout");
            }
            throw createFetchError(error.status || 500, { message: error.message }, url, error.reason || "unknown");
        } finally {
            clearTimeout(timeout);
        }
    }

    // エラーオブジェクトを統一する関数
    function createFetchError(status, errorData, url, defaultReason = "unknown") {
        return {
            message: `APIエラー: ${errorData.message || "不明なエラー"}`,
            reason: errorData.error?.errors?.[0]?.reason || defaultReason,
            status: status,
            url: url
        };
    }

    // ライブチャットIDを取得
    async function getLiveChatId(apiKey, videoId) {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;

        const data = await fetchData(url);

        if (!data || !data.items || data.items.length === 0) {
            const error = new Error("動画情報が取得できません。動画IDが無効です。");
            error.reason = "invalidVideoId";
            throw error;
        }

        const liveChatId = data.items[0].liveStreamingDetails?.activeLiveChatId;
        if (!liveChatId) {
            const error = new Error("ライブチャットが無効または存在しない可能性があります。");
            error.reason = "noLiveChat";
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
                    displayVideoDetails(videoDetails);
                }

                // 高評価数を常に更新
                LiveChatManager.data.stats.likes = videoDetails.likeCount || 0;
            }
        } catch (error) {
            throw error;
        }
    }

    // チャットメッセージを取得する（データのみ取得）
    async function getLiveChatMessages(apiKey, liveChatId) {
        if (!liveChatId) {
            throw new Error("ライブチャットIDが無効です。");
        }

        const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&maxResults=500&key=${apiKey}`;  
        const data = await fetchData(url);

        if (!data || !data.items) {
            return [];
        }

        // 時系列順にソート
        return data.items.sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));
    }

    // チャットメッセージを取得し、処理する
    async function fetchLiveChatMessages(apiKey, liveChatId, isInitialLoad = false) {
        try {
            const messages = await getLiveChatMessages(apiKey, liveChatId);

            if (messages.length === 0) return;

            // チャットメッセージを処理
            messages.forEach(item => processChatMessage(item, isInitialLoad));

            // 集計結果を更新
            updateStatsDisplay();

            // 表示制限とメモリ管理
            manageChatMemory();

        } catch (error) {
            throw error;
        }
    }

    // 動画情報を整形して表示
    function displayVideoDetails(details) {
        // 動画情報を整形して表示
        const videoDetailsContainer = document.createElement('div');

        // タイトル
        const titleElement = document.createElement('div');
        titleElement.className = CLASS_NAMES.detailItem;
        titleElement.innerHTML = `<strong>タイトル:</strong> ${details.title}`;
        videoDetailsContainer.appendChild(titleElement);

        // チャンネル名
        const channelElement = document.createElement('div');
        channelElement.className = CLASS_NAMES.detailItem;
        channelElement.innerHTML = `<strong>チャンネル:</strong> ${details.channelTitle}`;
        videoDetailsContainer.appendChild(channelElement);

        // 公開日時
        const publishedAtElement = document.createElement('div');
        publishedAtElement.className = CLASS_NAMES.detailItem;
        publishedAtElement.innerHTML = `<strong>公開日:</strong> ${new Date(details.publishedAt).toLocaleString()}`;
        videoDetailsContainer.appendChild(publishedAtElement);

        // 表示エリアに追加
        elements.videoDetailsDiv.appendChild(videoDetailsContainer);
    }

    // チャットメッセージの処理
    function processChatMessage(item, isInitialLoad) {
        if (!item.snippet.hasDisplayContent) return;

        // 取得済データは処理対象から除外する
        const messageId = item.id;
        if (!isInitialLoad && LiveChatManager.data.messageIds.has(messageId)) return;
        LiveChatManager.data.messageIds.add(messageId);
        
        // チャットの整理
        const chatData = extractChatData(item);

        // 各処理
        trackUserActivity(chatData.authorId);
        countKeywordOccurrences(chatData.authorId, chatData.message);
        processSuperChat(chatData);
        processSuperSticker(chatData);
        processMembershipEvent(chatData);

        // チャットメッセージのレンダリング
        renderChatMessage(chatData);
    }

    // チャットの整理
    function extractChatData(item) {
        return {
            messageId: item.id,
            authorId: item.authorDetails.channelId,
            authorName: item.authorDetails.displayName,
            publishedAt: item.snippet.publishedAt,
            message: sanitizeHTML(item.snippet.displayMessage || ""),
            item
        };
    }

    // HTMLをサニタイズ
    function sanitizeHTML(str) {
        const tempDiv = document.createElement("div");
        tempDiv.textContent = str;
        return tempDiv.innerHTML;
    }

    // ユーザーの発言履歴を追跡
    function trackUserActivity(authorId) {
        if (!LiveChatManager.userWordHistory[authorId]) {
            LiveChatManager.userWordHistory[authorId] = { words: new Set(), lastActive: Date.now() };
        }
        LiveChatManager.userWordHistory[authorId].lastActive = Date.now();
    }

    // キーワード出現回数をカウント
    function countKeywordOccurrences(authorId, message) {
        const specialWords = getSpecialWordsWithWeights().map(obj => obj.word);
        if (!message) return;
        
        let matchedWords = new Set();
        specialWords.forEach((word) => {
            const regex = new RegExp(`(${word})`, 'gi');
            if (message.match(regex)) matchedWords.add(word);
        });

        matchedWords.forEach(word => {
            if (!LiveChatManager.userWordHistory[authorId].words.has(word)) {
                LiveChatManager.data.stats.keyWord[word] = (LiveChatManager.data.stats.keyWord[word] || 0) + 1;
                LiveChatManager.userWordHistory[authorId].words.add(word);
            }
        });
    }

    // スーパーチャットの集計処理
    function processSuperChat(chatData) {
        if (!chatData.item.snippet.superChatDetails) return;
        const amount = parseFloat(chatData.item.snippet.superChatDetails.amountDisplayString.replace(/[^\d.-]/g, '')) || 0;
        const currency = chatData.item.snippet.superChatDetails.currency;
        const jpyAmount = convertToJPY(amount, currency);
        const superChatKey = `${chatData.authorName}_${amount}_${currency}_${chatData.publishedAt}`;

        if (LiveChatManager.data.superChatIds.has(superChatKey)) return;
        LiveChatManager.data.superChatIds.add(superChatKey);

        if (LiveChatManager.data.superChatIds.size > CONFIG.MAX_MESSAGE_IDS) {
            LiveChatManager.data.superChatIds.delete([...LiveChatManager.data.superChatIds][0]);
        }

        LiveChatManager.data.stats.superChats += jpyAmount;
    }

    // スーパーステッカーの集計処理
    function processSuperSticker(chatData) {
        if (!chatData.item.snippet.superStickerDetails) return;
        const amount = parseFloat(chatData.item.snippet.superStickerDetails.amountDisplayString.replace(/[^\d.-]/g, '')) || 0;
        const currency = chatData.item.snippet.superStickerDetails.currency;
        const jpyAmount = convertToJPY(amount, currency);
        const superStickerKey = `${chatData.authorName}_${amount}_${currency}_${chatData.publishedAt}`;

        if (LiveChatManager.data.superStickerIds.has(superStickerKey)) return;
        LiveChatManager.data.superStickerIds.add(superStickerKey);

        if (LiveChatManager.data.superStickerIds.size > CONFIG.MAX_MESSAGE_IDS) {
            LiveChatManager.data.superStickerIds.delete([...LiveChatManager.data.superStickerIds][0]);
        }

        LiveChatManager.data.stats.superStickers += jpyAmount;
    }

    // メンバーシップイベントの集計処理
    function processMembershipEvent(chatData) {
        const membershipKey = `${chatData.authorName}_${chatData.publishedAt}`;
        
        if (chatData.item.snippet.type === "newSponsorEvent") {
            if (LiveChatManager.data.membershipIds.has(membershipKey)) return;
            LiveChatManager.data.membershipIds.add(membershipKey);

            if (LiveChatManager.data.membershipIds.size > CONFIG.MAX_MESSAGE_IDS) {
                LiveChatManager.data.membershipIds.delete([...LiveChatManager.data.membershipIds][0]);
            }

            if (!chatData.item.snippet.newSponsorDetails?.isUpgrade) {
                LiveChatManager.data.stats.members += 1;
            } else {
                LiveChatManager.data.stats.members += 1; // アップグレードも加算
            }
        } else if (chatData.item.snippet.type === "membershipGiftingEvent") {
            const giftCount = chatData.item.snippet.membershipGiftingDetails.giftMembershipsCount || 1;
            const membershipGiftKey = `${chatData.authorName}_${giftCount}_${chatData.publishedAt}`;

            if (LiveChatManager.data.membershipGiftIds.has(membershipGiftKey)) return;
            LiveChatManager.data.membershipGiftIds.add(membershipGiftKey);

            if (LiveChatManager.data.membershipGiftIds.size > CONFIG.MAX_MESSAGE_IDS) {
                LiveChatManager.data.membershipGiftIds.delete([...LiveChatManager.data.membershipGiftIds][0]);
            }

            LiveChatManager.data.stats.members += giftCount;
        }
    }

    // チャットメッセージのレンダリング
    function renderChatMessage(chatData) {
        // チャットメッセージのコンテナを作成
        const chatMessageDiv = createChatContainer(chatData);
        elements.liveChatDiv.appendChild(chatMessageDiv);
    
        // コメントデータを保存
        LiveChatManager.data.chatLogs.push({
            id: chatData.messageId,
            message: `[${chatData.authorName}] ${chatData.message}`
        });
    
        // チャットメモリ管理
        manageChatMemory();
    }

    // チャットメッセージのコンテナを作成（DOM操作の最適化）
    function createChatContainer(chatData) {
        const { authorName, message, item } = chatData;
        const chatMessageDiv = createChatElement("div", CLASS_NAMES.chatMessage);

        // 投稿者名
        const authorSpan = createChatElement("span", CLASS_NAMES.chatAuthor);
        authorSpan.textContent = `[${authorName}] `;
        chatMessageDiv.appendChild(authorSpan);

        // メッセージ本文（キーワードのハイライト適用）
        const messageSpan = createChatElement("span", CLASS_NAMES.chatText);
        messageSpan.innerHTML = highlightSpecialWords(message);

        // スーパーチャットの処理
        if (item.snippet.superChatDetails) {
            processSuperChatMessage(item.snippet.superChatDetails, messageSpan);
        }

        // スーパーステッカーの処理
        if (item.snippet.superStickerDetails) {
            processSuperStickerMessage(item.snippet.superStickerDetails, messageSpan);
        }

        // メンバーシップの処理
        if (
            item.snippet.type === "membershipGiftingEvent" ||
            item.snippet.type === "newSponsorEvent" ||
            item.snippet.type === "giftMembershipReceivedEvent"
        ) {
            processMembershipMessage(item, messageSpan);
        }

        chatMessageDiv.appendChild(messageSpan);
        return chatMessageDiv;
    }

    // チャット要素作成
    function createChatElement(tag, className) {
        const element = document.createElement(tag);
        element.className = className;
        return element;
    }
    
    // スーパーチャットのメッセージ処理
    function processSuperChatMessage(superChatDetails, messageSpan) {
        const amount = parseFloat(superChatDetails.amountDisplayString.replace(/[^\d.-]/g, '')) || 0;
        const currency = superChatDetails.currency;

        // メッセージ内容を更新
        const originalMessage = messageSpan.textContent;
        messageSpan.textContent = `${originalMessage} [${currency} ${amount.toLocaleString()}]`;

        // 日本円換算を追加
        const jpyAmount = convertToJPY(amount, currency);
        messageSpan.classList.add(CLASS_NAMES.chatSuperChat);
        messageSpan.textContent += ` => ${jpyAmount.toLocaleString()} 円`;
    }

    // スーパーステッカーのメッセージ処理
    function processSuperStickerMessage(superStickerDetails, messageSpan) {
        const amount = parseFloat(superStickerDetails.amountDisplayString.replace(/[^\d.-]/g, '')) || 0;
        const currency = superStickerDetails.currency;

        // メッセージ内容を更新
        const originalMessage = messageSpan.textContent;
        messageSpan.textContent = `${originalMessage} [${currency} ${amount.toLocaleString()}]`;

        // 日本円換算を追加
        const jpyAmount = convertToJPY(amount, currency);
        messageSpan.classList.add(CLASS_NAMES.chatSuperSticker);
        messageSpan.textContent += ` => ${jpyAmount.toLocaleString()} 円`;
    }

    // メンバーシップのメッセージ処理
    function processMembershipMessage(item, messageSpan) {
        if (item.snippet.type === "membershipGiftingEvent") {
            const giftCount = item.snippet.membershipGiftingDetails?.giftMembershipsCount || 1;
            const membershipLevel = item.snippet.membershipGiftingDetails?.giftMembershipsLevelName || "不明";
            messageSpan.classList.add(CLASS_NAMES.chatMembership);
            messageSpan.textContent += ` => ${giftCount}名に「${membershipLevel}」メンバーシップがギフトされました！`;

        } else if (item.snippet.type === "giftMembershipReceivedEvent") {
            messageSpan.classList.add(CLASS_NAMES.chatMembershipgift);
            messageSpan.textContent += ` => ギフトメンバーシップを受け取りました！`;

        } else if (item.snippet.type === "newSponsorEvent") {
            messageSpan.classList.add(CLASS_NAMES.chatMembership);
            const levelName = item.snippet.newSponsorDetails?.memberLevelName || "不明";
            const isUpgrade = item.snippet.newSponsorDetails?.isUpgrade;
            messageSpan.textContent += isUpgrade
                ? ` => メンバーシップアップグレード！（${levelName}）`
                : ` => 新規メンバーシップ加入！（${levelName}）`;
        }
    }

    // 特定ワードをハイライトする
    function highlightSpecialWords(message) {
        if (!message) return message;
        const specialWordsWithWeights = getSpecialWordsWithWeights();
        const highlightClass = CLASS_NAMES.chatSpecialWord;
    
        // HTML 解析用の DOMParser
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${message}</div>`, 'text/html');
        const root = doc.body.firstChild;
    
        function traverseNodes(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                specialWordsWithWeights.forEach(({ word }) => {
                    const regex = new RegExp(`(${word})`, 'gi');
                    if (regex.test(node.nodeValue)) {
                        const newHTML = node.nodeValue.replace(
                            regex,
                            `<span class="${highlightClass}">$1</span>`
                        );
                        const tempSpan = document.createElement('span');
                        tempSpan.innerHTML = newHTML;
                        
                        // 元のテキストノードを置き換え
                        node.replaceWith(...tempSpan.childNodes);
                    }
                });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 子ノードを再帰的に処理
                Array.from(node.childNodes).forEach(traverseNodes);
            }
        }
    
        traverseNodes(root);
    
        return root.innerHTML;
    }    

    // 金額は円換算で算出する
    function convertToJPY(amount, currency) {
        const rate = LiveChatManager.exchangeRates?.[currency.toUpperCase()];
        if (!rate) {
            console.warn(`未登録の通貨: ${currency} - 金額: ${amount} を1:1換算`);
            return Math.round(amount); // 1:1換算
        }
    
        return Math.round(amount / rate + Number.EPSILON);
    }

    // メモリ管理
    function manageChatMemory() {
        // DOM管理: 古いチャット行を削除
        removeExcessDOMElements(elements.liveChatDiv, CONFIG.MAX_CHAT_LINES);

        // 配列管理: 古いチャット履歴を削除
        LiveChatManager.data.chatLogs = retainRecentArrayItems(LiveChatManager.data.chatLogs, CONFIG.MAX_MESSAGE_IDS);

        // Set管理: 古いメッセージIDを削除
        retainRecentSetItems(LiveChatManager.data.messageIds, CONFIG.MAX_MESSAGE_IDS);

        // オブジェクト管理: 古いユーザー発言履歴を削除
        retainRecentObjectItems(
            LiveChatManager.userWordHistory,
            CONFIG.USER_HISTORY_LIMIT,
            'lastActive' // ソートキーとして最終アクティブ時刻を使用
        );
    }

    // DOMの古い要素を削除
    function removeExcessDOMElements(container, maxAllowedItems) {
        const excessCount = container.children.length - maxAllowedItems;
        if (excessCount > 0) {
            for (let i = 0; i < excessCount; i++) {
                container.removeChild(container.firstChild);
            }
        }
    }

    // 配列から古いデータを削除
    function retainRecentArrayItems(array, maxAllowedItems) {
        if (array.length > maxAllowedItems) {
            return array.slice(-maxAllowedItems); // 古い要素を削除
        }
        return array;
    }

    // Setから古いデータを削除
    function retainRecentSetItems(set, maxAllowedItems) {
        if (set.size > maxAllowedItems) {
            const iterator = set.values();
            while (set.size > maxAllowedItems) {
                set.delete(iterator.next().value); // 古い要素を削除
            }
        }
    }

    // オブジェクトから古いデータを削除
    function retainRecentObjectItems(object, maxAllowedItems, sortByKey) {
        const sortedEntries = Object.entries(object)
            .sort((a, b) => a[1][sortByKey] - b[1][sortByKey]); // 指定キーで昇順ソート
        const excessCount = sortedEntries.length - maxAllowedItems;

        if (excessCount > 0) {
            const excessEntries = sortedEntries.slice(0, excessCount); // 古い項目を抽出
            excessEntries.forEach(([key]) => delete object[key]); // 古い項目を削除
        }
    }

    // ライブチャットと動画情報のポーリングを開始
    async function startPolling(apiKey, videoId) {
        // 既存のポーリングを停止（重複実行を防ぐ）
        clearInterval(liveChatPolling);

        // 0以下はデフォルト設定
        const newInterval = parseInt(elements.pollingIntervalInput.value, 10);
        if (isNaN(newInterval) || newInterval <= 0) {
            LiveChatManager.pollingInterval = CONFIG.POLLING_INTERVAL_DEFAULT;
            elements.pollingIntervalInput.value = CONFIG.POLLING_INTERVAL_DEFAULT; // 入力欄も戻す
        } else {
            LiveChatManager.pollingInterval = newInterval;
        }    
        
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
            await fetchLiveChatMessages(apiKey, liveChatId, true);
            scrollToBottom(elements.liveChatDiv); // 自動スクロールを実行

            // ステータスを設定 (取得開始)
            setStatus(true);

            showNotification("開始しました！");

            // ポーリング開始
            liveChatPolling = setInterval(async () => {
                try {
                    await fetchVideoDetails(apiKey, videoId, false);
                    await fetchLiveChatMessages(apiKey, liveChatId, false);
                    scrollToBottom(elements.liveChatDiv); // 自動スクロールを実行
                } catch (error) {
                    const reason = error.reason || "unknown";
                    if (reason === "liveChatEnded" || reason === "invalidVideoId") {
                        // ライブチャット終了の場合は完全に停止
                        showNotification("ライブ配信は終了しました", "error");
                        stopPolling();
                        setStatus(false); // 停止したことを画面にも残す
                    } else if (reason === "quotaExceeded") {
                        // クォータ制限を超えた場合は、一時停止してリトライ
                        showNotification("クォータ制限を超えました。一時停止し、1分後に再試行します。", "error");
                        clearInterval(liveChatPolling);
                        setStatus(false);
            
                        setTimeout(() => {
                            showNotification("クォータ制限からの回復を試みます...");
                            startPolling(apiKey, videoId);
                        }, 1 * 60 * 1000); // 1分後にリトライ
                    } else {
                        console.error("予期しないエラー:", error);
                    }
                }
            }, LiveChatManager.pollingInterval * 1000);

        } catch (error) {
            notifyAPIError(error);
            stopPolling();
        }
    }

    // APIエラーに関する通知
    function notifyAPIError(error) {
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

    // 自動スクロール
    function scrollToBottom(element) {
        if (isAutoScrollEnabled && element) {
            element.scrollTop = element.scrollHeight;
        }
    }    

    // ステータスを設定
    function setStatus(isRunning) {
        if (!elements.statusDiv) return;

        elements.statusDiv.classList.add(CLASS_NAMES.status);
        elements.statusDiv.classList.toggle(CLASS_NAMES.executing, isRunning);
        elements.statusDiv.classList.toggle(CLASS_NAMES.stopped, !isRunning);
        elements.statusDiv.textContent = isRunning ? "ライブチャット取得中..." : "停止しました";
    }

    // ステータスをクリア
    function clearStatus() {
        if (!elements.statusDiv) return;
        elements.statusDiv.classList.remove(CLASS_NAMES.executing, CLASS_NAMES.stopped);
        elements.statusDiv.textContent = ""; 
    }

    // 初期化処理を行う
    function initializePolling() {
        LiveChatManager.initialize();
        updateStatsDisplay(true);
        clearStatus();
        toggleControls(true);
    }

    // 停止処理を行う
    function stopPolling() {
        clearInterval(liveChatPolling);
        clearStatus();
        toggleControls(false);
        liveChatPolling = null;
    }

    // ボタンと入力欄の有効/無効を切り替える
    function toggleControls(isPolling) {
        elements.startBtn.disabled = isPolling;
        elements.stopBtn.disabled = !isPolling;
        toggleInputState(isPolling);
    }

    // 入力欄を有効化 / 無効化する
    function toggleInputState(isDisabled) {
        elements.apiKeyInput.disabled = isDisabled;
        elements.videoIdInput.disabled = isDisabled;
        elements.pollingIntervalInput.disabled = isDisabled;

        elements.wordInputs.forEach(input => (input.disabled = isDisabled));
        elements.weightInputs.forEach(input => (input.disabled = isDisabled));

        elements.likeWeight.disabled = isDisabled;
        elements.superChatWeight.disabled = isDisabled;
        elements.superStickerWeight.disabled = isDisabled;
        elements.memberWeight.disabled = isDisabled;
    }

    // 画面設定を保存する
    function saveSettings() {
        try {
            const settings = {};

            document.querySelectorAll('[data-save]').forEach(input => {
                if (input) {
                    if (input.type === "checkbox") {
                        settings[input.id] = input.checked; // チェックボックスは true/false を保存
                    } else if (typeof input.value === "string") {
                        settings[input.id] = input.value.trim();
                    }
                }
            });

            localStorage.setItem('LiveChatSettings', JSON.stringify(settings));
        } catch (error) {
            console.error("設定の保存中にエラーが発生しました:", error);
            showNotification("設定の保存に失敗しました", "error");
        }
    }

    // 画面設定をロードする
    function loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('LiveChatSettings')) || {}; 

            document.querySelectorAll('[data-save]').forEach(input => {
                if (input && settings.hasOwnProperty(input.id)) {
                    if (input.type === "checkbox") {
                        input.checked = settings[input.id] === true; // チェックボックスの値を復元
                    } else {
                        input.value = settings[input.id];
                    }
                }
            });
        } catch (error) {
            console.error("設定の読み込み中にエラーが発生しました:", error);
            showNotification("設定の読み込みに失敗しました", "error");
        }
    }

    // クリップボードにコピーする
    function copyToClipboard(element) {
        if (element) {
            const text = element.innerText;
            navigator.clipboard.writeText(text)
                .then(() => showNotification("コピーしました！"))
                .catch(() => showNotification("コピーに失敗しました...", "error"));
        }
    }

    // トグルスイッチの状態を変更
    function liveChatAutoScroll(event) {
        isAutoScrollEnabled = event.target.checked;
    }

    // 通知を表示
    function showNotification(message, type = "success") {
        // 既存の通知を削除（重複防止）
        const existingNotification = document.querySelector(`.${CLASS_NAMES.notification}`);
        if (existingNotification) {
            existingNotification.remove();
        }
    
        const notification = document.createElement("div");
        notification.className = `${CLASS_NAMES.notification} ${type}`; // クラスを定数から設定
        notification.innerText = message;
    
        document.body.appendChild(notification);
    
        setTimeout(() => {
            notification.remove();
        }, 3000); // 3秒後に削除
    }    

    // 為替レートの状態を更新
    function updateExchangeRateDisplay() {
        const exchangeRateInput = elements.exchangeRateInput;
        const storedRates = localStorage.getItem('LiveChatExchangeRate');

        if (storedRates) {
            exchangeRateInput.value = "設定済です。必要のつど調整してください";
        } else {
            exchangeRateInput.value = "未設定。設定が必要です";
        }
    }

    // 開始ボタンクリックイベント
    function handleStartButtonClick() {
        if (LiveChatManager.isProcessing) {
            return;
        }
        LiveChatManager.isProcessing = true;
        
        try {
            const apiKey = elements.apiKeyInput.value.trim();
            const videoId = elements.videoIdInput.value.trim();
            if (!apiKey || !videoId) {
                showNotification("APIキーと動画IDを入力してください。", "error");
                return;
            }

            // ポーリングを開始
            startPolling(apiKey, videoId);
        } catch (error) {
            // 何もしない
        } finally {
            LiveChatManager.isProcessing = false;
        }
    }

    // 停止ボタンクリックイベント
    function handleStopButtonClick() {
        try {
            stopPolling();
            showNotification("停止しました！");
        } catch (error) {
            showNotification("停止処理中にエラーが発生しました。", "error");
        }
    }

    // APIキーのマスキング切り替えイベント
    function toggleApiKeyVisibility() {
        const apiKeyInput = elements.apiKeyInput;
        apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
        elements.toggleApiKeyBtn.textContent = apiKeyInput.type === "password" ? "表示" : "隠す";
    }

    // カラーコードを更新
    function updateColorCode(inputElement, codeElement) {
        if (!inputElement || !codeElement) return;
    
        // 初回ロード時の色を反映
        codeElement.textContent = inputElement.value.toUpperCase();
    
        // 色変更時にコードを更新し、スタイルを適用
        inputElement.addEventListener("input", () => {
            codeElement.textContent = inputElement.value.toUpperCase();
            updateTotalPointsStyle();
        });
    }    

    // 合計ポイントのスタイルを更新
    function updateTotalPointsStyle() {
        const fontSize = elements.totalPointsFontSize.value + 'px';
        const textColor = elements.totalPointsTextColor.value;
        const bgColor = elements.totalPointsBgColor.value;
        const isTransparent = elements.totalPointsBgTransparent.checked;
        const isPointsOnly = elements.totalPointsOnly.checked;

        // 背景色の決定（透過ONなら透明、OFFなら設定した色）
        const finalBgColor = isTransparent ? 'rgba(0,0,0,0)' : bgColor;

        // CSS変数を更新
        document.documentElement.style.setProperty(CSS_VARIABLES.totalPointsFontSize, fontSize);
        document.documentElement.style.setProperty(CSS_VARIABLES.totalPointsTextColor, textColor);
        document.documentElement.style.setProperty(CSS_VARIABLES.totalPointsBgColor, finalBgColor);

        // ポイントのみ表示の処理
        if (isPointsOnly) {
            elements.totalPointsContainer.classList.add('hide-label');
        } else {
            elements.totalPointsContainer.classList.remove('hide-label');
        }
    }

    // 合計ポイントのスタイルを初期値にリセット
    function resetAllTotalPointsToDefault() {
        // 初期値を設定
        Object.keys(DEFAULT_VALUES).forEach(key => {
            const input = elements[key];
            const defaultValue = DEFAULT_VALUES[key];

            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = defaultValue;
                } else {
                    input.value = defaultValue;
    
                    // `input[type="color"]` の UI も更新
                    if (input.type === "color") {
                        input.dispatchEvent(new Event("input")); // 変更イベントを手動で発火
                    }
                }
            }
        });

        // 設定を保存して画面に反映
        saveSettings();
        updateTotalPointsStyle();
    }

    // ライブチャットコピー ボタンクリックイベント
    function copyLiveChat() {
        copyToClipboard(elements.liveChatDiv);
    }

    // 動画情報コピー ボタンクリックイベント
    function copyVideoDetails() {
        copyToClipboard(elements.videoDetailsDiv);
    }

    // モーダルを開くイベント
    function openExchangeRateModal() {
        elements.modal.classList.add(CLASS_NAMES.show);
    }

    // モーダルを閉じる（× ボタン）イベント
    function closeExchangeRateModal() {
        elements.modal.classList.remove(CLASS_NAMES.show);
    }

    // 為替レートを初期化する
    async function resetExchangeRates() {
        // ローカルストレージから為替レートデータを削除
        localStorage.removeItem('LiveChatExchangeRate');

        // 最新の為替レートを取得
        try {
            LiveChatManager.exchangeRates = await fetchExchangeRates();

            // 為替レートリストを描画
            renderExchangeRates(isAscending);

            // 成功メッセージを表示
            showNotification("為替レートを初期化しました");
        } catch (error) {
            showNotification("為替レートの初期化に失敗しました", "error");
        }
    }

    // 為替レートを保存し、モーダルを閉じる
    function saveExchangeRates() {
        const settings = JSON.parse(localStorage.getItem('LiveChatExchangeRate')) || { exchangeRates: {} };
    
        document.querySelectorAll('#exchangeRateTable input').forEach(input => {
            const currency = input.getAttribute('data-currency');
            let rate = parseFloat(input.value);
            
            // 0 または空欄なら 1 に補正
            rate = rate > 0 ? rate : 1;
    
            LiveChatManager.exchangeRates[currency] = rate;
            settings.exchangeRates[currency] = rate;
        });
    
        // ローカルストレージへ保存
        localStorage.setItem('LiveChatExchangeRate', JSON.stringify({
            ...settings,
            timestamp: Date.now()
        }));
    
        // 為替レートの状態を更新
        updateExchangeRateDisplay();

        // 為替レートリストを描画
        renderExchangeRates(isAscending);

        // モーダルを閉じる
        closeExchangeRateModal();

        showNotification("為替レートを保存しました");
    }

    // モーダル外側クリック時に閉じる
    function closeExchangeRateModalOnOutsideClick(event) {
        if (event.target === elements.modal) {
            elements.modal.classList.remove(CLASS_NAMES.show);
        }
    }

    // 通貨ソート時の矢印を更新する
    function updateCurrencySortArrow(ascending) {
        elements.currencySortArrow.textContent = ascending ? "▲" : "▼";
    }

    // 通貨リストをテーブルに表示する（ソート方向を指定）
    function renderExchangeRates(ascending = true) {
        const table = elements.exchangeRateTable;
        const tableBody = table.querySelector("tbody");
        tableBody.innerHTML = ''; // テーブルの内容をクリア

        // 通貨コード順にソート
        const sortedRates = Object.entries(LiveChatManager.exchangeRates).sort((a, b) =>
            ascending ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])
        );

        sortedRates.forEach(([currency, rate]) => {
            const currencyInfo = LiveChatManager.currencyInfo[currency] || { symbol: currency, country: "不明" };

            // <tr> 要素を作成
            const row = document.createElement("tr");

            // <td> 通貨コード
            const currencyCell = document.createElement("td");
            currencyCell.textContent = currency;

            // <td> 通貨記号
            const symbolCell = document.createElement("td");
            symbolCell.textContent = currencyInfo.symbol;

            // <td> 国名
            const countryCell = document.createElement("td");
            countryCell.textContent = currencyInfo.country;

            // <td> レート (編集可能/不可)
            const rateCell = document.createElement("td");
            const rateInput = document.createElement("input");
            rateInput.type = "number";
            rateInput.value = rate;
            rateInput.dataset.currency = currency;

            // JPY の場合は編集不可
            if (currency === 'JPY') {
                rateInput.disabled = true;
            }
            rateCell.appendChild(rateInput);

            // 行にセルを追加
            row.appendChild(currencyCell);
            row.appendChild(symbolCell);
            row.appendChild(countryCell);
            row.appendChild(rateCell);

            // テーブルに行を追加
            tableBody.appendChild(row);
        });

        // 矢印を更新
        updateCurrencySortArrow(ascending);
    }

    // 通貨のソートを切り替える
    function toggleCurrencySort() {
        isAscending = !isAscending;
        renderExchangeRates(isAscending);
    }
    
    // 初期化処理
    document.addEventListener('DOMContentLoaded', initializeApp);

})();