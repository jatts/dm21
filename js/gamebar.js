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
            var ap = document.getElementById('adPrompt');
            if (ap) ap.style.display = 'block';
            updateAdPromptState();
            // Shake animation
            if (ap) {
                ap.classList.remove('ap-shake');
                void ap.offsetWidth;
                ap.classList.add('ap-shake');
            }
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
            showToast('🎉 Level ' + nlv + ' mubarak ho!', 'info', 3000);
            tts('Level ' + nlv + ' achieved', 'en-US');
            showLevelUpCelebration(nlv);
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
        if (coins >= MAX_COINS) {
            showToast('✅ Aapke paas already max 90 coins hain!', 'warn', 3000);
            updateAdPromptState();
            return;
        }
        coins = Math.min(coins + 30, MAX_COINS);
        var earned = (AppDB.getInt('coinsEarned', 0)) + 30;
        AppDB.set('coinsEarned', earned);
        // Reward success card show karo
        showRewardSuccess(coins);
        var aw = (AppDB.getInt('adsWatched', 0)) + 1;
        AppDB.set('adsWatched', aw);
        updateGameBar();
        tts('30 coins added', 'en-US');
        document.getElementById('adPrompt').style.display = 'none';
        updateAdPromptState();
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
    if (!overlay) return;

    if (coinEl) coinEl.textContent = newCoins;
    overlay.style.display = 'flex';
    overlay.classList.add('open');

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
    if (overlay) { overlay.style.display = 'none'; overlay.classList.remove('open'); }
}

window.closeRewardSuccess = closeRewardSuccess;
window.showRewardSuccess  = showRewardSuccess;

/* ═══════════════════════════════════════
   AD PROMPT STATE — max coins check
═══════════════════════════════════════ */
function updateAdPromptState() {
    var btn = document.getElementById('watchAdBtn');
    var settingBtn = document.getElementById('settingWatchAd');
    var apMsg = document.getElementById('adPromptMsg');

    if (coins >= MAX_COINS) {
        // Max coins - button disable karo
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Coins Full! (90/90)';
        }
        if (settingBtn) {
            settingBtn.disabled = true;
            settingBtn.style.opacity = '0.5';
            settingBtn.innerHTML = '<i class="fas fa-check-circle"></i> Max Coins (90/90)';
        }
        if (apMsg) apMsg.innerHTML = '<i class="fas fa-info-circle"></i> Aapke paas already max 90 coins hain!';
    } else {
        // Normal state
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.innerHTML = '<i class="fas fa-play-circle"></i> 30 Coins کے لیے Ad دیکھیں';
        }
        if (settingBtn) {
            settingBtn.disabled = false;
            settingBtn.style.opacity = '1';
            settingBtn.innerHTML = '<i class="fas fa-play-circle"></i> Ad Dekh Kar 30 Coins Kamao';
        }
        if (apMsg) apMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> کوئی سکین باقی نہیں! Ad dekho aur 30 coins pao!';
    }
}
window.updateAdPromptState = updateAdPromptState;

/* ═══════════════════════════════════════
   LEVEL UP CELEBRATION
═══════════════════════════════════════ */
function showLevelUpCelebration(lvl) {
    // Existing overlay check
    var old = document.getElementById('levelUpOverlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'levelUpOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;pointer-events:none;';

    overlay.innerHTML = `
        <div style="
            background:linear-gradient(135deg,#1a0a40,#0d2040);
            border:2px solid rgba(124,77,255,0.6);
            border-radius:28px;padding:36px 40px;text-align:center;
            animation:lvlUpPop .5s cubic-bezier(.34,1.56,.64,1);
            box-shadow:0 0 80px rgba(124,77,255,0.4),0 0 160px rgba(0,229,255,0.1);
            pointer-events:all;
        ">
            <div style="font-size:56px;margin-bottom:8px;animation:lvlSpin 0.8s ease">⭐</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Level Up!</div>
            <div style="font-size:48px;font-weight:900;font-family:var(--font-mono);
                background:linear-gradient(135deg,#7c4dff,#00e5ff);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                margin-bottom:4px">LVL ${lvl}</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.7)">Mubarak ho! 🎊</div>
        </div>
    `;

    // Confetti dots
    for (var i = 0; i < 18; i++) {
        var dot = document.createElement('div');
        var colors = ['#7c4dff','#00e5ff','#ffd600','#00e676','#ff4081'];
        var color = colors[i % colors.length];
        var size = (Math.random() * 10 + 6) + 'px';
        var left = (Math.random() * 100) + '%';
        var delay = (Math.random() * 0.5) + 's';
        dot.style.cssText = `
            position:fixed;top:-20px;left:${left};width:${size};height:${size};
            background:${color};border-radius:50%;
            animation:confettiFall 1.2s ${delay} ease-in forwards;
            pointer-events:none;z-index:99998;
        `;
        document.body.appendChild(dot);
        setTimeout(function(d){ d.remove(); }, 2000);
    }

    document.body.appendChild(overlay);
    setTimeout(function() {
        overlay.style.animation = 'lvlUpFadeOut .4s ease forwards';
        setTimeout(function() { overlay.remove(); }, 400);
    }, 2200);
}
window.showLevelUpCelebration = showLevelUpCelebration;
