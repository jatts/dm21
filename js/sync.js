/* ═══════════════════════════════════════
   GS EVENT QUEUE SYSTEM
   App sends raw events → GS calculates
   → GS sends back authoritative state
═══════════════════════════════════════ */
var GS_SYNC_INTERVAL  = 3;   // sync after every 3 scan events (was 10)
var gsEventQueue      = [];
var gsSyncing         = false;
var gsCoinsDeducted   = 0;

// Sync status chip in gamebar
function gsShowSyncStatus(msg, color) {
    var el = document.getElementById('gbUserName');
    if (!el) return;
    el.textContent = msg;
    el.style.color = color || 'rgba(255,255,255,0.5)';
}

function gsQueueEvent(type) {
    gsEventQueue.push({ type: type, ts: Date.now() });
    gsCoinsDeducted++;
    if (gsCoinsDeducted >= GS_SYNC_INTERVAL) {
        gsCoinsDeducted = 0;
        gsFlushEvents(null);
    }
}

function gsFlushEvents(onDone) {
    if (gsSyncing) { if (onDone) onDone(); return; }
    var session = gsGetSession();
    if (!session) { if (onDone) onDone(); return; }

    // Always sync if onDone provided (logout/boot), otherwise need events
    if (!gsEventQueue.length && !onDone) return;

    gsSyncing = true;
    var eventsToSend = gsEventQueue.slice();
    gsEventQueue = [];

    var scanCount   = eventsToSend.filter(function(e){ return e.type==='scan'; }).length;
    var adCount     = eventsToSend.filter(function(e){ return e.type==='ad'; }).length;
    var searchCount = eventsToSend.filter(function(e){ return e.type==='searchCoin'; }).length;

    // Show syncing in gamebar name
    var gbName = document.getElementById('gbUserName');
    var prevTxt = gbName ? gbName.textContent : '';
    if (gbName) { gbName.textContent = 'syncing...'; gbName.style.color = '#00e5ff'; }

    var url = GS_SCRIPT_URL
        + '?action=syncEvents'
        + '&playerId='    + encodeURIComponent(session.playerId)
        + '&token='       + encodeURIComponent(session.token)
        + '&scanEvents='  + scanCount
        + '&adEvents='    + adCount
        + '&searchEvents='+ searchCount
        + '&localCoins='  + coins
        + '&ts='          + Date.now();

    fetch(url, { method: 'GET', redirect: 'follow' })
    .then(function(r) { return r.text(); })
    .then(function(text) {
        gsSyncing = false;
        var json = text.trim();
        if (json.indexOf('{') !== 0) {
            json = json.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
        }
        try {
            var data = JSON.parse(json);
            if (data.success) {
                if (data.coins      !== undefined) { coins = parseInt(data.coins)||0; AppDB.set('coins', coins); }
                if (data.totalScans !== undefined) { totalScans = parseInt(data.totalScans)||0; AppDB.set('totalScans', totalScans); }
                if (data.coinsEarned!== undefined) AppDB.set('coinsEarned', data.coinsEarned);
                if (data.coinsSpent !== undefined) AppDB.set('coinsSpent',  data.coinsSpent);
                if (data.adsWatched !== undefined) AppDB.set('adsWatched',  data.adsWatched);
                if (data.level      !== undefined) level = parseInt(data.level)||1;
                updateGameBar();
                if (data.levelUp) {
                    showToast('Level ' + data.level + ' mubarak ho!', 'info', 3000);
                    tts('Level ' + data.level + ' achieved', 'en-US');
                }
                if (gbName) { gbName.textContent = session.name || session.playerId; gbName.style.color = '#00e676'; }
                setTimeout(function() {
                    if (gbName) { gbName.style.color = 'rgba(255,255,255,0.5)'; }
                }, 2000);
            } else {
                if (gbName) { gbName.textContent = prevTxt; gbName.style.color = '#ff1744'; }
                setTimeout(function() { if (gbName) gbName.style.color = 'rgba(255,255,255,0.5)'; }, 2000);

            }
        } catch(e) {
            if (gbName) { gbName.textContent = prevTxt; gbName.style.color = 'rgba(255,255,255,0.5)'; }
        }
        if (onDone) onDone();
    })
    .catch(function() {
        gsSyncing = false;
        if (gbName) { gbName.textContent = prevTxt; gbName.style.color = '#ff9100'; }
        setTimeout(function() { if (gbName) gbName.style.color = 'rgba(255,255,255,0.5)'; }, 2000);
        gsEventQueue = eventsToSend.concat(gsEventQueue); // put back
        if (onDone) onDone();
    });
}

// Logout: show custom HTML confirm card
document.getElementById('logoutRow').addEventListener('click', function() {
    var overlay = document.getElementById('logoutConfirmOverlay');
    if (overlay) overlay.style.display = 'flex';
});

function doLogout() {
    var overlay = document.getElementById('logoutConfirmOverlay');
    if (overlay) overlay.style.display = 'none';
    gsFlushEvents(function() {
        gsGetSession() && gsClearSession();
        var keysToRemove = ['coins','totalScans','scanHistory','coinsEarned',
                            'coinsSpent','adsWatched','scanStreak','playerName','playerAvatar'];
        AppDB.clear(keysToRemove);
        coins = 30; totalScans = 0; level = 1;
        scanHistory = [];
        gsEventQueue = [];
        gsCoinsDeducted = 0;
        updateGameBar();
        renderHistory();
        var els = {gbUserName:'---',ppName:'Player',ppId:'---',ppBrandRegion:'---'};
        Object.keys(els).forEach(function(id){
            var el = document.getElementById(id); if(el) el.textContent = els[id];
        });
        // Login status badge → Offline
        var loginStatusEl = document.getElementById('ppLoginStatus');
        if (loginStatusEl) { loginStatusEl.textContent = '● Offline'; loginStatusEl.style.color = 'var(--muted)'; }
        showToast('Logout ho gaye', 'info');
        showLoginOverlay();
    });
}

function cancelLogout() {
    var overlay = document.getElementById('logoutConfirmOverlay');
    if (overlay) overlay.style.display = 'none';
}

