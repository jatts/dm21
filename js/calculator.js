/* ═══════════════════════════════════════
   PRICE CALCULATOR
   Opens when pct found but price missing
═══════════════════════════════════════ */
let calcPct        = 0;
let calcArticle    = '';
let calcVal        = '';
let calcBarcode    = ''; // exact barcode jiske liye calculator khula hai — history match ke liye
let calcHistoryIdx = -1; // exact history array index (jab available ho) — sabse precise match

function openPriceCalc(pct, article, barcode, historyIdx) {
    // System keyboard band karo agar koi field focused hai —
    // calculator apna numpad use karta hai, system keyboard nahi chahiye
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }
    calcPct        = pct;
    calcArticle    = article;
    calcVal        = '';
    calcBarcode    = barcode || '';
    calcHistoryIdx = (typeof historyIdx === 'number') ? historyIdx : -1;
    document.getElementById('calcDisplay').value        = '';
    document.getElementById('calcPctBadge').textContent = `${Math.floor(pct)}%`;
    var _ov = document.getElementById('priceCalcOverlay');
    _ov.style.display = 'flex';
    _ov.classList.add('open');
    // Capacitor AdMob banner hide karo taake calculator upar rahe
    if (typeof window.hideAdBanner === 'function') window.hideAdBanner();
}

function closePriceCalc() {
    var _ov2 = document.getElementById('priceCalcOverlay');
    _ov2.style.display = 'none';
    _ov2.classList.remove('open');
    // Reset karo taake agla lookup confuse na ho "calculator already open" check mein
    calcBarcode    = '';
    calcHistoryIdx = -1;
    // Banner wapis show karo
    if (typeof window.showAdBanner === 'function') window.showAdBanner();
}

function calcUpdateDisplay() {
    const el  = document.getElementById('calcDisplay');
    el.value  = calcVal || '';
}

function calcEnter() {
    if (!calcVal) return;
    const price = parseFloat(calcVal);
    if (isNaN(price) || price <= 0) { showToast('Valid price likhein', 'error'); return; }

    try {
        const disc  = Math.floor(price * (1 - calcPct/100));
        const saved = Math.floor(price - disc);

        // Update result cards
        document.getElementById('afterPriceValue').textContent = `${disc}`;

        // TTS
        const speakPct   = document.getElementById('togglePercentage').checked;
        const speakPrice = document.getElementById('toggleAfterPrice').checked;
        ttsQueue.length = 0; speechSynthesis.cancel(); ttsBusy = false;
        if (speakPct)   tts(`${Math.floor(calcPct)}%`);
        if (speakPrice) tts(`${disc}`);

        // Update history entry — teen-level matching, sab se precise se shuru:
        // 1) Exact array index (jab humein pata ho — sab se reliable)
        // 2) Exact barcode + abhi tak N/A wali entry
        // 3) Sabse latest N/A wali entry (last resort fallback)
        if (typeof scanHistory !== 'undefined' && scanHistory.length > 0) {
            var targetEntry = null;

            if (calcHistoryIdx >= 0 && scanHistory[calcHistoryIdx] &&
                scanHistory[calcHistoryIdx].Barcode === calcBarcode) {
                targetEntry = scanHistory[calcHistoryIdx];
            }

            if (!targetEntry && calcBarcode) {
                for (var i = 0; i < scanHistory.length; i++) {
                    if (scanHistory[i].Barcode === calcBarcode && scanHistory[i].discDisplay === 'N/A') {
                        targetEntry = scanHistory[i];
                        break;
                    }
                }
            }

            if (!targetEntry) {
                for (var j = 0; j < scanHistory.length; j++) {
                    if (scanHistory[j].discDisplay === 'N/A') {
                        targetEntry = scanHistory[j];
                        break;
                    }
                }
            }

            if (targetEntry) {
                targetEntry.origDisplay   = `${Math.floor(price)}`;
                targetEntry.discDisplay   = `${disc}`;
                targetEntry.savings       = saved;
                targetEntry.isManualPrice = true; // taake history list mein "Manual" badge dikha sakein
                saveScanHistory();
                renderHistory();
            } else {
                console.warn('[Calculator] History mein matching entry nahi mili barcode:', calcBarcode);
            }
        }
    } catch (e) {
        console.warn('calcEnter post-processing error:', e);
    }

    // Yeh hamesha chalega chahe upar kuch bhi fail ho jaye
    setTimeout(function(){ closePriceCalc(); }, 200);
}

// Numpad key presses
document.querySelectorAll('.calc-key[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-key');
        if (calcVal.length >= 8) return; // max 8 digits
        if (k === '0' && calcVal === '') return; // no leading zeros
        calcVal += k;
        calcUpdateDisplay();
    });
});

document.getElementById('calcClearBtn').addEventListener('click', () => {
    calcVal = calcVal.slice(0, -1); // backspace one char
    calcUpdateDisplay();
});

document.getElementById('calcEnterBtn').addEventListener('click', calcEnter);
document.getElementById('calcCloseBtn').addEventListener('click', closePriceCalc);

// Enter key (physical keyboard) se calculate ho
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('priceCalcOverlay').classList.contains('open')) {
        e.preventDefault();
        calcEnter();
    }
});

// SmartWebView on-screen keyboard Done button
// keydown nahi bhejta — input event + value check
document.getElementById('calcDisplay').addEventListener('keyup', function(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        calcEnter();
    }
});

// Android IME Done action - some WebViews use this
document.getElementById('calcDisplay').addEventListener('change', function() {
    // Input field lose focus karne pe (Done press se) calcEnter call
    if (document.getElementById('priceCalcOverlay').classList.contains('open') && calcVal) {
        calcEnter();
    }
});

// Tap outside sheet to close
document.getElementById('priceCalcOverlay').addEventListener('click', function(e) {
    if (e.target === this) closePriceCalc();
});
