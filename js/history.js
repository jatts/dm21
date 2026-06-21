/* ═══════════════════════════════════════
   SCAN HISTORY
   SmartWebView mein localStorage/sessionStorage
   blocked ho sakti hai - in-memory primary
   AppDB string set karo (IndexedDB async)
═══════════════════════════════════════ */

// In-memory array - session ke andar hamesha kaam karega
var scanHistory = [];

// Load from AppDB on start (best-effort)
(function loadHistory() {
    try {
        var raw = AppDB.get('scanHistory');
        if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) scanHistory = parsed;
        }
    } catch(e) { scanHistory = []; }
})();

function saveScanHistory() {
    try { AppDB.set('scanHistory', JSON.stringify(scanHistory.slice(0, 30))); } catch(e) {}
}

function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderHistory() {
    var list = document.getElementById('historyList');
    if (!list) return;

    // Pending count badge update karo — taake user ko pata chale kitne
    // items mein abhi bhi price daalni baaki hai
    var badge = document.getElementById('historyPendingBadge');
    if (badge) {
        var pendingCount = scanHistory.filter(function(r) { return r.discDisplay === 'N/A'; }).length;
        if (pendingCount > 0) {
            badge.textContent = pendingCount + ' price baaki';
            badge.style.cssText = 'display:inline-block;font-size:9px;font-weight:700;background:rgba(0,229,255,.15);color:var(--accent);border:1px solid rgba(0,229,255,.4);border-radius:8px;padding:2px 8px;margin-left:6px;vertical-align:middle;';
        } else {
            badge.style.display = 'none';
        }
    }

    if (!scanHistory.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-barcode"></i>Koi scan nahi kiya abhi tak</div>';
        return;
    }
    list.innerHTML = scanHistory.map(function(r, idx) {
        var manualBadge = r.isManualPrice
            ? '<span class="h-manual-badge"><i class="fas fa-keyboard"></i> Manual</span>'
            : '';
        var isPending = r.discDisplay === 'N/A';
        // Agar price abhi tak N/A hai (pending), to tap karne se SEEDHA calculator
        // khulta hai isi entry ke liye — dobara lookup nahi hoti (warna duplicate
        // entry ban jati thi aur calculator galat/nayi entry update karta tha).
        // Agar price already mil chuki hai, to tap se dobara scan/lookup hoti hai.
        var tapAction = isPending
            ? "openHistoryPriceEntry(" + idx + ")"
            : "lookupBarcode('" + esc(r.Barcode).replace(/'/g, "\\'") + "', true)";
        var tapTitle = isPending ? 'Tap to enter price' : 'Tap to re-scan';
        var pendingClass = isPending ? ' h-pending' : '';
        // Pending items ke liye clear visual hint — taake user ko pata chale tap karna hai
        var pendingHint = isPending
            ? '<span class="h-pending-hint"><i class="fas fa-calculator"></i> Price daalein</span>'
            : '';
        return '<div class="h-item' + pendingClass + '" onclick="' + tapAction + '" style="cursor:pointer" title="' + tapTitle + '">' +
            '<span class="h-article">' + esc(r.Article) + '</span>' +
            '<span class="h-tag pct">' + esc(r.pctDisplay) + '</span>' +
            '<span class="h-tag orig">' + esc(r.origDisplay) + '</span>' +
            '<span class="h-tag disc">' + esc(r.discDisplay) + '</span>' +
            '<div class="h-barcode-row"><span><i class="fas fa-barcode" style="margin-right:5px;opacity:.4"></i>' + esc(r.Barcode) + '</span>' + manualBadge + pendingHint + '</div>' +
        '</div>';
    }).join('');
}

// History list mein N/A price wali entry pe tap karne se SEEDHA calculator khulta hai —
// us exact entry ke liye (index se), koi nayi/duplicate entry nahi banti
function openHistoryPriceEntry(idx) {
    var entry = scanHistory[idx];
    if (!entry) return;
    if (typeof openPriceCalc === 'function') {
        openPriceCalc(entry.pct, entry.Article, entry.Barcode, idx);
    }
}
window.openHistoryPriceEntry = openHistoryPriceEntry;
