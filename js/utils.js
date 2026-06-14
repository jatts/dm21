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
    lang = lang || 'ur-PK';
    if (!('speechSynthesis' in window)) return;
    // SmartWebView mein pehli baar voices nahi hoti
    // Retry mechanism use karo
    var trySpeak = function(attempts) {
        attempts = attempts || 0;
        var voices = speechSynthesis.getVoices();
        if (voices.length === 0 && attempts < 6) {
            setTimeout(function() { trySpeak(attempts + 1); }, 300);
            return;
        }
        ttsQueue.push({text: text, lang: lang});
        if (!ttsBusy) runTts();
    };
    trySpeak(0);
}

function runTts() {
    if (!ttsQueue.length) { ttsBusy = false; return; }
    ttsBusy = true;
    var item = ttsQueue.shift();

    // Method 1: SmartWebView native AndroidInterface TTS
    if (window.AndroidInterface && typeof window.AndroidInterface.speakText === 'function') {
        window.AndroidInterface.speakText(item.text, item.lang || 'ur-PK');
        ttsBusy = false;
        setTimeout(runTts, 800);
        return;
    }

    // Method 2: Standard Web Speech API
    if (!('speechSynthesis' in window)) { ttsBusy = false; return; }
    var u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang || 'ur-PK';
    u.rate = 0.85;
    var voices = speechSynthesis.getVoices();
    var urVoice = null;
    for (var i = 0; i < voices.length; i++) {
        if (voices[i].lang === 'ur-PK' || voices[i].lang === 'ur') {
            urVoice = voices[i]; break;
        }
    }
    if (urVoice && item.lang === 'ur-PK') u.voice = urVoice;
    u.onend = function() { ttsBusy = false; runTts(); };
    u.onerror = function() { ttsBusy = false; runTts(); };
    speechSynthesis.cancel();
    setTimeout(function() {
        try { speechSynthesis.speak(u); }
        catch(e) { ttsBusy = false; runTts(); }
    }, 100);
}

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

