/* ═══════════════════════════════════════
   STATUS BAR FIX — SmartWebView
   SmartWebView mein env(safe-area-inset-top) kaam nahi karta
   JS se gamebar ki height adjust karo
═══════════════════════════════════════ */
(function() {
    function applyStatusBarPadding(px) {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        px = Math.max(0, Math.min(px, 80)); // 0-80px range
        gb.style.paddingTop = px + 'px';
        gb.style.height = (58 + px) + 'px';
    }

    // Method 1: SmartWebView Java se statusBarHeight milti hai
    // Java: webView.evaluateJavascript("setStatusBarHeight(" + statusBarHeight + ")", null)
    window.setStatusBarHeight = function(px) {
        applyStatusBarPadding(parseInt(px) || 0);
    };

    // Method 2: AndroidInterface se try karo
    if (window.AndroidInterface && typeof window.AndroidInterface.getStatusBarHeight === 'function') {
        var h = parseInt(window.AndroidInterface.getStatusBarHeight()) || 0;
        if (h > 0) { applyStatusBarPadding(h); return; }
    }

    // Method 3: Fallback — window.screen vs window.innerHeight difference
    // Status bar height = screen height - available height
    setTimeout(function() {
        var gb = document.getElementById('gamebar-wrap');
        if (!gb) return;
        // Agar gamebar top position > 0 hai to gap hai
        var rect = gb.getBoundingClientRect();
        if (rect.top > 2) {
            applyStatusBarPadding(Math.round(rect.top));
        }
    }, 100);
})();

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

// IMPORTANT: window.AdMob = {} mat karo — AdMobPlugin.java
// onPageFinished pe apna AdMob object inject karta hai
// Hum sirf reward callback define karte hain
// AdMobPlugin inject hone ke BAAD

function _setupAdMobReward() {
    if (window.AdMob) {
        // AdMob already inject ho gaya — reward callback set karo
        window.AdMob.onUserEarnedReward = function(reward) {
            if (window.gameBar) window.gameBar.refillCoins();
        };
        return true;
    }
    return false;
}

window.addEventListener('load', function() {
    // AdMob inject hone ka wait karo (page load ke baad hota hai)
    var attempts = 0;
    var adSetupInterval = setInterval(function() {
        attempts++;
        if (_setupAdMobReward() || attempts >= 20) {
            clearInterval(adSetupInterval);
            // Banner bhi show karo jab ready ho
            if (window.AdMob && typeof window.AdMob.showBanner === 'function') {
                window.AdMob.showBanner();
            }
        }
    }, 500); // har 500ms check karo, max 10 seconds
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
