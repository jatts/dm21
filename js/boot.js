/* ═══════════════════════════════════════
   STATUS BAR FIX — CapacitorJS
   Capacitor @capacitor/status-bar plugin se
   asal status bar overlay disable karte hain
   taake WebView notch/camera-cutout ke neeche
   se shuru ho — env(safe-area-inset-top) phir
   sahi value deta hai jo notch height bhi
   include karti hai.
═══════════════════════════════════════ */
(function() {
    function applyStatusBarPadding(px) {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        px = Math.max(0, Math.min(px, 120)); // notch wale phones mein zyada ho sakta hai
        gb.style.paddingTop = px + 'px';
        gb.style.height = (58 + px) + 'px';
    }

    function applySafeArea() {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        gb.style.paddingTop = 'env(safe-area-inset-top, 0px)';
        gb.style.height = 'calc(58px + env(safe-area-inset-top, 0px))';
    }

    async function trySetupStatusBar() {
        if (!window.CapStatusBar) return false;
        try {
            // Overlay false = status bar apni space lega, WebView uske neeche shuru hogi
            await window.CapStatusBar.setOverlaysWebView({ overlay: false });
            // Dark icons chahiye agar status bar dark background pe hai, light agar gamebar dark hai
            try { await window.CapStatusBar.setStyle({ style: 'DARK' }); } catch(e) {}

            // setOverlaysWebView ke baad layout settle hone do, phir safe-area apply karo
            setTimeout(function() {
                applySafeArea();
                // Verify: agar ab bhi gap nahi bana to manual estimate use karo
                setTimeout(function() {
                    var gb = document.getElementById('gamebar-wrap');
                    if (!gb) return;
                    var rect = gb.getBoundingClientRect();
                    if (rect.top < 4) {
                        // Punch-hole/notch wale phones mein status bar 30-40px tak ho sakti hai
                        applyStatusBarPadding(36);
                    }
                }, 150);
            }, 100);

            return true;
        } catch (e) {
            console.warn('StatusBar setOverlaysWebView failed:', e);
            return false;
        }
    }

    // Plugin load hone ka wait karo
    if (!trySetupStatusBar()) {
        window.addEventListener('capacitorPluginsReady', trySetupStatusBar);
    }

    // Immediate fallback jab tak plugin load ho raha hai
    applySafeArea();

    // Last-resort fallback agar StatusBar plugin bilkul available na ho
    setTimeout(function() {
        if (window.CapStatusBar) return; // plugin mil gaya, woh handle karega
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        var rect = gb.getBoundingClientRect();
        if (rect.top < 4) {
            applyStatusBarPadding(36);
        }
    }, 500);

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
            console.log('[AdMob] Reward earned:', reward);
            _onRewardEarned();
        });
        AdMob.addListener('onRewardedVideoAdLoaded', function () {
            console.log('[AdMob] Rewarded ad loaded successfully');
        });
        AdMob.addListener('onRewardedVideoAdFailedToLoad', function (err) {
            console.warn('[AdMob] Rewarded ad failed to load:', JSON.stringify(err));
            showToast && showToast('Ad load fail: ' + (err && err.message ? err.message : JSON.stringify(err)), 'error', 4000);
        });
        AdMob.addListener('onRewardedVideoAdFailedToShow', function (err) {
            console.warn('[AdMob] Rewarded ad failed to show:', JSON.stringify(err));
            showToast && showToast('Ad show fail: ' + (err && err.message ? err.message : JSON.stringify(err)), 'error', 4000);
        });
        _rewardListenersAttached = true;
        console.log('[AdMob] Listeners attached successfully');
        return true;
    } catch (e) {
        console.warn('[AdMob] Listener setup failed:', e);
        showToast && showToast('AdMob listener setup error: ' + e.message, 'error', 4000);
        return false;
    }
}

// Reward ad load + show karo
window.showRewardedAd = async function () {
    console.log('[AdMob] showRewardedAd called. CapAdMob available:', !!window.CapAdMob);

    if (!window.CapAdMob) {
        var reason = !window.Capacitor
            ? 'Capacitor bridge load nahi hua'
            : (!window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform())
                ? 'App browser mein khuli hai, native app nahi'
                : 'AdMob native plugin APK mein registered nahi (rebuild zaroori)';
        console.warn('[AdMob] CapAdMob not available. Reason:', reason);
        showToast && showToast('Ad system ready nahi: ' + reason, 'error', 4000);
        return;
    }

    _setupAdMobListeners();
    try {
        showToast && showToast('Ad load ho rahi hai...', 'info', 1500);
        console.log('[AdMob] Preparing rewarded ad with unit:', AD_UNIT_REWARDED);
        await window.CapAdMob.prepareRewardVideoAd({
            adId: AD_UNIT_REWARDED,
            isTesting: true
        });
        console.log('[AdMob] Ad prepared, showing now...');
        await window.CapAdMob.showRewardVideoAd();
        console.log('[AdMob] showRewardVideoAd call completed');
    } catch (e) {
        console.warn('[AdMob] Rewarded ad show failed:', e);
        showToast && showToast('Ad error: ' + (e && e.message ? e.message : JSON.stringify(e)), 'error', 5000);
    }
};

// Banner show/hide helpers (calculator open/close ke liye use hote hain)
window.showAdBanner = async function () {
    if (!window.CapAdMob) {
        console.warn('[AdMob] showAdBanner: CapAdMob not available');
        return;
    }
    try {
        console.log('[AdMob] Showing banner with unit:', AD_UNIT_BANNER);
        await window.CapAdMob.showBanner({
            adId: AD_UNIT_BANNER,
            adSize: 'BANNER',
            position: 'BOTTOM_CENTER',
            isTesting: true
        });
        console.log('[AdMob] Banner show call completed');
    } catch (e) {
        console.warn('[AdMob] Banner show failed:', e);
    }
};
window.hideAdBanner = async function () {
    if (!window.CapAdMob) return;
    try { await window.CapAdMob.hideBanner(); } catch (e) {}
};

window.addEventListener('capacitorPluginsReady', function () {
    console.log('[Capacitor] Plugins ready event fired. CapAdMob:', !!window.CapAdMob, 'CapTTS:', !!window.CapTTS, 'CapStatusBar:', !!window.CapStatusBar);
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
