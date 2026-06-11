/* ═══════════════════════════════════════
   ANTI-CHEAT
   Layer 1: Same barcode cooldown (60s)
   Layer 3: Last-10 dedup window (no coin deduct)
═══════════════════════════════════════ */
const COOLDOWN_MS   = 60000; // 60 seconds
const DEDUP_WINDOW  = 10;    // last N barcodes
const scanCooldowns = {};    // { barcode: timestamp }
const recentCodes   = [];    // rolling last-10 array

function antiCheatCheck(barcode) {
    const now = Date.now();
    let deductCoin = true;

    // Layer 1: same barcode within 60s → show result, no coin deduct
    if (scanCooldowns[barcode]) {
        const elapsed = now - scanCooldowns[barcode];
        if (elapsed < COOLDOWN_MS) {
            deductCoin = false;
        }
    }

    // Layer 3: in recent-10 window → no coin deduct
    if (recentCodes.includes(barcode)) {
        deductCoin = false;
    }

    // Update cooldown + recent list always
    scanCooldowns[barcode] = now;
    const idx = recentCodes.indexOf(barcode);
    if (idx !== -1) recentCodes.splice(idx, 1);
    recentCodes.unshift(barcode);
    if (recentCodes.length > DEDUP_WINDOW) recentCodes.pop();

    return { allow: true, deductCoin };
}

/* ═══════════════════════════════════════
   CORE LOOKUP
═══════════════════════════════════════ */
function lookupBarcode(rawInput, searchMode) {
    const v = validateInput(rawInput);
    if (!v.ok) { showToast(v.msg, 'error'); return; }
    if (!db)   { showToast('Database load nahi hua', 'error'); return; }

    // Anti-cheat check
    const ac = antiCheatCheck(v.val);
    if (!ac.allow) return;

    // Coin check only if we're going to deduct
    if (ac.deductCoin && !window.gameBar.checkCoins()) return;

    const rows = queryDB(
        'SELECT Barcode, Article, Percentage, OriginalPrice FROM sc WHERE Barcode = ? LIMIT 1',
        [v.val]
    );

    if (!rows.length) {
        // Toast
        showToast('Barcode not found', 'warn');

        // Voice — cancel any running TTS then speak
        speechSynthesis.cancel();
        ttsQueue.length = 0;
        ttsBusy = false;
        tts('Not found', 'en-US');

        // Clear cards — reset to blank dashes
        document.getElementById('percentageValue').textContent = '--';
        document.getElementById('afterPriceValue').textContent = '--';
        const calcHint = document.getElementById('calcHint');
        const apCard   = document.getElementById('afterPriceCard');
        if (calcHint) calcHint.style.display = 'none';
        if (apCard)   apCard.style.cursor = 'default';
        return;
    }

    // Deduct coin only when allowed
    if (ac.deductCoin) {
        if (searchMode) {
            // Search mode: sirf coin minus, totalScans nahi badhega
            window.gameBar.deductCoinOnly();
        } else {
            window.gameBar.deductCoin();
        }
    } else {
        showToast('(i) Result (no coin deducted)', 'info', 1800);
    }

    const r   = rows[0];
    const pN  = parseFloat(r.Percentage);
    const opN = parseFloat(r.OriginalPrice);

    // hasPct: percentage is a valid non-zero number
    const hasPct   = !isNaN(pN) && isFinite(pN);
    // hasPrice: OriginalPrice exists, non-empty, non-zero valid number
    const rawPrice = String(r.OriginalPrice ?? '').trim();
    const hasPrice = rawPrice !== '' && rawPrice !== '0' && !isNaN(opN) && isFinite(opN) && opN > 0;

    const ok   = hasPct && hasPrice;
    const disc = ok ? Math.floor(opN*(1-pN/100)) : null;

    const pctDisplay  = hasPct  ? `${Math.floor(pN)}%`        : (r.Percentage   || 'N/A');
    const origDisplay = hasPrice ? `${Math.floor(opN)}`        : 'N/A';
    const discDisplay = ok       ? `${disc}`                   : 'N/A';

    document.getElementById('percentageValue').textContent = pctDisplay;
    document.getElementById('afterPriceValue').textContent = discDisplay;

    // Show/hide "Tap to enter price" hint on afterp card
    const calcHint   = document.getElementById('calcHint');
    const afterCard  = document.getElementById('afterPriceCard');
    if (hasPct && !hasPrice) {
        calcHint.style.display  = 'block';
        afterCard.style.cursor  = 'pointer';
    } else {
        calcHint.style.display  = 'none';
        afterCard.style.cursor  = 'default';
    }

    // ── If pct found but price missing → open calculator ──
    if (hasPct && !hasPrice) {
        openPriceCalc(pN, r.Article || r.Barcode);
    }

    // ── TTS: fixed order — pct first, then price (queued, no overlap) ──
    const speakPct   = (document.getElementById('togglePercentage') || {}).checked;
    const speakPrice = (document.getElementById('toggleAfterPrice') || {}).checked;
    ttsQueue.length = 0;
    speechSynthesis.cancel();
    ttsBusy = false;
    if (speakPct   && pctDisplay  !== 'N/A') tts(pctDisplay);
    if (speakPrice && discDisplay !== 'N/A') tts(discDisplay);

    const entry = {
        Barcode:r.Barcode, Article:r.Article||'N/A',
        pctDisplay, origDisplay, discDisplay,
        pct:pN||0, savings:ok?(opN-disc):0, ts:Date.now()
    };
    scanHistory.unshift(entry);
    saveScanHistory();
    renderHistory();

    document.getElementById('barcodeInput').value = '';
    document.getElementById('adPrompt').style.display = 'none';
}

/* ═══════════════════════════════════════
   BUTTONS
═══════════════════════════════════════ */
// Scan button - handled by scanner script above

// FAB button - handled by scanner script above

document.getElementById('clearHistoryBtn').addEventListener('click', ()=>{
    if (!scanHistory.length) return;
    var ov = document.getElementById('clearHistoryOverlay');
    if (ov) ov.style.display = 'flex';
});

window.doClearHistory = function() {
    var ov = document.getElementById('clearHistoryOverlay');
    if (ov) ov.style.display = 'none';
    scanHistory=[]; saveScanHistory(); renderHistory();
    showToast('History clear ho gayi', 'info');
};

window.cancelClearHistory = function() {
    var ov = document.getElementById('clearHistoryOverlay');
    if (ov) ov.style.display = 'none';
};

/* ═══════════════════════════════════════
   AD / COINS
═══════════════════════════════════════ */
function watchAd() {
    if (window.AppInventor) window.AppInventor.setWebViewString('show_ad');
    else window.gameBar.refillCoins();
}
document.getElementById('watchAdBtn').addEventListener('click', watchAd);
document.getElementById('settingWatchAd').addEventListener('click', watchAd);

