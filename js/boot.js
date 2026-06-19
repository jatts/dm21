/* ═══════════════════════════════════════
   STATUS BAR FIX — CapacitorJS
   Capacitor @capacitor/status-bar plugin se
   asal status bar height milti hai.
   Fallback: getBoundingClientRect detection
═══════════════════════════════════════ */
(function() {
    function applyStatusBarPadding(px) {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        px = Math.max(0, Math.min(px, 80)); // 0-80px range safety
        gb.style.paddingTop = px + 'px';
        gb.style.height = (58 + px) + 'px';
    }

    function trySetupStatusBar() {
        if (window.CapStatusBar) {
            // Capacitor StatusBar plugin se overlay disable karo
            // taake WebView content status bar ke neeche se shuru ho
            try {
                window.CapStatusBar.setOverlaysWebView({ overlay: false });
            } catch (e) {}
            return true;
        }
        return false;
    }

    // Plugins load hone ka wait karo
    if (!trySetupStatusBar()) {
        window.addEventListener('capacitorPluginsReady', trySetupStatusBar);
    }

    // Fallback: agar overlay false set bhi ho jaye,
    // safe-area-inset-top Capacitor mein sahi kaam karta hai
    function applySafeArea() {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        gb.style.paddingTop = 'env(safe-area-inset-top, 0px)';
        gb.style.height = 'calc(58px + env(safe-area-inset-top, 0px))';
    }
    applySafeArea();

    // Extra fallback: agar env() bhi 0 aaye (rare), rect check karo
    setTimeout(function() {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        var rect = gb.getBoundingClientRect();
        if (rect.top < 2) {
            // env() kaam nahi kar raha — manual estimate (status bar ~24-32px)
            var estimate = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android' ? 28 : 0;
            if (estimate > 0) applyStatusBarPadding(estimate);
        }
    }, 300);

    window.setStatusBarHeight = function(px) { applyStatusBarPadding(parseInt(px) || 0); };
})();

/* ═══════════════════════════════════════
   AI2 BRIDGE
   App Inventor WebView ke liye functions
═══════════════════════════════════════ */
window.refillCoins = () => window.gameBar && window.gameBar.refillCoins();
window.setBarcode  = bc => lookupBarcode(bc);

/* ═══════════════════════════════════════
   CAPACITOR ADMOB BRIDGE
   @capacitor-community/admob plugin se reward ad
═══════════════════════════════════════ */

// Central reward handler
function _onRewardEarned() {
    if (window.gameBar) window.gameBar.refillCoins();
}

// Test Ad Unit IDs (Google ke official test IDs)
// Production mein inhe apni asli Ad Unit ID se replace karo
var AD_UNIT_REWARDED = 'ca-app-pub-3940256099942544/5224354917'; // Android test rewarded
var AD_UNIT_BANNER    = 'ca-app-pub-3940256099942544/6300978111'; // Android test banner

var _rewardListenersAttached = false;

function _setupAdMobListeners() {
    if (!window.CapAdMob || _rewardListenersAttached) return false;
    var AdMob = window.CapAdMob;

    try {
        AdMob.addListener('onRewardedVideoAdReward', function (reward) {
            _onRewardEarned();
        });
        AdMob.addListener('onRewardedVideoAdFailedToLoad', function (err) {
            console.warn('Rewarded ad failed to load:', err);
            showToast && showToast('Ad load nahi hui, dobara try karein', 'error');
        });
        _rewardListenersAttached = true;
        return true;
    } catch (e) {
        console.warn('AdMob listener setup failed:', e);
        return false;
    }
}

// Reward ad load + show karo
window.showRewardedAd = async function () {
    if (!window.CapAdMob) {
        showToast && showToast('Ad system abhi taiyaar nahi', 'warn');
        return;
    }
    _setupAdMobListeners();
    try {
        await window.CapAdMob.prepareRewardVideoAd({ adId: AD_UNIT_REWARDED });
        await window.CapAdMob.showRewardVideoAd();
    } catch (e) {
        console.warn('Rewarded ad show failed:', e);
        showToast && showToast('Ad show nahi ho saki', 'error');
    }
};

// Banner show/hide helpers (calculator open/close ke liye use hote hain)
window.showAdBanner = async function () {
    if (!window.CapAdMob) return;
    try {
        await window.CapAdMob.showBanner({
            adId: AD_UNIT_BANNER,
            adSize: 'BANNER',
            position: 'BOTTOM_CENTER',
            isTesting: true
        });
    } catch (e) {}
};
window.hideAdBanner = async function () {
    if (!window.CapAdMob) return;
    try { await window.CapAdMob.hideBanner(); } catch (e) {}
};

window.addEventListener('capacitorPluginsReady', function () {
    _setupAdMobListeners();
    window.showAdBanner();
});

// Agar plugins already ready hain (race condition safety)
if (window.__capacitorReady) {
    _setupAdMobListeners();
    window.showAdBanner();
}

/* ═══════════════════════════════════════
   BOOT — sabse aakhir mein run hota hai
═══════════════════════════════════════ */
updateGameBar();
renderHistory();

// initDatabase sirf tab call karo jab session ho
// (login ke baad auth.js khud call karega agar session nahi tha)
if (typeof gsGetSession === 'function' && gsGetSession()) {
    initDatabase();
}

// After% Price card tap → calculator open
const _apCard = document.getElementById('afterPriceCard');
if (_apCard) {
    _apCard.addEventListener('click', function(e) {
        if (e.target.closest('label')) return;
        const hint = document.getElementById('calcHint');
        if (hint && hint.style.display !== 'none' && calcPct > 0) {
            openPriceCalc(calcPct, calcArticle);
        }
    });
}

// Sync on page unload
window.addEventListener('pagehide',     function() { if (typeof gsFlushEvents === 'function') gsFlushEvents(null); });
window.addEventListener('beforeunload', function() { if (typeof gsFlushEvents === 'function') gsFlushEvents(null); });

// Boot sync after 4s
setTimeout(function() {
    if (typeof gsGetSession === 'function' && gsGetSession()) {
        if (typeof gsFlushEvents === 'function') gsFlushEvents(null);
    }
}, 4000);
