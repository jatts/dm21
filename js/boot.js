/* ═══════════════════════════════════════
   AI2 BRIDGE
   App Inventor WebView ke liye functions
═══════════════════════════════════════ */
window.refillCoins = () => window.gameBar && window.gameBar.refillCoins();
window.setBarcode  = bc => lookupBarcode(bc);

/* ═══════════════════════════════════════
   SMARTWEBVIEW ADMOB BRIDGE
   SmartWebView ke AdMob plugin se connect
═══════════════════════════════════════ */

// onUserEarnedReward pehle se define karo
// AdMobPlugin.java ye call karta hai reward milne pe
window.AdMob = window.AdMob || {};
window.AdMob.onUserEarnedReward = function(reward) {
    if (window.gameBar) window.gameBar.refillCoins();
};

window.addEventListener('load', function() {
    // Banner auto show 2s baad
    setTimeout(function() {
        if (window.AdMob && typeof window.AdMob.showBanner === 'function') {
            window.AdMob.showBanner();
        }
    }, 2000);

    // Safety: 3s baad bhi set karo (AdMob inject hone ke baad)
    setTimeout(function() {
        window.AdMob = window.AdMob || {};
        window.AdMob.onUserEarnedReward = function(reward) {
            if (window.gameBar) window.gameBar.refillCoins();
        };
    }, 3000);
});

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
