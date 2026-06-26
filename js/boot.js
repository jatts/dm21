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
    // Banner height: AdMob BANNER size = 320x50dp standard
    // Lekin screenshot mein 468x60 aa raha hai — AdMob smart banner hai
    // jo 60px height use karta hai. Safe value: 60px.
    var BANNER_HEIGHT_PX = 60;
    var _bannerPaddingApplied = false;

    function applyStatusBarPadding(px) {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        px = Math.max(0, Math.min(px, 120)); // notch wale phones mein zyada ho sakta hai
        // Agar banner already show ho chuki hai to uski height bhi add karo
        var extraPad = _bannerPaddingApplied ? BANNER_HEIGHT_PX : 0;
        gb.style.paddingTop = (px + extraPad) + 'px';
        gb.style.minHeight = (58 + px + extraPad) + 'px';
        gb.style.height = 'auto';
        // Current statusbar px store karo — baad mein banner ke waqt kaam aayega
        gb.dataset.statusBarPx = px;
    }

    window._applyBannerPaddingToGamebar = function(bannerH) {
        // Sirf PEHLI baar apply karo — har showAdBanner call pe dobara nahi
        if (_bannerPaddingApplied) {
            console.log('[Banner] Padding already applied, skipping');
            return;
        }
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        bannerH = bannerH || BANNER_HEIGHT_PX;
        BANNER_HEIGHT_PX = bannerH;
        _bannerPaddingApplied = true;
        var currentPad = parseFloat(window.getComputedStyle(gb).paddingTop) || 0;
        gb.style.paddingTop = (currentPad + bannerH) + 'px';
        gb.style.minHeight = (parseFloat(gb.style.minHeight) || 58) + bannerH + 'px';
        console.log('[Banner] Gamebar pushed down by', bannerH, 'px. New paddingTop:', gb.style.paddingTop);
    };

    function applySafeArea() {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        gb.style.paddingTop = 'env(safe-area-inset-top, 0px)';
        gb.style.minHeight = 'calc(58px + env(safe-area-inset-top, 0px))';
        gb.style.height = 'auto';
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

    window.setStatusBarHeight = function(px) {
    applyStatusBarPadding(parseInt(px) || 0);
    // Privacy/Terms overlay headers bhi same padding do
    var ph = document.getElementById('privacyHeader');
    var th = document.getElementById('termsHeader');
    var safePx = Math.max(0, Math.min(parseInt(px) || 0, 80));
    if (ph) ph.style.paddingTop = (16 + safePx) + 'px';
    if (th) th.style.paddingTop = (16 + safePx) + 'px';
};
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
//
// IMPORTANT API NOTE: @capacitor-community/admob mein banner ke 2 alag
// "show karne" ke tareeke hain:
//   - showBanner(options)  → NAYA banner load karta hai (poori request cycle,
//                            slow, network pe depend karta hai)
//   - resumeBanner()       → hideBanner() se chupaya gaya PURANA banner wapis
//                            dikhata hai (fast, koi naya load nahi)
//
// Hum calculator open/close ke beech sirf show/hide kar rahe hain (naya ad
// nahi chahiye), isliye hideBanner() + resumeBanner() ka pair use karna
// chahiye — showBanner() sirf PEHLI baar (app load pe) use hoga.
var _bannerLoadedOnce = false; // pehli baar showBanner() se load ho chuki hai?

// Banner ko status bar ke bilkul NEECHE dikhana hai.
//
// SAHI TARIKA: gamebar-wrap ki computed paddingTop = exact status bar height.
// Boot.js mein applySafeArea()/applyStatusBarPadding() yahi value set karta hai.
// @capacitor/status-bar v6 ke getInfo() mein statusBarHeight field NAHI hoti,
// isliye woh approach kaam nahi karti.
//
// AdMob banner native layer pe render hoti hai lekin margin CSS pixels mein
// accept karta hai — aur getComputedStyle().paddingTop bhi CSS pixels mein
// hota hai — toh yeh match karta hai.
function getBannerTopMargin() {
    var sbHeight = 0;
    try {
        var gb = document.getElementById('gamebar-wrap');
        if (gb) {
            var pt = window.getComputedStyle(gb).paddingTop;
            sbHeight = Math.round(parseFloat(pt) || 0);
            console.log('[AdMob] gamebar paddingTop (status bar height):', sbHeight, 'raw:', pt);
        }
        // Safety: agar 0 aaya (layout settle nahi hua) to reasonable default
        if (!sbHeight) {
            sbHeight = 24; // minimum Android status bar
            console.log('[AdMob] paddingTop was 0, using default:', sbHeight);
        }
    } catch(e) {
        sbHeight = 24;
        console.warn('[AdMob] getBannerTopMargin error:', e);
    }
    _showDebugBadge('sbH:' + sbHeight + ' App:' + !!window.CapApp + ' AdMob:' + !!window.CapAdMob);
    return sbHeight;
}

// On-screen debug badge — HAMESHA khud dikhta hai app khulte waqt,
// kisi URL param ki zaroorat nahi. Har update pe apna hide-timer reset
// karta hai (25 second), taake banner load hone mein extra time lage
// to bhi aakhri/sabse zaroori message (banner shown/failed) miss na ho.
function _showDebugBadge(text) { /* debug disabled */ }

window.showAdBanner = async function () {
    if (!window.CapAdMob) {
        console.warn('[AdMob] showAdBanner: CapAdMob not available');
        return;
    }
    // ZAROORI: AdMob.initialize() async hai aur native SDK boot karta hai
    // (network call bhi ho sakti hai) — agar yeh complete hone se PEHLE
    // showBanner() call ho jaye to banner silently fail ho jata hai
    // (na koi error, na koi banner). Yahan us initialize-promise ka wait
    // karte hain pehle.
    if (window.__admobInitPromise) {
        try {
            var initOk = await window.__admobInitPromise;
            console.log('[AdMob] AdMob init wait completed, success:', initOk);
        } catch (e) {
            console.warn('[AdMob] AdMob init wait failed:', e);
        }
    }
    var topMargin = getBannerTopMargin();
    try {
        if (_bannerLoadedOnce && typeof window.CapAdMob.resumeBanner === 'function') {
            // Banner pehle se load ho chuki hai — sirf resume karo (fast)
            console.log('[AdMob] Resuming previously loaded banner');
            await window.CapAdMob.resumeBanner();
        } else {
            // Pehli baar — naya banner load karo
            console.log('[AdMob] Loading banner for the first time, unit:', AD_UNIT_BANNER, 'margin:', topMargin);
            await window.CapAdMob.showBanner({
                adId: AD_UNIT_BANNER,
                adSize: 'BANNER',
                position: 'TOP_CENTER',
                margin: topMargin,
                isTesting: true
            });
            _bannerLoadedOnce = true;
        }
        console.log('[AdMob] Banner show/resume completed');
        // Gamebar ko banner ke neeche push karo
        if (typeof window._applyBannerPaddingToGamebar === 'function') {
            window._applyBannerPaddingToGamebar(60);
        }
        _showDebugBadge('Banner: SHOWN ✓ TOP margin:' + topMargin);
    } catch (e) {
        console.warn('[AdMob] Banner show/resume failed:', e);
        _showDebugBadge('Banner FAILED: ' + (e && e.message ? e.message : JSON.stringify(e)));
        // Agar resumeBanner fail ho jaye (shayad pehli baar hi load nahi hui thi),
        // fallback ke taur pe showBanner try karo
        if (_bannerLoadedOnce) {
            try {
                console.log('[AdMob] Resume failed, falling back to fresh showBanner');
                topMargin = getBannerTopMargin();
                await window.CapAdMob.showBanner({
                    adId: AD_UNIT_BANNER,
                    adSize: 'BANNER',
                    position: 'TOP_CENTER',
                    margin: topMargin,
                    isTesting: true
                });
                _showDebugBadge('Banner: SHOWN (fallback) ✓ TOP margin:' + topMargin);
            } catch (e2) {
                console.warn('[AdMob] Fallback showBanner also failed:', e2);
                _showDebugBadge('Banner FALLBACK FAILED: ' + (e2 && e2.message ? e2.message : JSON.stringify(e2)));
            }
        }
    }
};
window.hideAdBanner = async function () {
    if (!window.CapAdMob) return;
    try {
        await window.CapAdMob.hideBanner();
        console.log('[AdMob] Banner hide call completed');
    } catch (e) {
        console.warn('[AdMob] Banner hide failed:', e);
    }
};

window.addEventListener('capacitorPluginsReady', function () {
    console.log('[Capacitor] Plugins ready event fired. CapAdMob:', !!window.CapAdMob, 'CapTTS:', !!window.CapTTS, 'CapStatusBar:', !!window.CapStatusBar);
    _setupAdMobListeners();
    // 500ms wait — StatusBar safe-area settle hone ka time (boot.js status-bar
    // fix ke setTimeout chain 100ms+150ms use karta hai). Isse gamebar-wrap
    // ki final position/height mil jaati hai jab banner ka top margin nikalte hain.
    setTimeout(function() { window.showAdBanner(); }, 500);
});

// Agar plugins already ready hain (race condition safety)
if (window.__capacitorReady) {
    _setupAdMobListeners();
    setTimeout(function() { window.showAdBanner(); }, 500);
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
            // Result card hamesha SABSE LATEST lookup ka result dikhata hai —
            // matlab scanHistory[0] hi woh entry hai jo is card se match karti hai.
            // (lastLookupBarcode use nahi karte kyunki woh sirf barcode string
            // hai, index nahi — agar same barcode kisi wajah se 2 baar history
            // mein ho to confusion ho sakta hai)
            if (typeof scanHistory !== 'undefined' && scanHistory.length > 0 && scanHistory[0].discDisplay === 'N/A') {
                openPriceCalc(calcPct, calcArticle, scanHistory[0].Barcode, 0);
            } else {
                // Fallback agar scanHistory abhi available na ho
                var currentBarcode = (typeof lastLookupBarcode !== 'undefined' && lastLookupBarcode) || calcBarcode;
                openPriceCalc(calcPct, calcArticle, currentBarcode);
            }
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

/* ═══════════════════════════════════════
   BACK BUTTON — Hardware Android back key
   Capacitor @capacitor/app plugin se handle
═══════════════════════════════════════ */
(function() {
    // Custom exit confirm overlay — browser confirm() use nahi karte
    // (WebView mein block ho sakta hai)
    function showExitConfirm() {
        var overlay = document.getElementById('exitConfirmOverlay');
        if (overlay) { overlay.style.display = 'flex'; return; }

        overlay = document.createElement('div');
        overlay.id = 'exitConfirmOverlay';
        overlay.style.cssText = [
            'position:fixed;inset:0;z-index:99999',
            'background:rgba(0,0,0,0.75);backdrop-filter:blur(6px)',
            'display:flex;align-items:center;justify-content:center'
        ].join(';');

        overlay.innerHTML = [
            '<div style="',
                'background:linear-gradient(135deg,#0d1117,#131929);',
                'border:1.5px solid rgba(0,229,255,0.25);',
                'border-radius:24px;padding:32px 28px 24px;',
                'max-width:300px;width:88%;text-align:center;',
                'box-shadow:0 0 40px rgba(0,229,255,0.1);',
            '">',
                '<div style="font-size:36px;margin-bottom:12px">👋</div>',
                '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">App band karein?</div>',
                '<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:24px">',
                    'Discount Manager se bahar ja rahe hain',
                '</div>',
                '<div style="display:flex;gap:12px">',
                    '<button id="exitCancelBtn" style="',
                        'flex:1;padding:12px;border-radius:14px;',
                        'background:rgba(255,255,255,0.06);',
                        'border:1px solid rgba(255,255,255,0.12);',
                        'color:rgba(255,255,255,0.7);font-size:14px;font-weight:700;cursor:pointer',
                    '">Ruko</button>',
                    '<button id="exitConfirmBtn" style="',
                        'flex:1;padding:12px;border-radius:14px;',
                        'background:linear-gradient(135deg,#7c4dff,#00e5ff);',
                        'border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer',
                    '">Band Karo</button>',
                '</div>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);

        document.getElementById('exitCancelBtn').onclick = function() {
            overlay.style.display = 'none';
        };
        document.getElementById('exitConfirmBtn').onclick = function() {
            // Capacitor App plugin se exit — pehle registry-checked CapApp,
            // phir direct registry, phir browser fallback
            var AppPlugin = window.CapApp || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App);
            if (AppPlugin && typeof AppPlugin.exitApp === 'function') {
                AppPlugin.exitApp();
            } else {
                window.close(); // browser fallback
            }
        };

        // Overlay tap to cancel
        overlay.onclick = function(e) {
            if (e.target === overlay) overlay.style.display = 'none';
        };
    }

    // Saare overlays check karke band karta hai agar koi khula ho.
    // Return true matlab kuch band hua (back press "consumed" ho gaya),
    // false matlab koi overlay khula nahi tha (home page pe hain).
    function closeOpenOverlayIfAny() {
        var exitOverlay = document.getElementById('exitConfirmOverlay');
        if (exitOverlay && exitOverlay.style.display !== 'none') {
            exitOverlay.style.display = 'none';
            return true;
        }
        if (document.getElementById('rewardSuccessOverlay') &&
            document.getElementById('rewardSuccessOverlay').style.display === 'flex') {
            if (typeof closeRewardSuccess === 'function') closeRewardSuccess();
            return true;
        }
        if (document.getElementById('privacyOverlay') &&
            document.getElementById('privacyOverlay').style.display === 'flex') {
            document.getElementById('privacyOverlay').style.display = 'none';
            if (typeof window.showAdBanner === 'function') window.showAdBanner();
            return true;
        }
        if (document.getElementById('termsOverlay') &&
            document.getElementById('termsOverlay').style.display === 'flex') {
            document.getElementById('termsOverlay').style.display = 'none';
            if (typeof window.showAdBanner === 'function') window.showAdBanner();
            return true;
        }
        if (document.getElementById('priceCalcOverlay') &&
            document.getElementById('priceCalcOverlay').classList.contains('open')) {
            if (typeof closePriceCalc === 'function') closePriceCalc();
            return true;
        }
        if (document.getElementById('scannerBox') &&
            document.getElementById('scannerBox').classList.contains('open')) {
            if (typeof closeScanner === 'function') closeScanner();
            return true;
        }
        return false;
    }

    // Back press hone par yahi single entry point chalta hai —
    // chahe Capacitor App plugin se aaye ya popstate fallback se.
    function handleBackPress() {
        if (closeOpenOverlayIfAny()) return;
        // Home page pe ho — exit confirm dikhao
        showExitConfirm();
    }

    // Back button intercept — Capacitor native App plugin (asal tareeqa)
    function setupBackButton() {
        // window.CapApp index.html ke bridge-detection block mein
        // registry se assign hota hai (agar native build mein
        // @capacitor/app install/sync hai). Agar yeh null/undefined
        // hai to plugin native side missing hai — console mein
        // diagnostic chhod kar fallback pe switch karte hain.
        var AppPlugin = window.CapApp || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App);

        if (typeof _showDebugBadge === 'function') {
            _showDebugBadge('App plugin: ' + (AppPlugin ? 'FOUND ✓' : 'MISSING ✗'));
        }

        if (!AppPlugin) {
            console.warn('[BackButton] Capacitor App plugin nahi mila — native hardware back intercept nahi ho payega. ' +
                'popstate fallback use ho raha hai (browser/preview mode ya plugin missing).');
            setupPopstateFallback();
            return;
        }

        console.log('[BackButton] Capacitor App plugin mila — backButton listener register ho raha hai.');
        AppPlugin.addListener('backButton', handleBackPress);
    }

    // Fallback jab native App plugin available nahi (browser preview,
    // ya native build mein @capacitor/app sync nahi hua). History mein
    // ek dummy entry push karte hain taake browser/WebView back-press
    // par turant exit hone ke bajaye humein pehle intercept mile.
    function setupPopstateFallback() {
        try { history.pushState({ dmGuard: true }, ''); } catch (e) {}
        window.addEventListener('popstate', function() {
            var overlayClosed = closeOpenOverlayIfAny();
            // Guard entry dobara push karo taake next back-press bhi intercept ho
            try { history.pushState({ dmGuard: true }, ''); } catch (e) {}
            if (!overlayClosed) showExitConfirm();
        });
    }

    // Plugin ready hone ka wait karo
    if (window.__capacitorReady) {
        setupBackButton();
    } else {
        window.addEventListener('capacitorPluginsReady', setupBackButton);
    }
})();


/* ═══════════════════════════════════════
   PUSH NOTIFICATIONS
   @capacitor/push-notifications + OneSignal REST API
═══════════════════════════════════════ */
(function() {
    var ONESIGNAL_APP_ID = 'f9e441e6-0852-4f55-82b4-066379edc977';

    function getEmployeeName() {
        try {
            var raw = localStorage.getItem('dmSession');
            if (raw) {
                var s = JSON.parse(raw);
                return s.name || s.playerId || '';
            }
        } catch(e) {}
        return '';
    }

    // OneSignal /players endpoint — API key nahi chahiye registration ke liye
    async function registerWithOneSignal(fcmToken) {
        if (!fcmToken) return;
        console.log('[Push] Registering with OneSignal...');

        var employeeName = getEmployeeName();

        var payload = {
            app_id: ONESIGNAL_APP_ID,
            device_type: 1,
            identifier: fcmToken,
            tags: {
                employee_name: employeeName || 'unknown',
                app_version: '2.1'
            }
        };

        try {
            var res = await fetch('https://onesignal.com/api/v1/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            var data = await res.json();
            if (data.id) {
                console.log('[Push] Registered! Player ID:', data.id);
                localStorage.setItem('os_player_id', data.id);
                if (!employeeName) setTimeout(updateEmployeeTag, 3000);
            } else {
                console.warn('[Push] Registration failed:', JSON.stringify(data));
            }
        } catch(e) {
            console.warn('[Push] Register error:', e);
        }
    }

    async function updateEmployeeTag() {
        var playerId = localStorage.getItem('os_player_id');
        if (!playerId) return;
        var name = getEmployeeName();
        if (!name) { setTimeout(updateEmployeeTag, 3000); return; }

        try {
            await fetch('https://onesignal.com/api/v1/players/' + playerId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    tags: { employee_name: name, app_version: '2.1' }
                })
            });
            console.log('[Push] Tag updated:', name);
        } catch(e) {
            console.warn('[Push] Tag error:', e);
        }
    }

    function initPushNotifications() {
        var PushNotifications = window.Capacitor &&
                                window.Capacitor.Plugins &&
                                window.Capacitor.Plugins.PushNotifications;

        if (!PushNotifications) {
            console.warn('[Push] Plugin nahi mila');
            return;
        }

        PushNotifications.checkPermissions().then(function(result) {
            if (result.receive === 'granted') {
                PushNotifications.register();
            } else if (result.receive !== 'denied') {
                PushNotifications.requestPermissions().then(function(res) {
                    if (res.receive === 'granted') PushNotifications.register();
                });
            }
        }).catch(function(e) {
            console.warn('[Push] Permission error:', e);
        });

        PushNotifications.addListener('registration', function(token) {
            console.log('[Push] FCM Token received');
            localStorage.setItem('fcm_token', token.value);
            registerWithOneSignal(token.value);
        });

        PushNotifications.addListener('registrationError', function(error) {
            console.warn('[Push] Registration error:', JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', function(notification) {
            console.log('[Push] Received:', notification.title);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', function(action) {
            console.log('[Push] Tapped:', action.notification.title);
            if (action.notification.data && action.notification.data.url) {
                window.open(action.notification.data.url, '_blank');
            }
        });

        console.log('[Push] Initialized');
    }

    if (window.__capacitorReady) {
        initPushNotifications();
    } else {
        window.addEventListener('capacitorPluginsReady', initPushNotifications);
        setTimeout(initPushNotifications, 3000);
    }
})();
