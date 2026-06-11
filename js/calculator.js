/* ═══════════════════════════════════════
   PRICE CALCULATOR
   Opens when pct found but price missing
═══════════════════════════════════════ */
let calcPct       = 0;
let calcArticle   = '';
let calcVal       = '';

function openPriceCalc(pct, article) {
    calcPct     = pct;
    calcArticle = article;
    calcVal     = '';
    document.getElementById('calcDisplay').value        = '';
    document.getElementById('calcPctBadge').textContent = `${Math.floor(pct)}%`;
    document.getElementById('priceCalcOverlay').classList.add('open');
}

function closePriceCalc() {
    document.getElementById('priceCalcOverlay').classList.remove('open');
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

    // Update result cards
    document.getElementById('afterPriceValue').textContent = `${disc}`;

    // TTS
    const speakPct   = document.getElementById('togglePercentage').checked;
    const speakPrice = document.getElementById('toggleAfterPrice').checked;
    ttsQueue.length = 0; speechSynthesis.cancel(); ttsBusy = false;
    if (speakPct)   tts(`${Math.floor(calcPct)}%`);
    if (speakPrice) tts(`${disc}`);

    // Update latest history entry with price
    if (scanHistory.length > 0 && scanHistory[0].discDisplay === 'N/A') {
        scanHistory[0].origDisplay = `${Math.floor(price)}`;
        scanHistory[0].discDisplay = `${disc}`;
        scanHistory[0].savings     = saved;
        saveScanHistory();
        renderHistory();
    }


    closePriceCalc();
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

// Tap outside sheet to close
document.getElementById('priceCalcOverlay').addEventListener('click', function(e) {
    if (e.target === this) closePriceCalc();
});

