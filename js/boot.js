/* ═══════════════════════════════════════
   STATUS BAR FIX — CapacitorJS
═══════════════════════════════════════ */
(function() {
    var BANNER_HEIGHT_PX = 60;
    var _bannerPaddingApplied = false;

    function applyStatusBarPadding(px) {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        px = Math.max(0, Math.min(px, 120));
        var extraPad = _bannerPaddingApplied ? BANNER_HEIGHT_PX : 0;
        gb.style.paddingTop = (px + extraPad) + 'px';
        gb.style.minHeight = (58 + px + extraPad) + 'px';
        gb.style.height = 'auto';
        gb.dataset.statusBarPx = px;
    }

    window._applyBannerPaddingToGamebar = function(bannerH) {
        if (_bannerPaddingApplied) { console.log('[Banner] Padding already applied, skipping'); return; }
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        bannerH = bannerH || BANNER_HEIGHT_PX;
        BANNER_HEIGHT_PX = bannerH;
        _bannerPaddingApplied = true;
        var currentPad = parseFloat(window.getComputedStyle(gb).paddingTop) || 0;
        gb.style.paddingTop = (currentPad + bannerH) + 'px';
        gb.style.minHeight = (parseFloat(gb.style.minHeight) || 58) + bannerH + 'px';
        console.log('[Banner] Gamebar pushed down by', bannerH, 'px');
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
            await window.CapStatusBar.setOverlaysWebView({ overlay: false });
            try { await window.CapStatusBar.setStyle({ style: 'DARK' }); } catch(e) {}
            setTimeout(function() {
                applySafeArea();
                setTimeout(function() {
                    var gb = document.getElementById('gamebar-wrap');
                    if (!gb) return;
                    var rect = gb.getBoundingClientRect();
                    if (rect.top < 4) applyStatusBarPadding(36);
                }, 150);
            }, 100);
            return true;
        } catch (e) {
            console.warn('StatusBar setOverlaysWebView failed:', e);
            return false;
        }
    }

    if (!trySetupStatusBar()) {
        window.addEventListener('capacitorPluginsReady', trySetupStatusBar);
    }
    applySafeArea();
    setTimeout(function() {
        if (window.CapStatusBar) return;
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        if (gb.getBoundingClientRect().top < 4) applyStatusBarPadding(36);
    }, 500);

    window.setStatusBarHeight = function(px) {
        applyStatusBarPadding(parseInt(px) || 0);
        var ph = document.getElementById('privacyHeader');
        var th = document.getElementById('termsHeader');
        var safePx = Math.max(0, Math.min(parseInt(px) || 0, 80));
        if (ph) ph.style.paddingTop = (16 + safePx) + 'px';
        if (th) th.style.paddingTop = (16 + safePx) + 'px';
    };
})();

/* ═══════════════════════════════════════
   AI2 BRIDGE
═══════════════════════════════════════ */
window.refillCoins = () => window.gameBar && window.gameBar.refillCoins();
window.setBarcode  = bc => lookupBarcode(bc);

/* ═══════════════════════════════════════
   CAPACITOR ADMOB BRIDGE
═══════════════════════════════════════ */
function _onRewardEarned() {
    if (window.gameBar) window.gameBar.refillCoins();
}

var AD_UNIT_REWARDED = 'ca-app-pub-3940256099942544/5224354917';
var AD_UNIT_BANNER    = 'ca-app-pub-3940256099942544/6300978111';
var _rewardListenersAttached = false;

function _setupAdMobListeners() {
    if (!window.CapAdMob || _rewardListenersAttached) return false;
    var AdMob = window.CapAdMob;
    try {
        AdMob.addListener('onRewardedVideoAdReward', function(reward) { console.log('[AdMob] Reward:', reward); _onRewardEarned(); });
        AdMob.addListener('onRewardedVideoAdLoaded', function() { console.log('[AdMob] Rewarded loaded'); });
        AdMob.addListener('onRewardedVideoAdFailedToLoad', function(err) { console.warn('[AdMob] Failed to load:', JSON.stringify(err)); showToast && showToast('Ad load fail: ' + (err && err.message ? err.message : JSON.stringify(err)), 'error', 4000); });
        AdMob.addListener('onRewardedVideoAdFailedToShow', function(err) { console.warn('[AdMob] Failed to show:', JSON.stringify(err)); showToast && showToast('Ad show fail: ' + (err && err.message ? err.message : JSON.stringify(err)), 'error', 4000); });
        _rewardListenersAttached = true;
        return true;
    } catch(e) {
        console.warn('[AdMob] Listener setup failed:', e);
        return false;
    }
}

