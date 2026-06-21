/* ═══════════════════════════════════════
   INLINE CAMERA BARCODE SCANNER
   - Continuous mode: camera OFF + countdown overlay → restart
   - Flashlight / torch
   - Beep on detect (Web Audio API)
   - Fast rAF detection loop
═══════════════════════════════════════ */
let videoStream     = null;
let barcodeDetector = null;
let scannerActive   = false;
let scannerRAF      = null;
let torchOn         = false;
let torchTrack      = null;
let cdInterval      = null;   // countdown interval
let cdRemaining     = 0;      // seconds left in countdown

/* ── Beep (Web Audio API) ── */
let audioCtx = null;
function beep(freq=1800, dur=90, vol=0.45) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur/1000);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + dur/1000);
    } catch(e) {}
}

function setStatus(msg) {
    const el = document.getElementById('scannerStatus');
    if (el) el.textContent = msg;
}

function setFabIcon(mode) {
    const fab = document.getElementById('fabBtn');
    fab.innerHTML = mode === 'close'
        ? '<i class="fas fa-times"></i>'
        : '<i class="fas fa-barcode"></i>';
}

function getDelaySec() {
    return parseInt(document.getElementById('delaySelect').value) || 3;
}

function isContinuous() {
    return document.getElementById('contScanToggle').checked;
}

/* ── Continuous toggle label ── */
document.getElementById('contScanToggle').addEventListener('change', function() {
    const lbl = document.getElementById('contLabel');
    lbl.className = 'cont-label' + (this.checked ? ' cont-active' : '');
    lbl.textContent = this.checked ? '\uD83D\uDD04 Continuous ON' : 'Continuous';
});

// FALLBACK: Android WebView mein <label> ke andar <div> hone se kabhi kabhi
// auto-toggle (label click -> checkbox check) reliably kaam nahi karta.
// Explicit click handler lagate hain taake toggle hamesha kaam kare.
(function() {
    var toggleLabel = document.querySelector('.cont-toggle-wrap .toggle');
    var checkbox     = document.getElementById('contScanToggle');
    if (toggleLabel && checkbox) {
        toggleLabel.addEventListener('click', function(e) {
            // Agar click seedha checkbox pe hi laga ho to double-toggle se bacho
            if (e.target === checkbox) return;
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
})();

/* ════════════════════════════
   OPEN SCANNER (start camera)
════════════════════════════ */
async function openScanner() {
    if (window.AppInventor) { window.AppInventor.setWebViewString('start_scan'); return; }

    // Unlock AudioContext on first user gesture
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }

    // Hide countdown overlay if visible
    hideCountdown();

    const box = document.getElementById('scannerBox');
    box.classList.add('open');
    scannerActive = true;
    torchOn = false;
    document.getElementById('torchBtn').classList.remove('on');
    setFabIcon('close');
    setStatus('Camera shuru ho raha hai...');

    // Init BarcodeDetector once
    if (!barcodeDetector && 'BarcodeDetector' in window) {
        try {
            barcodeDetector = new BarcodeDetector({
                formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf','codabar','qr_code']
            });
        } catch(e) { barcodeDetector = null; }
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width:  { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }
        });
        const video = document.getElementById('cameraFeed');
        video.srcObject = videoStream;
        await video.play();
        torchTrack = videoStream.getVideoTracks()[0];

        if (barcodeDetector) {
            setStatus('Barcode saamne rakho...');
            startFastDetection(video);
        } else {
            setStatus('\u26A0\uFE0F BarcodeDetector support nahi - browser update karein');
        }
    } catch(err) {
        setStatus(err.name === 'NotAllowedError' ? '\u274C Camera permission chahiye' : '\u274C ' + err.message);
    }
}

/* ════════════════════════════
   STOP CAMERA (but keep box)
════════════════════════════ */
function stopCamera() {
    scannerActive = false;
    if (scannerRAF) { cancelAnimationFrame(scannerRAF); scannerRAF = null; }
    if (torchTrack && torchOn) {
        try { torchTrack.applyConstraints({ advanced: [{ torch: false }] }); } catch(e) {}
    }
    torchOn = false; torchTrack = null;
    if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
    const video = document.getElementById('cameraFeed');
    video.srcObject = null;
    document.getElementById('torchBtn').classList.remove('on');
}

/* ════════════════════════════
   CLOSE SCANNER (full close)
════════════════════════════ */
function closeScanner() {
    stopCamera();
    hideCountdown();
    setFabIcon('barcode');
    document.getElementById('scannerBox').classList.remove('open');
}

/* ════════════════════════════
   COUNTDOWN OVERLAY
════════════════════════════ */
function showCountdown(seconds, onDone) {
    if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
    cdRemaining = seconds;

    const overlay = document.getElementById('countdownOverlay');
    const numEl   = document.getElementById('cdNumber');
    const barEl   = document.getElementById('cdBarFill');

    numEl.textContent = cdRemaining;
    barEl.style.transition = 'none';
    barEl.style.width = '100%';
    overlay.classList.add('show');

    // Force reflow so transition re-triggers
    void barEl.offsetWidth;
    barEl.style.transition = `width ${seconds}s linear`;
    barEl.style.width = '0%';

    cdInterval = setInterval(() => {
        cdRemaining--;
        numEl.textContent = cdRemaining;
        if (cdRemaining <= 0) {
            clearInterval(cdInterval); cdInterval = null;
            hideCountdown();
            onDone();
        }
    }, 1000);

    // Skip button
    document.getElementById('cdSkipBtn').onclick = () => {
        clearInterval(cdInterval); cdInterval = null;
        hideCountdown();
        onDone();
    };
}

