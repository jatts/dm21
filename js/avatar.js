/* ═══════════════════════════════════════
   MANUAL FOCUS SLIDER
═══════════════════════════════════════ */
(function() {
    const slider = document.getElementById('focusSlider');
    slider.addEventListener('input', async () => {
        if (!torchTrack) return;
        try {
            const caps = torchTrack.getCapabilities();
            // focusDistance support check
            if (caps.focusDistance) {
                const min = caps.focusDistance.min || 0;
                const max = caps.focusDistance.max || 1;
                const val = min + ((slider.value / 100) * (max - min));
                await torchTrack.applyConstraints({
                    advanced: [{ focusMode: 'manual', focusDistance: val }]
                });
            }
        } catch(e) { /* device may not support manual focus */ }
    });
    // Reset to auto-focus when scanner closes
    const origClose = window.closeScanner;
    window.closeScanner = function() {
        slider.value = 50;
        if (torchTrack) {
            try { torchTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch(e) {}
        }
        origClose && origClose();
    };
})();

// (coins tracking now built into gameBar)

/* ═══════════════════════════════════════
   AVATAR HELPERS (global scope - used by gsUpdateUI too)
═══════════════════════════════════════ */
function showAvatarImg(url) {
    var avatarImg   = document.getElementById('ppAvatar');
    var placeholder = document.getElementById('ppAvatarPlaceholder');
    if (!avatarImg || !url) return;

    // Reset any previous error state
    avatarImg.style.display = 'none';

    // onerror: agar URL load na ho toh placeholder show karo (fallback)
    avatarImg.onerror = function() {
        this.onerror = null; // prevent infinite loop
        this.src = '';
        this.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    };

    // onload: jab image successfully load ho tab dikhao
    avatarImg.onload = function() {
        this.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    };

    // Cache-bust suffix: Google Drive thumbnails kabhi kabhi stale cache se 403 dete hain
    // Ek small timestamp parameter add karo taake fresh fetch ho
    var bustUrl = url;
    if (url.indexOf('?') === -1) {
        bustUrl = url + '?cb=' + Math.floor(Date.now() / 300000); // 5-minute window cache bust
    }
    avatarImg.src = bustUrl;
}

function hideAvatarImg() {
    var avatarImg   = document.getElementById('ppAvatar');
    var placeholder = document.getElementById('ppAvatarPlaceholder');
    if (avatarImg) {
        avatarImg.onerror = null;
        avatarImg.onload  = null;
        avatarImg.src     = '';
        avatarImg.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
}

/* Upload picture to Drive GS → get URL → sync to main GS Users sheet */
function uploadAvatarFile(file) {
    var session = gsGetSession();
    if (!session) { showToast('Pehle login karein', 'error'); return; }

    // Show spinner in avatar while uploading
    var placeholder = document.getElementById('ppAvatarPlaceholder');
    if (placeholder) {
        placeholder.style.display  = 'flex';
        placeholder.innerHTML      = '<i class="fas fa-spinner fa-spin" style="font-size:22px;color:#fff"></i>';
    }
    var avatarImg = document.getElementById('ppAvatar');
    if (avatarImg) avatarImg.style.display = 'none';

    showToast('Picture compress ho rahi hai... ⏳', 'info', 15000);

    // ── STEP 1: Read file as DataURL ──
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function() {
        var img = new Image();
        img.onload = function() {
            // ── STEP 2: Resize on canvas (max 200×200, keep aspect ratio) ──
            var MAX_DIM = 200;
            var w = img.width, h = img.height;
            if (w > MAX_DIM || h > MAX_DIM) {
                if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
                else       { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            // JPEG at 65% quality → ~10–30 KB even for large originals
            var compressed = canvas.toDataURL('image/jpeg', 0.65);
            var base64Data = compressed.split(',')[1];

            showToast('Upload ho rahi hai... ⏳', 'info', 15000);

            // ── STEP 3: Upload to main GS (single call: Drive + Users sheet) ──
            fetch(GS_SCRIPT_URL, {
                method  : 'POST',
                redirect: 'follow',
                body    : JSON.stringify({
                    action  : 'uploadAvatar',
                    playerId: session.playerId,
                    token   : session.token,
                    base64  : base64Data
                })
            })
            .then(function(r) { return r.text(); })
            .then(function(text) {
                var json = text.trim();
                if (json.charAt(0) !== '{') {
                    json = json.replace(/^[^\{]*/, '').replace(/[^\}]*$/, '');
                }
                var data = JSON.parse(json);
                if ((data.success || data.status === 'success') && data.url) {
                    var url = data.url;
                    AppDB.set('playerAvatar', url);
                    session.avatarUrl = url;
                    gsSetSession(session);
                    showAvatarImg(url);
                    showToast('Profile picture update ho gayi! \uD83D\uDCF8', 'success', 2500);
                    // No separate gsUpdateAvatarInUsers needed — GS handles it in one call
                } else {
                    throw new Error(data.message || 'Upload fail');
                }
            })
            .catch(function(err) {
                showToast('Upload fail: ' + err.message, 'error', 3000);
                var prevUrl = AppDB.get('playerAvatar', '');
                if (prevUrl && prevUrl.indexOf('http') === 0) {
                    showAvatarImg(prevUrl);
                } else {
                    if (placeholder) {
                        placeholder.innerHTML = '?';
                        placeholder.style.display = 'flex';
                    }
                }
            });
        };
        img.onerror = function() {
            showToast('Image load nahi ho saki', 'error');
            if (placeholder) { placeholder.innerHTML = '?'; placeholder.style.display = 'flex'; }
        };
        img.src = reader.result;
    };
}

