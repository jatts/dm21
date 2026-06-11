/* ═══════════════════════════════════════
   LEADERBOARD SYSTEM
═══════════════════════════════════════ */
var lbData       = null;
var lbCurrentTab = 'pakistan';
var lbLoading    = false;

var AVATAR_COLORS = ['#7c4dff','#00acc1','#43a047','#e53935','#fb8c00','#3949ab','#00897b','#8e24aa'];

function lbGetAvatarColor(name) {
    if (!name || typeof name !== 'string') return AVATAR_COLORS[0];
    var h = 0;
    for (var i = 0; i < name.length; i++) h += name.charCodeAt(i);
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function lbGetInitials(name) {
    if (!name) return '?';
    var words = name.trim().split(' ');
    var inits = '';
    for (var i = 0; i < words.length && inits.length < 2; i++) {
        if (words[i]) inits += words[i][0].toUpperCase();
    }
    return inits || '?';
}

function lbSetContent(html) {
    var el = document.getElementById('lbContent');
    if (el) el.innerHTML = html;
}

function lbLoad(force) {
    // If already loading and not forced, skip (prevent double-fetch)
    if (lbLoading && !force) return;

    var session = gsGetSession();
    if (!session) {
        lbLoading = false; // BUG FIX: reset flag on early return so future calls work
        lbSetContent('<div class="lb-loading">Login karein leaderboard dekhne ke liye</div>');
        return;
    }

    lbLoading = true;
    lbSetContent('<div class="lb-loading"><i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Loading...</div>');

    var url = GS_SCRIPT_URL
        + '?action=leaderboard'
        + '&playerId=' + encodeURIComponent(session.playerId)
        + '&token='    + encodeURIComponent(session.token)
        + '&ts='       + Date.now();

    fetch(url, { method: 'GET', redirect: 'follow' })
    .then(function(r) { return r.text(); })
    .then(function(text) {
        lbLoading = false;
        var json = text.trim();
        // Strip JSONP wrapper if any
        if (json.charAt(0) !== '{') {
            json = json.replace(/^[^\{]*/, '').replace(/[^\}]*$/, '');
        }
        var data;
        try { data = JSON.parse(json); } catch(e) {
            lbSetContent('<div class="lb-loading">Data parse error. Refresh karein.</div>');
            return;
        }
        if (data.success) {
            data._ts  = Date.now();
            lbData    = data;
            // BUG FIX: wrap lbRender in try-catch — previously a JS crash here
            // would fall into .catch below and show misleading "Network error"
            try {
                lbRender();
            } catch(renderErr) {
                console.error('lbRender error:', renderErr);
                lbSetContent('<div class="lb-loading">Display error. Dobara refresh karein.</div>');
            }
        } else {
            lbSetContent('<div class="lb-loading">Server error: ' + (data.message || 'Unknown') + '</div>');
        }
    })
    .catch(function(err) {
        lbLoading = false;
        // Only show network error for actual network failures (fetch rejection)
        lbSetContent('<div class="lb-loading"><i class="fas fa-wifi" style="margin-right:6px;color:var(--danger)"></i>Network error — internet check karein ya refresh dabayein.</div>');
    });
}

function lbShowTab(region, btn) {
    lbCurrentTab = region;
    document.querySelectorAll('.lb-tab').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    if (lbData) {
        lbRender();
    } else {
        lbLoad(true);
    }
}

function lbRender() {
    var session = gsGetSession();
    var myId    = session ? session.playerId : '';
    var list    = [];
    if (lbData && lbData[lbCurrentTab]) list = lbData[lbCurrentTab];
    
    if (!list.length) {
        lbSetContent('<div class="lb-loading">Is region mein abhi koi data nahi</div>');
        return;
    }

    var regionLabel = { pakistan: '\uD83C\uDDF5\uD83C\uDDF0 Pakistan', karachi: '\uD83D\uDCCD KHI', lahore: '\uD83D\uDCCD LHR', islamabad: '\uD83D\uDCCD ISB' };
    var timeStr = lbData && lbData._ts
        ? new Date(lbData._ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        : '';

    var html = '<div class="lb-section-header">'
        + '<i class="fas fa-list-ol" style="color:var(--accent2)"></i>'
        + (regionLabel[lbCurrentTab] || lbCurrentTab) + ' Top Scanners'
        + (timeStr ? '<span style="font-size:9px;margin-left:auto;font-weight:400;color:var(--muted)">Updated ' + timeStr + '</span>' : '')
        + '</div>';

    html += '<div class="lb-list">';

    for (var i = 0; i < list.length; i++) {
        var u = list[i];
        // BUG FIX: skip null/malformed entries from GS that caused lbGetAvatarColor to crash
        if (!u || typeof u !== 'object') continue;
        var isMe   = String(u.id || '') === String(myId);
        var pos    = u.pos || (i + 1);
        var medal  = pos === 1 ? '\uD83E\uDD47' : pos === 2 ? '\uD83E\uDD48' : pos === 3 ? '\uD83E\uDD49' : String(pos);
        var cls    = 'lb-item' + (isMe ? ' me' : pos === 1 ? ' top1' : pos === 2 ? ' top2' : pos === 3 ? ' top3' : '');
        var color  = lbGetAvatarColor(u.name);
        var inits  = lbGetInitials(u.name);
        var meTag  = isMe ? '<span class="lb-me-tag">YOU</span>' : '';
        var scans  = Number(u.scans) || 0;
        var meta   = [];
        if (u.city)   meta.push(u.city);
        if (u.brand)  meta.push(u.brand);
        meta.push('Lvl ' + (u.level || 1));

        // Avatar: real picture if available, else colored initials
        // Cache-bust for Google Drive thumbnails (5-min window prevents stale 403s)
        var cbSuffix  = '?cb=' + Math.floor(Date.now() / 300000);
        var imgUrl    = (u.avatarUrl && u.avatarUrl.indexOf('http') === 0)
            ? (u.avatarUrl.indexOf('?') === -1 ? u.avatarUrl + cbSuffix : u.avatarUrl)
            : '';
        // Safe initials: strip quotes for inline onerror handler
        var safeInits = inits.replace(/['"\\]/g, '');
        var avatarHtml = imgUrl
            ? '<div class="lb-avatar lb-avatar-img" style="background:' + color + ';padding:0;overflow:hidden">'
              + '<img src="' + imgUrl + '" '
              + 'style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" '
              + "onerror=\"this.style.display='none';var p=this.parentNode;p.style.padding='';p.classList.remove('lb-avatar-img');p.textContent='" + safeInits + "'\""
              + '>'
              + '</div>'
            : '<div class="lb-avatar" style="background:' + color + '">' + inits + '</div>';

        html += '<div class="' + cls + '">'
            + '<div class="lb-pos">' + medal + '</div>'
            + avatarHtml
            + '<div class="lb-info">'
            +   '<div class="lb-name">' + esc(u.name || '?') + meTag + '</div>'
            +   '<div class="lb-meta">' + esc(meta.join(' · ')) + '</div>'
            + '</div>'
            + '<div class="lb-right">'
            +   '<div class="lb-scans">' + scans.toLocaleString() + '</div>'
            +   '<div class="lb-rank-badge">' + esc(u.rank || '') + '</div>'
            + '</div>'
            + '</div>';
    }
    html += '</div>';
    lbSetContent(html);
}

// Refresh button
document.getElementById('lbRefreshBtn').addEventListener('click', function() {
    var btn = this;
    // Prevent double-click
    if (btn.disabled) return;

    // Visual feedback
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';

    lbLoading = false; // force reset stuck flag

    // BUG FIX: Pehle pending scan events GS pe sync karo,
    // tabhi leaderboard fetch karo — warna user ka outdated data dikhega
    gsFlushEvents(function() {
        lbLoad(true);
        setTimeout(function() {
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            btn.disabled = false;
        }, 1800);
    });
});

