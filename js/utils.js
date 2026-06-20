/* ═══════════════════════════════════════
   INPUT VALIDATION
═══════════════════════════════════════ */
function validateInput(raw) {
    const s = raw.trim();
    if (!s)          return { ok:false, msg:'Barcode khaali hai' };
    if (s.length < 3) return { ok:false, msg:'Barcode bahut chhota hai (min 3)' };
    if (s.length > 50)return { ok:false, msg:'Barcode bahut lamba hai (max 50)' };
    if (!/^[a-zA-Z0-9\-_. ]+$/.test(s)) return { ok:false, msg:'Invalid characters' };
    return { ok:true, val:s.toUpperCase() };  // DB stores uppercase barcodes
}

/* ═══════════════════════════════════════
   TTS — queued, no overlap
═══════════════════════════════════════ */
let ttsQueue = [], ttsBusy = false;

// TTS voices preload — page load pe
var _ttsVoicesLoaded = false;
function _loadTtsVoices() {
    var v = speechSynthesis.getVoices();
    if (v.length > 0) { _ttsVoicesLoaded = true; return v; }
    return [];
}
if ('speechSynthesis' in window) {
    speechSynthesis.addEventListener('voiceschanged', function() {
        _ttsVoicesLoaded = true;
    });
    // Pehle se try karo
    _loadTtsVoices();
}

function tts(text, lang) {
    lang = lang || 'en-US';
    // Yahan speechSynthesis check NAHI karte — CapTTS (Capacitor plugin)
    // alag mechanism hai jo speechSynthesis pe depend nahi karta.
    // Asal check runTts() ke andar hota hai jahan har method try hota hai.
    ttsQueue.push({text: text, lang: lang});
    if (!ttsBusy) runTts();
}

var _ttsFailureToastShown = false;

function runTts() {
    if (!ttsQueue.length) { ttsBusy = false; return; }
    ttsBusy = true;
    var item = ttsQueue.shift();

    // Method 1: CapacitorJS native TTS plugin (sab se reliable — Android System TTS use karta hai)
    if (window.CapTTS && typeof window.CapTTS.speak === 'function') {
        console.log('[TTS] Using CapTTS for:', item.text);
        window.CapTTS.speak({
            text: item.text,
            lang: item.lang || 'en-US',
            rate: 1.0,
            volume: 1.0,
            category: 'ambient'
        }).then(function() {
            console.log('[TTS] CapTTS speak succeeded');
            ttsBusy = false;
            runTts();
        }).catch(function(e) {
            console.warn('[TTS] CapTTS speak failed:', e);
            ttsBusy = false;
            runTts();
        });
        return;
    }

    // Method 2: SmartWebView native AndroidInterface TTS (agar SmartWebView build hai)
    if (window.AndroidInterface && typeof window.AndroidInterface.speakText === 'function') {
        console.log('[TTS] Using AndroidInterface for:', item.text);
        window.AndroidInterface.speakText(item.text, item.lang || 'en-US');
        ttsBusy = false;
        setTimeout(runTts, 800);
        return;
    }

    // Method 3: Standard Web Speech API (browser fallback — Android WebView mein
    // yeh aksar silently fail hoti hai kyunki Android System TTS se connect nahi hoti)
    if (!('speechSynthesis' in window)) {
        console.warn('[TTS] Koi TTS method available nahi: CapTTS, AndroidInterface, ya speechSynthesis - koi nahi mila');
        if (!_ttsFailureToastShown) {
            _ttsFailureToastShown = true;
            showToast && showToast('Voice system available nahi (TTS plugin not registered)', 'error', 4000);
        }
        ttsBusy = false;
        return;
    }
    console.log('[TTS] Using browser speechSynthesis for:', item.text);
    var u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang || 'en-US';
    u.rate = 0.9;
    u.volume = 1;
    u.onend = function() { console.log('[TTS] speechSynthesis ended successfully'); ttsBusy = false; runTts(); };
    u.onerror = function(ev) {
        console.warn('[TTS] speechSynthesis error:', ev.error);
        if (!_ttsFailureToastShown) {
            _ttsFailureToastShown = true;
            showToast && showToast('Voice error: ' + ev.error, 'error', 4000);
        }
        ttsBusy = false; runTts();
    };
    try { speechSynthesis.cancel(); } catch(e) {}
    setTimeout(function() {
        try { speechSynthesis.speak(u); }
        catch(e) {
            console.warn('[TTS] speechSynthesis.speak failed:', e);
            ttsBusy = false; runTts();
        }
    }, 150);
}

// Capacitor TTS plugin baad mein load ho sakta hai (async import) —
// agar queue mein kuch pending hai to dobara try karo jab plugin ready ho
window.addEventListener('capacitorPluginsReady', function() {
    if (window.CapTTS && ttsQueue.length && !ttsBusy) runTts();
});

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
let toastTimer;
function showToast(msg, type='info', dur=2200) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove('show'), dur);
}


/* ═══════════════════════════════════════
   RESULT CARD ANIMATION
   Count-up flip animation when result aata hai
═══════════════════════════════════════ */
function animateValue(elId, finalVal) {
    var el = document.getElementById(elId);
    if (!el) return;

    // Agar N/A ya -- hai to seedha set karo
    if (finalVal === 'N/A' || finalVal === '--') {
        el.textContent = finalVal;
        el.classList.remove('result-pop');
        return;
    }

    // Number extract karo (e.g. "30%" → 30, "1499" → 1499)
    var suffix = finalVal.replace(/[0-9]/g, '');  // e.g. "%"
    var target = parseInt(finalVal.replace(/[^0-9]/g, ''));
    if (isNaN(target)) { el.textContent = finalVal; return; }

    // Pop animation
    el.classList.remove('result-pop');
    void el.offsetWidth; // reflow
    el.classList.add('result-pop');

    // Count-up: 300ms duration
    var start = 0;
    var duration = 350;
    var startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        // Ease-out
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = Math.floor(eased * target);
        el.textContent = current + suffix;
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = finalVal;
        }
    }
    requestAnimationFrame(step);
}

