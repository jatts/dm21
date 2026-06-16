/* ═══════════════════════════════════════
   SETTINGS PAGE
   Sirf wo IDs bind karo jo HTML mein hain
═══════════════════════════════════════ */

// Privacy Policy overlay
var _privRow = document.getElementById('privacyPolicyRow');
if (_privRow) _privRow.addEventListener('click', function() {
    var o = document.getElementById('privacyOverlay');
    if (o) o.style.display = 'flex';
});
var _privBack = document.getElementById('privacyBackBtn');
if (_privBack) _privBack.addEventListener('click', function() {
    var o = document.getElementById('privacyOverlay');
    if (o) o.style.display = 'none';
});

// Terms overlay
var _termsRow = document.getElementById('termsRow');
if (_termsRow) _termsRow.addEventListener('click', function() {
    var o = document.getElementById('termsOverlay');
    if (o) o.style.display = 'flex';
});
var _termsBack = document.getElementById('termsBackBtn');
if (_termsBack) _termsBack.addEventListener('click', function() {
    var o = document.getElementById('termsOverlay');
    if (o) o.style.display = 'none';
});

// Watch Ad button
var _watchAdBtn = document.getElementById('settingWatchAd');
if (_watchAdBtn) _watchAdBtn.addEventListener('click', function() {
    if (window.gameBar && typeof window.gameBar.watchAd === 'function') {
        window.gameBar.watchAd();
    }
});

// Logout handler sync.js mein hai (gsFlushEvents ke saath)
// Yahan sirf settingLoggedInAs label update karte hain
var _session = (typeof gsGetSession === 'function') ? gsGetSession() : null;
if (_session) {
    var _loggedEl = document.getElementById('settingLoggedInAs');
    if (_loggedEl) _loggedEl.textContent = (_session.name || '') + '  (' + (_session.playerId || '') + ')';
}

/* ═══════════════════════════════════════
   APP VERSION INFO
═══════════════════════════════════════ */
(function() {
    var verEl = document.getElementById('appVersionText');
    if (verEl) verEl.textContent = 'v2.1.0';
})();
