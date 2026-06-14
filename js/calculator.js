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
    var _ov = document.getElementById('priceCalcOverlay');
    _ov.style.display = 'flex'; // direct style - Android WebView ke liye
    _ov.classList.add('open');
    // SmartWebView native banner hide karo taake calculator upar rahe
    if (window.AdMobInterface && typeof window.AdMobInterface.hideBannerAd === 'function') {
        window.AdMobInterface.hideBannerAd();
    } else if (window.AdMob && typeof window.AdMob.hideBanner === 'function') {
        window.AdMob.hideBanner();
    }
}

function closePriceCalc() {
    var ov = document.getElementById('priceCalcOverlay');
    ov.classList.remove('open');
    ov.style.display = 'none'; // direct style - Android WebView ke liye safe
    // Banner wapis show karo
    if (window.AdMobInterface && typeof window.AdMobInterface.showBannerAd === 'function') {
        window.AdMobInterface.showBannerAd();
    } else if (window.AdMob && typeof window.AdMob.showBanner === 'function') {
        window.AdMob.showBanner();
    }
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


    // 200ms delay - Android WebView mein smooth close ke liye
    setTimeout(closePriceCalc, 200);
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