function hideCountdown() {
    if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
    document.getElementById('countdownOverlay').classList.remove('show');
}

/* ════════════════════════════
   FAST DETECTION LOOP
════════════════════════════ */
function startFastDetection(video) {
    let detecting = false;
    scannerActive = true;

    async function loop() {
        if (!scannerActive) return;
        if (!detecting && video.readyState >= 2) {
            detecting = true;
            try {
                const results = await barcodeDetector.detect(video);
                if (results.length > 0) {
                    onBarcodeDetected(results[0].rawValue);
                    return;
                }
            } catch(e) {}
            detecting = false;
        }
        scannerRAF = requestAnimationFrame(loop);
    }
    scannerRAF = requestAnimationFrame(loop);
}

/* ════════════════════════════
   ON BARCODE DETECTED
════════════════════════════ */
function onBarcodeDetected(code) {
    // Stop detection loop immediately
    if (scannerRAF) { cancelAnimationFrame(scannerRAF); scannerRAF = null; }

    // Beep + vibrate (respect settings)
    if (document.getElementById('settingBeep')?.checked !== false) beep(1800, 90);
    if (document.getElementById('settingVibrate')?.checked !== false) {
        if ('vibrate' in navigator) navigator.vibrate(55);
    }

    // Green flash
    const flash = document.createElement('div');
    flash.className = 'scan-flash';
    document.getElementById('scannerBox').appendChild(flash);
    setTimeout(() => flash.remove(), 350);

    setStatus('\u2705 ' + code);

    // DB lookup (silent - no input field update needed)
    lookupBarcode(code);

    if (isContinuous()) {
        const delaySec = getDelaySec();
        // Scan hote hi camera TURANT band karo (black screen) — countdown ke
        // dauran camera band rehni chahiye, khatam hone par dobara khulegi
        stopCamera();
        showCountdown(delaySec, () => {
            if (document.getElementById('scannerBox').classList.contains('open')) {
                openScanner(); // camera fresh restart
            }
        });
    } else {
        setTimeout(() => closeScanner(), 350);
    }
}

/* ── Torch ── */
async function toggleTorch() {
    if (!torchTrack) { showToast('Camera pehle open karein', 'warn'); return; }
    try {
        const caps = torchTrack.getCapabilities();
        if (!caps.torch) { showToast('Is camera mein torch nahi hai', 'warn'); return; }
        torchOn = !torchOn;
        await torchTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
        document.getElementById('torchBtn').classList.toggle('on', torchOn);
        setStatus(torchOn ? '\uD83D\uDD26 Torch on' : 'Barcode saamne rakho...');
    } catch(e) { showToast('Torch error: ' + e.message, 'error'); }
}

/* ── Button wiring ── */
const _scanBtnEl = document.getElementById('scanBtn');
if (_scanBtnEl) _scanBtnEl.onclick = openScanner;

// FAB: opens scanner, icon becomes X; press again → close, icon becomes barcode
document.getElementById('fabBtn').onclick = function() {
    const box = document.getElementById('scannerBox');
    if (box.classList.contains('open')) {
        closeScanner();
        setFabIcon('barcode');
    } else {
        openScanner();
    }
};

document.getElementById('torchBtn').onclick = toggleTorch;

/* ── EVENT BANNER — Google Sheet se fetch ─────────────
   Sheet: D3 = Event Name, F3 = Date
   Refresh: har 10 minute
   ──────────────────────────────────────────────────── */
(function() {
    var SHEET_ID  = '1VVDJTYuP4ounKW_CLsM0Xkkt-WtvC0hnQpoo437o-OY';
    var SEPARATOR = ' \u2022 ';  // bullet separator between name and date

    function setMarqueeText(text) {
        var t1 = document.getElementById('eventBannerText');
        var t2 = document.getElementById('eventBannerText2');
        if (t1) t1.textContent = text + SEPARATOR;
        if (t2) t2.textContent = text + SEPARATOR;
    }

    function fetchEventInfo() {
        // Use gviz CSV export — no API key needed, public sheet
        var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID
                + '/gviz/tq?tqx=out:csv&range=D3:F3&headers=0';

        fetch(url, { cache: 'no-store' })
            .then(function(r) {
                if (!r.ok) throw new Error(r.status);
                return r.text();
            })
            .then(function(csv) {
                // CSV row: "EventName","","Date"  (D3, E3, F3)
                // Parse: split by comma, remove quotes
                var cols = csv.trim().split(',').map(function(c) {
                    return c.replace(/^"|"$/g, '').trim();
                });
                var name = cols[0] || '';
                var date = cols[2] || cols[1] || '';

                if (!name && !date) {
                    setMarqueeText('Koi event nahi');
                    return;
                }

                var text = '';
                if (name) text += name;
                if (name && date) text += '  \u2014  ';
                if (date) text += date;

                setMarqueeText(text);
                console.log('[Event Banner] ' + text);
            })
            .catch(function(e) {
                console.log('[Event Banner] fetch fail:', e.message);
                // Keep whatever text was showing, or show fallback
                var t1 = document.getElementById('eventBannerText');
                if (t1 && t1.textContent === 'Loading...') {
                    setMarqueeText('Event info unavailable');
                }
            });
    }

    // First fetch after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(fetchEventInfo, 1500);
        });
    } else {
        setTimeout(fetchEventInfo, 1500);
    }

    // Refresh har 10 minute
    setInterval(fetchEventInfo, 10 * 60 * 1000);
})();
