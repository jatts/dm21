/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
function showPage(name, btn) {
    // Close scanner if navigating away
    if (name !== 'scan') {
        const box = document.getElementById('scannerBox');
        if (box && box.classList.contains('open')) closeScanner();
    }
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById(`page-${name}`).classList.add('active');
    btn.classList.add('active');
    if (name==='stats') {
        updateStatsPage();
        // Pehle events sync karo GS pe, phir fresh leaderboard load karo
        setTimeout(function() {
            lbLoading = false; // reset stuck flag
            // Flush pending scan events first so GS has latest data, then load leaderboard
            gsFlushEvents(function() {
                lbLoad(true);
            });
        }, 100);
    }
}

// saveScanHistory, esc, renderHistory → history.js mein hain (duplicate remove kiya)


/* ═══════════════════════════════════════
   SETTINGS PERSISTENCE
   TTS toggles, continuous scan, delay — app restart pe bhi yaad rahein
═══════════════════════════════════════ */
(function() {
    // TTS toggles restore
    var tPct   = document.getElementById('togglePercentage');
    var tPrice = document.getElementById('toggleAfterPrice');
    if (tPct)   tPct.checked   = AppDB.getBool('tts_pct',   true);
    if (tPrice) tPrice.checked = AppDB.getBool('tts_price', false);
    if (tPct)   tPct.addEventListener('change',   function(){ AppDB.set('tts_pct',   this.checked); });
    if (tPrice) tPrice.addEventListener('change', function(){ AppDB.set('tts_price', this.checked); });

    // Continuous scan toggle restore
    var contToggle = document.getElementById('contScanToggle');
    if (contToggle) {
        contToggle.checked = AppDB.getBool('cont_scan', false);
    }

    // Delay select restore
    var delaySelect = document.getElementById('delaySelect');
    if (delaySelect) {
        var savedDelay = AppDB.get('scan_delay', '3');
        for (var i = 0; i < delaySelect.options.length; i++) {
            if (delaySelect.options[i].value === savedDelay) {
                delaySelect.selectedIndex = i;
                break;
            }
        }
        delaySelect.addEventListener('change', function() {
            AppDB.set('scan_delay', this.value);
        });
    }
})();
