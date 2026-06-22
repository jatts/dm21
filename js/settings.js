/* ═══════════════════════════════════════
   SETTINGS PAGE
   Sirf wo IDs bind karo jo HTML mein hain
═══════════════════════════════════════ */

// Privacy Policy overlay
var _privRow = document.getElementById('privacyPolicyRow');
if (_privRow) _privRow.addEventListener('click', function() {
    var o = document.getElementById('privacyOverlay');
    if (o) o.style.display = 'flex';
    // Banner hide karo taake overlay upar saaf dikhe
    if (typeof window.hideAdBanner === 'function') window.hideAdBanner();
});
var _privBack = document.getElementById('privacyBackBtn');
if (_privBack) _privBack.addEventListener('click', function() {
    var o = document.getElementById('privacyOverlay');
    if (o) o.style.display = 'none';
    // Banner wapis show karo
    if (typeof window.showAdBanner === 'function') window.showAdBanner();
});

// Terms overlay
var _termsRow = document.getElementById('termsRow');
if (_termsRow) _termsRow.addEventListener('click', function() {
    var o = document.getElementById('termsOverlay');
    if (o) o.style.display = 'flex';
    if (typeof window.hideAdBanner === 'function') window.hideAdBanner();
});
var _termsBack = document.getElementById('termsBackBtn');
if (_termsBack) _termsBack.addEventListener('click', function() {
    var o = document.getElementById('termsOverlay');
    if (o) o.style.display = 'none';
    if (typeof window.showAdBanner === 'function') window.showAdBanner();
});

// Watch Ad button
var _watchAdBtn = document.getElementById('settingWatchAd');
if (_watchAdBtn) _watchAdBtn.addEventListener('click', function() {
    if (window.gameBar && typeof window.gameBar.watchAd === 'function') {
        window.gameBar.watchAd();
    }
});

/* ═══════════════════════════════════════
   APP VERSION INFO
═══════════════════════════════════════ */
(function() {
    var verEl = document.getElementById('appVersionText');
    if (verEl) verEl.textContent = 'v2.0.0';
})();
