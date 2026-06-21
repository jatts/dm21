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

    const disc  = Math.floor(price * (1 - calcPct/100));
    const saved = Math.floor(price - disc);

    // ── 1) Result card update (independent — kabhi fail na ho) ──
    try {
        document.getElementById('afterPriceValue').textContent = `${disc}`;
    } catch (e) { console.warn('[Calculator] Result card update error:', e); }

    // ── 2) TTS (independent — yeh fail ho to bhi history update honi chahiye) ──
    try {
        const speakPct   = (document.getElementById('togglePercentage') || {}).checked;
        const speakPrice = (document.getElementById('toggleAfterPrice') || {}).checked;
        ttsQueue.length = 0;
        if (typeof speechSynthesis !== 'undefined') {
            try { speechSynthesis.cancel(); } catch(e2) {}
        }
        ttsBusy = false;
        if (speakPct)   tts(`${Math.floor(calcPct)}%`);
        if (speakPrice) tts(`${disc}`);
    } catch (e) {
        console.warn('[Calculator] TTS error (ignored, history update continues):', e);
    }

    // ── 3) History update — YEH SABSE ZAROORI HAI, isay alag try-catch mein
    //      rakha hai taake upar ki koi bhi cheez fail ho to bhi yeh chale ──
    try {
        if (typeof scanHistory !== 'undefined' && scanHistory.length > 0) {
            var targetEntry = null;

            // 1) Exact array index (jab humein pata ho — sab se reliable)
            if (calcHistoryIdx >= 0 && scanHistory[calcHistoryIdx] &&
                scanHistory[calcHistoryIdx].Barcode === calcBarcode) {
                targetEntry = scanHistory[calcHistoryIdx];
            }

            // 2) Exact barcode + abhi tak N/A wali entry
            if (!targetEntry && calcBarcode) {
                for (var i = 0; i < scanHistory.length; i++) {
                    if (scanHistory[i].Barcode === calcBarcode && scanHistory[i].discDisplay === 'N/A') {
                        targetEntry = scanHistory[i];
                        break;
                    }
                }
            }

            // 3) Sabse latest N/A wali entry (last resort fallback)
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
                console.log('[Calculator] History entry updated:', targetEntry.Barcode, '-> price', price, 'disc', disc);
            } else {
                console.warn('[Calculator] History mein matching entry NAHI MILI. calcBarcode:', calcBarcode, 'calcHistoryIdx:', calcHistoryIdx, 'scanHistory:', JSON.stringify(scanHistory.map(function(e){return e.Barcode + ':' + e.discDisplay;})));
            }
        } else {
            console.warn('[Calculator] scanHistory empty ya undefined hai jab calcEnter chala!');
        }
    } catch (e) {
        console.error('[Calculator] CRITICAL: History update mein exception aayi:', e);
    }

    // ── 4) Save + render — yeh BHI alag try-catch mein, history-update se independent ──
    try {
        saveScanHistory();
        renderHistory();
    } catch (e) {
        console.error('[Calculator] CRITICAL: saveScanHistory/renderHistory mein exception:', e);
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
document.getElementById('calcCloseBtn').addEventListener('click', function() {
    // User ka expected behavior: agar price type ki hai to X dabane se BHI
    // save honi chahiye (sirf Enter se nahi) — warna price likh kar X dabane
    // walon ki price kabhi save hi nahi hoti thi
    if (calcVal && calcVal.length > 0) {
        calcEnter(); // yeh khud closePriceCalc() bhi call kar deta hai
    } else {
        closePriceCalc();
    }
});

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
    if (e.target === this) {
        if (calcVal && calcVal.length > 0) {
            calcEnter();
        } else {
            closePriceCalc();
        }
    }
});