window.showRewardedAd = async function() {
    if (!window.CapAdMob) {
        var reason = !window.Capacitor ? 'Capacitor bridge load nahi hua' : (!window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) ? 'App browser mein khuli hai' : 'AdMob native plugin APK mein nahi';
        showToast && showToast('Ad system ready nahi: ' + reason, 'error', 4000);
        return;
    }
    _setupAdMobListeners();
    try {
        showToast && showToast('Ad load ho rahi hai...', 'info', 1500);
        await window.CapAdMob.prepareRewardVideoAd({ adId: AD_UNIT_REWARDED, isTesting: true });
        await window.CapAdMob.showRewardVideoAd();
    } catch(e) {
        console.warn('[AdMob] Rewarded ad failed:', e);
        showToast && showToast('Ad error: ' + (e && e.message ? e.message : JSON.stringify(e)), 'error', 5000);
    }
};

var _bannerLoadedOnce = false;

function getBannerTopMargin() {
    var sbHeight = 0;
    try {
        var gb = document.getElementById('gamebar-wrap');
        if (gb) {
            var pt = window.getComputedStyle(gb).paddingTop;
            sbHeight = Math.round(parseFloat(pt) || 0);
        }
        if (!sbHeight) sbHeight = 24;
    } catch(e) { sbHeight = 24; }
    return sbHeight;
}

function _showDebugBadge(text) { /* debug disabled */ }

window.showAdBanner = async function() {
    if (!window.CapAdMob) { console.warn('[AdMob] showAdBanner: CapAdMob not available'); return; }
    if (window.__admobInitPromise) {
        try { await window.__admobInitPromise; } catch(e) { console.warn('[AdMob] init wait failed:', e); }
    }
    var topMargin = getBannerTopMargin();
    try {
        if (_bannerLoadedOnce && typeof window.CapAdMob.resumeBanner === 'function') {
            await window.CapAdMob.resumeBanner();
        } else {
            await window.CapAdMob.showBanner({ adId: AD_UNIT_BANNER, adSize: 'BANNER', position: 'TOP_CENTER', margin: topMargin, isTesting: true });
            _bannerLoadedOnce = true;
        }
        if (typeof window._applyBannerPaddingToGamebar === 'function') window._applyBannerPaddingToGamebar(60);
    } catch(e) {
        console.warn('[AdMob] Banner failed:', e);
        if (_bannerLoadedOnce) {
            try {
                topMargin = getBannerTopMargin();
                await window.CapAdMob.showBanner({ adId: AD_UNIT_BANNER, adSize: 'BANNER', position: 'TOP_CENTER', margin: topMargin, isTesting: true });
            } catch(e2) { console.warn('[AdMob] Fallback failed:', e2); }
        }
    }
};

window.hideAdBanner = async function() {
    if (!window.CapAdMob) return;
    try { await window.CapAdMob.hideBanner(); } catch(e) { console.warn('[AdMob] Banner hide failed:', e); }
};

window.addEventListener('capacitorPluginsReady', function() {
    _setupAdMobListeners();
    setTimeout(function() { window.showAdBanner(); }, 500);
});
if (window.__capacitorReady) {
    _setupAdMobListeners();
    setTimeout(function() { window.showAdBanner(); }, 500);
}

/* ═══════════════════════════════════════
   BOOT
═══════════════════════════════════════ */
updateGameBar();
renderHistory();
if (typeof gsGetSession === 'function' && gsGetSession()) { initDatabase(); }

