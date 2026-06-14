/* ═══════════════════════════════════════
   GAMEBAR STATE
═══════════════════════════════════════ */
const MAX_COINS = 90;
let coins      = AppDB.getInt('coins', 30);
let totalScans = AppDB.getInt('totalScans', 0);
let level      = 1;

const baseThresholds = [100,220,350,490,640];

function getThreshold(lvl) {
    if (lvl <= 5) return baseThresholds[lvl-1];
    // Beyond level 5: incrementally growing
    let t = baseThresholds[4];
    for (let i=6; i<=lvl; i++) t += 150 + 10*(i-5);
    return t;
}

function calcLevel() {
    let lv = 1;
    // Level N is reached when totalScans >= getThreshold(N-1)
    // i.e. you are at level N if scans < getThreshold(N)
    while (totalScans >= getThreshold(lv)) lv++;
    return lv;
}

function updateGameBar() {
    level = calcLevel();
    document.getElementById('coinCount').textContent = coins;
    document.getElementById('scanCount').textContent = totalScans;
    document.getElementById('levelInfo').textContent = `Lvl ${level}`;
    // Rank title under level badge (gamebar)
    (function() {
        if (typeof RANKS === 'undefined') return;
        let rank = RANKS[0];
        for (let i = 0; i < RANKS.length; i++) {
            if (totalScans >= RANKS[i].min) rank = RANKS[i];
        }
        const gbRank = document.getElementById('gbRankTitle');
        if (gbRank) gbRank.textContent = rank.title;
    })();
    document.getElementById('coinProgressFill').style.width = `${Math.min((coins/30)*100,100)}%`;

    const prevT = level === 1 ? 0 : getThreshold(level-1);
    const nextT = getThreshold(level);
    const pct   = nextT > prevT ? ((totalScans - prevT) / (nextT - prevT)) * 100 : 0;
    document.getElementById('scanProgressFill').style.width = `${Math.max(0,Math.min(pct,100))}%`;

    AppDB.set('coins', coins);
    AppDB.set('totalScans', totalScans);
    updateStatsPage();
}

window.gameBar = {
    checkCoins() {
        if (coins <= 0) {
            document.getElementById('adPrompt').style.display = 'block';
            return false;
        }
        return true;
    },
    deductCoin() {
        // Optimistic local update (instant UI response)
        const prevLv = calcLevel();
        coins = Math.max(0, coins - 1);
        totalScans++;
        // Track spent locally
        var spent = (AppDB.getInt('coinsSpent', 0)) + 1;
        AppDB.set('coinsSpent', spent);
        updateGameBar();
        const el = document.getElementById('coinCount');
        el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 400);
        if (calcLevel() > prevLv) {
            const nlv = calcLevel();
            showToast('Level ' + nlv + ' mubarak ho!', 'info', 3000);
            tts('Level ' + nlv + ' achieved', 'en-US');
        }
        // Queue GS sync event
        gsQueueEvent('scan');
    },
    deductCoinOnly() {
        // Search mode: coin minus, no scan count
        coins = Math.max(0, coins - 1);
        AppDB.set('coins', coins);
        document.getElementById('coinCount').textContent = coins;
        document.getElementById('coinProgressFill').style.width = Math.min((coins/30)*100, 100) + '%';
        const el = document.getElementById('coinCount');
        el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 400);
        gsQueueEvent('searchCoin');
    },
    refillCoins() {
        if (coins >= MAX_COINS) { showToast('Coins already max (' + MAX_COINS + ')!', 'warn'); return; }
        coins = Math.min(coins + 30, MAX_COINS);
        var earned = (AppDB.getInt('coinsEarned', 0)) + 30;
        AppDB.set('coinsEarned', earned);
        // Reward success card show karo
        showRewardSuccess(coins);
        var aw = (AppDB.getInt('adsWatched', 0)) + 1;
        AppDB.set('adsWatched', aw);
        updateGameBar();
        // Toast hataya — reward card show hota hai
        tts('30 coins added', 'en-US');
        document.getElementById('adPrompt').style.display = 'none';
        // Sync ad event to GS immediately
        gsQueueEvent('ad');
    },
    resetGame() {
        coins = 30; totalScans = 0; level = 1;
        AppDB.remove('coinsSpent');
        AppDB.remove('coinsEarned');
        AppDB.remove('adsWatched');
        updateGameBar();
        showToast('Game reset ho gaya', 'info');
    },
    // watchAd: settings.js is ko call karta hai
    watchAd() {
        if (window.AdMob && typeof window.AdMob.showRewarded === 'function') {
            window.AdMob.showRewarded();
        } else if (window.AppInventor) {
            window.AppInventor.setWebViewString('show_ad');
        } else {
            this.refillCoins();
        }
    }
};


// ════════════════════════════════════════
// REWARD SUCCESS CARD
// ════════════════════════════════════════
var _rewardTimer = null;

function showRewardSuccess(newCoins) {
    var overlay = document.getElementById('rewardSuccessOverlay');
    var coinEl  = document.getElementById('rewardNewCoins');
    var cdEl    = document.getElementById('rewardCountdown');
    if (!overlay) { console.warn('rewardSuccessOverlay not found'); return; }

    // newCoins total coins hai — display mein total dikhao
    if (coinEl) coinEl.textContent = newCoins;
    overlay.classList.add('open');
    overlay.style.display = 'flex'; // fallback agar CSS class kaam na kare

    // adPrompt hide karo
    var ap = document.getElementById('adPrompt');
    if (ap) ap.style.display = 'none';

    // Countdown 3 seconds
    var count = 3;
    if (cdEl) cdEl.textContent = count;
    if (_rewardTimer) clearInterval(_rewardTimer);
    _rewardTimer = setInterval(function() {
        count--;
        if (cdEl) cdEl.textContent = count;
        if (count <= 0) {
            clearInterval(_rewardTimer);
            closeRewardSuccess();
        }
    }, 1000);
}

function closeRewardSuccess() {
    if (_rewardTimer) { clearInterval(_rewardTimer); _rewardTimer = null; }
    var overlay = document.getElementById('rewardSuccessOverlay');
    if (overlay) {
        overlay.classList.remove('open');
        overlay.style.display = 'none'; // fallback direct style reset
    }
}

window.closeRewardSuccess = closeRewardSuccess;
window.showRewardSuccess  = showRewardSuccess;
