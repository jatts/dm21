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
var lastLookupBarcode = ''; // current screen pe jo barcode result dikha raha hai

function lookupBarcode(rawInput, searchMode) {
    const v = validateInput(rawInput);
    if (!v.ok) { showToast(v.msg, 'error'); return; }
    if (!db)   { showToast('Database load nahi hua', 'error'); return; }

    // Anti-cheat check
    const ac = antiCheatCheck(v.val);
    if (!ac.allow) return;

    lastLookupBarcode = v.val; // taake "Tap to enter price" baad mein bhi sahi barcode jaane

    // Coin check only if we're going to deduct
    if (ac.deductCoin && !window.gameBar.checkCoins()) return;

    const rows = queryDB(
        'SELECT Barcode, Article, Percentage, OriginalPrice FROM sc WHERE Barcode = ? LIMIT 1',
        [v.val]
    );

    if (!rows.length) {
        // Toast
        showToast('Barcode not found: ' + v.val, 'warn');

        // TTS
        ttsQueue.length = 0;
        if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
        ttsBusy = false;
        tts('Not found', 'en-US');

        // Clear cards
        document.getElementById('percentageValue').textContent = '--';
        document.getElementById('afterPriceValue').textContent = '--';
        var calcHint2 = document.getElementById('calcHint');
        var apCard2   = document.getElementById('afterPriceCard');
        if (calcHint2) calcHint2.style.display = 'none';
        if (apCard2)   apCard2.style.cursor = 'default';

        // IMPORTANT: Scanner loop rok do - not found pe bhi scanner close karo
        if (typeof closeScanner === 'function') closeScanner();

        // History mein not-found bhi add karo (optional - agar chahiye)
        // Abhi skip karte hain

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

    // Count-up animation for result cards
    animateValue('percentageValue', pctDisplay);
    animateValue('afterPriceValue', discDisplay);

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

    // ── TTS: fixed order — pct first, then price (queued, no overlap) ──
    const speakPct   = (document.getElementById('togglePercentage') || {}).checked;
    const speakPrice = (document.getElementById('toggleAfterPrice') || {}).checked;
    ttsQueue.length = 0;
    if (typeof speechSynthesis !== 'undefined') {
        try { speechSynthesis.cancel(); } catch(e) {}
    }
    ttsBusy = false;
    if (speakPct   && pctDisplay  !== 'N/A') tts(pctDisplay, 'en-US');
    if (speakPrice && discDisplay !== 'N/A') tts(discDisplay, 'en-US');

    // IMPORTANT: History entry pehle add karo, calculator khulne se PEHLE —
    // taake calcEnter() (calculator.js) jab price update kare to scanHistory[0]
    // hamesha sahi (abhi-abhi banayi gayi) entry ho, purani ya missing na ho
    const entry = {
        Barcode:r.Barcode, Article:r.Article||'N/A',
        pctDisplay, origDisplay, discDisplay,
        pct:pN||0, savings:ok?(opN-disc):0, ts:Date.now()
    };
    try {
        scanHistory.unshift(entry);
        saveScanHistory();
        renderHistory();
    } catch (e) {
        console.warn('History save error:', e);
    }

    // ── If pct found but price missing → open calculator (history entry already added above) ──
    if (hasPct && !hasPrice) {
        openPriceCalc(pN, r.Article || r.Barcode, r.Barcode, 0);
    }

    document.getElementById('barcodeInput').value = '';
    document.getElementById('adPrompt').style.display = 'none';
    updateAdPromptState();
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
    // CapacitorJS AdMob (primary) — boot.js mein defined
    if (typeof window.showRewardedAd === 'function' && window.CapAdMob) {
        window.showRewardedAd();
    }
    // AI2 App Inventor (fallback)
    else if (window.AppInventor) {
        window.AppInventor.setWebViewString('show_ad');
    }
    // Direct refill agar koi ad network nahi (testing / browser mode)
    else {
        showToast && showToast('Test mode: Ad system available nahi, coins seedhe mil rahe hain', 'info');
        window.gameBar && window.gameBar.refillCoins();
    }
}
document.getElementById('watchAdBtn').addEventListener('click', watchAd);
document.getElementById('settingWatchAd').addEventListener('click', watchAd);

// Coin block pe tap karke bhi kabhi bhi ad dekh sako (sirf coins=0 hone ka wait nahi karna)
// Max-coins check refillCoins() ke andar already hai
var _coinBlockTap = document.getElementById('coinBlockTap');
if (_coinBlockTap) {
    _coinBlockTap.addEventListener('click', watchAd);
}
