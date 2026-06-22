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

// Apply saved theme on boot — default LIGHT (user manually dark kar sakta hai)
(function() {
    const saved = AppDB.get('theme', 'light');
    if (saved === 'light') setTheme('light');
})();