const _apCard = document.getElementById('afterPriceCard');
if (_apCard) {
    _apCard.addEventListener('click', function(e) {
        if (e.target.closest('label')) return;
        const hint = document.getElementById('calcHint');
        if (hint && hint.style.display !== 'none' && calcPct > 0) {
            if (typeof scanHistory !== 'undefined' && scanHistory.length > 0 && scanHistory[0].discDisplay === 'N/A') {
                openPriceCalc(calcPct, calcArticle, scanHistory[0].Barcode, 0);
            } else {
                var currentBarcode = (typeof lastLookupBarcode !== 'undefined' && lastLookupBarcode) || calcBarcode;
                openPriceCalc(calcPct, calcArticle, currentBarcode);
            }
        }
    });
}

window.addEventListener('pagehide', function() { if (typeof gsFlushEvents === 'function') gsFlushEvents(null); });
window.addEventListener('beforeunload', function() { if (typeof gsFlushEvents === 'function') gsFlushEvents(null); });
setTimeout(function() { if (typeof gsGetSession === 'function' && gsGetSession()) { if (typeof gsFlushEvents === 'function') gsFlushEvents(null); } }, 4000);

/* ═══════════════════════════════════════
   BACK BUTTON
═══════════════════════════════════════ */
(function() {
    function showExitConfirm() {
        var overlay = document.getElementById('exitConfirmOverlay');
        if (overlay) { overlay.style.display = 'flex'; return; }
        overlay = document.createElement('div');
        overlay.id = 'exitConfirmOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center';
        overlay.innerHTML = '<div style="background:linear-gradient(135deg,#0d1117,#131929);border:1.5px solid rgba(0,229,255,0.25);border-radius:24px;padding:32px 28px 24px;max-width:300px;width:88%;text-align:center;box-shadow:0 0 40px rgba(0,229,255,0.1);"><div style="font-size:36px;margin-bottom:12px">👋</div><div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">App band karein?</div><div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:24px">Discount Manager se bahar ja rahe hain</div><div style="display:flex;gap:12px"><button id="exitCancelBtn" style="flex:1;padding:12px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);font-size:14px;font-weight:700;cursor:pointer">Ruko</button><button id="exitConfirmBtn" style="flex:1;padding:12px;border-radius:14px;background:linear-gradient(135deg,#7c4dff,#00e5ff);border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer">Band Karo</button></div></div>';
        document.body.appendChild(overlay);
        document.getElementById('exitCancelBtn').onclick = function() { overlay.style.display = 'none'; };
        document.getElementById('exitConfirmBtn').onclick = function() {
            var AppPlugin = window.CapApp || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App);
            if (AppPlugin && typeof AppPlugin.exitApp === 'function') { AppPlugin.exitApp(); } else { window.close(); }
        };
        overlay.onclick = function(e) { if (e.target === overlay) overlay.style.display = 'none'; };
    }

    function closeOpenOverlayIfAny() {
        var exitOverlay = document.getElementById('exitConfirmOverlay');
        if (exitOverlay && exitOverlay.style.display !== 'none') { exitOverlay.style.display = 'none'; return true; }
        if (document.getElementById('rewardSuccessOverlay') && document.getElementById('rewardSuccessOverlay').style.display === 'flex') { if (typeof closeRewardSuccess === 'function') closeRewardSuccess(); return true; }
        if (document.getElementById('privacyOverlay') && document.getElementById('privacyOverlay').style.display === 'flex') { document.getElementById('privacyOverlay').style.display = 'none'; if (typeof window.showAdBanner === 'function') window.showAdBanner(); return true; }
        if (document.getElementById('termsOverlay') && document.getElementById('termsOverlay').style.display === 'flex') { document.getElementById('termsOverlay').style.display = 'none'; if (typeof window.showAdBanner === 'function') window.showAdBanner(); return true; }
        if (document.getElementById('priceCalcOverlay') && document.getElementById('priceCalcOverlay').classList.contains('open')) { if (typeof closePriceCalc === 'function') closePriceCalc(); return true; }
        if (document.getElementById('scannerBox') && document.getElementById('scannerBox').classList.contains('open')) { if (typeof closeScanner === 'function') closeScanner(); return true; }
        return false;
    }

    function handleBackPress() { if (closeOpenOverlayIfAny()) return; showExitConfirm(); }

    function setupBackButton() {
        var AppPlugin = window.CapApp || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App);
        if (!AppPlugin) { setupPopstateFallback(); return; }
        AppPlugin.addListener('backButton', handleBackPress);
    }

    function setupPopstateFallback() {
        try { history.pushState({ dmGuard: true }, ''); } catch(e) {}
        window.addEventListener('popstate', function() {
            var overlayClosed = closeOpenOverlayIfAny();
            try { history.pushState({ dmGuard: true }, ''); } catch(e) {}
            if (!overlayClosed) showExitConfirm();
        });
    }

    if (window.__capacitorReady) { setupBackButton(); }
    else { window.addEventListener('capacitorPluginsReady', setupBackButton); }
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
            if (raw) { var s = JSON.parse(raw); return s.name || s.playerId || ''; }
        } catch(e) {}
        return '';
    }

    async function registerWithOneSignal(fcmToken) {
        if (!fcmToken) return;
        var employeeName = getEmployeeName();
        var payload = {
            app_id: ONESIGNAL_APP_ID,
            device_type: 1,
            identifier: fcmToken,
            tags: { employee_name: employeeName || 'unknown', app_version: '2.1' }
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
            }
        } catch(e) { console.warn('[Push] Register error:', e); }
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
                body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, tags: { employee_name: name, app_version: '2.1' } })
            });
        } catch(e) { console.warn('[Push] Tag error:', e); }
    }

    // In-app notification banner (foreground)
    function showPushBanner(title, body) {
        var old = document.getElementById('_pushBanner');
        if (old) old.remove();
        var banner = document.createElement('div');
        banner.id = '_pushBanner';
        var gb = document.getElementById('gamebar-wrap');
        var topPos = gb ? (gb.getBoundingClientRect().bottom + 8) : 80;
        banner.style.cssText = 'position:fixed;top:' + topPos + 'px;left:12px;right:12px;z-index:999999;background:#1e293b;border:1px solid #6366f1;border-radius:14px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,0.5);cursor:pointer';
        banner.innerHTML = '<div style="display:flex;align-items:flex-start;gap:10px"><span style="font-size:20px">🔔</span><div style="flex:1"><div style="font-weight:700;color:#f1f5f9;font-size:14px;margin-bottom:3px">' + (title||'') + '</div><div style="color:#94a3b8;font-size:13px">' + (body||'') + '</div></div><button onclick="document.getElementById(\'_pushBanner\').remove()" style="background:none;border:none;color:#475569;font-size:18px;cursor:pointer;padding:0">×</button></div>';
        document.body.appendChild(banner);
        setTimeout(function() { if (banner.parentNode) banner.remove(); }, 6000);
        banner.onclick = function() { banner.remove(); };
    }

    function initPushNotifications() {
        var Push = window.CapPush ||
                   (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications);

        if (!Push) { console.warn('[Push] Plugin nahi mila'); return; }

        Push.checkPermissions().then(function(result) {
            console.log('[Push] Permission status:', result.receive);
            if (result.receive === 'granted') {
                Push.register();
            } else if (result.receive !== 'denied') {
                Push.requestPermissions().then(function(res) {
                    if (res.receive === 'granted') Push.register();
                });
            }
        }).catch(function(e) { console.warn('[Push] Permission error:', e); });

        Push.addListener('registration', function(token) {
            console.log('[Push] FCM Token received ✅');
            localStorage.setItem('fcm_token', token.value);
            registerWithOneSignal(token.value);
        });

        Push.addListener('registrationError', function(error) {
            console.warn('[Push] Registration error:', JSON.stringify(error));
        });

        Push.addListener('pushNotificationReceived', function(notification) {
            console.log('[Push] Foreground notification:', notification.title);
            showPushBanner(notification.title, notification.body || '');
        });

        Push.addListener('pushNotificationActionPerformed', function(action) {
            console.log('[Push] Tapped:', action.notification.title);
            if (action.notification.data && action.notification.data.url) {
                window.open(action.notification.data.url, '_blank');
            }
        });

        console.log('[Push] Initialized ✅');
    }

    if (window.__capacitorReady) {
        setTimeout(initPushNotifications, 1000);
    } else {
        window.addEventListener('capacitorPluginsReady', function() {
            setTimeout(initPushNotifications, 1000);
        });
        setTimeout(initPushNotifications, 6000);
    }
})();