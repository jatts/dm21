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

function tts(text, lang='ur-PK') {
    if (!('speechSynthesis' in window)) return;
    // SmartWebView mein voices load hone mein waqt lagta hai
    // pehli baar voices ready hone ka wait karo
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', function onVoicesReady() {
            speechSynthesis.removeEventListener('voiceschanged', onVoicesReady);
            ttsQueue.push({text, lang});
            if (!ttsBusy) runTts();
        }, { once: true });
        // Fallback: 1 second baad bhi try karo
        setTimeout(function() {
            if (!ttsBusy && ttsQueue.length === 0) {
                ttsQueue.push({text, lang});
                runTts();
            }
        }, 1000);
        return;
    }
    ttsQueue.push({text, lang});
    if (!ttsBusy) runTts();
}

function runTts() {
    if (!ttsQueue.length) { ttsBusy=false; return; }
    ttsBusy = true;
    const {text, lang} = ttsQueue.shift();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    // SmartWebView mein available voice prefer karo
    const voices = speechSynthesis.getVoices();
    const urVoice = voices.find(v => v.lang === 'ur-PK' || v.lang === 'ur');
    if (urVoice && lang === 'ur-PK') u.voice = urVoice;
    u.rate = 0.9;
    u.onend = u.onerror = runTts;
    speechSynthesis.speak(u);
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
