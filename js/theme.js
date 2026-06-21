/* ═══════════════════════════════════════
   THEME (Dark / Light)
═══════════════════════════════════════ */
function setTheme(mode) {
    const html = document.documentElement;
    const wrap = document.getElementById('themeToggleWrap');
    if (mode === 'light') {
        html.classList.add('light');
        document.getElementById('themeDarkBtn').classList.remove('active');
        document.getElementById('themeLightBtn').classList.add('active');
        document.getElementById('themeDesc').textContent = 'Light Mode active hai';
        if (wrap) wrap.classList.add('is-light');
    } else {
        html.classList.remove('light');
        document.getElementById('themeDarkBtn').classList.add('active');
        document.getElementById('themeLightBtn').classList.remove('active');
        document.getElementById('themeDesc').textContent = 'Dark Mode active hai';
        if (wrap) wrap.classList.remove('is-light');
    }
    AppDB.set('theme', mode);
}

// Apply saved theme on boot
(function() {
    const saved = AppDB.get('theme', 'dark');
    if (saved === 'light') setTheme('light');
})();

/* ═══════════════════════════════════════
   RESET GAME
═══════════════════════════════════════ */
var _resetBtn = document.getElementById('settingResetGame');
if (_resetBtn) {
    _resetBtn.addEventListener('click', function() {
        var ov = document.getElementById('resetConfirmOverlay');
        if (ov) ov.style.display = 'flex';
    });
}

window.doResetGame = function() {
    var ov = document.getElementById('resetConfirmOverlay');
    if (ov) ov.style.display = 'none';
    if (window.gameBar) window.gameBar.resetGame();
    AppDB.remove('coinsEarned');
    AppDB.remove('coinsSpent');
    AppDB.remove('scanStreak');
    if (typeof updateStatsPage === 'function') updateStatsPage();
    if (typeof showToast === 'function') showToast('Game reset ho gaya', 'info');
};

window.cancelReset = function() {
    var ov = document.getElementById('resetConfirmOverlay');
    if (ov) ov.style.display = 'none';
};
