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
    if (!scanHistory.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-barcode"></i>Koi scan nahi kiya abhi tak</div>';
        return;
    }
    list.innerHTML = scanHistory.map(function(r) {
        return '<div class="h-item" onclick="lookupBarcode(\'' + esc(r.Barcode) + '\', true)" style="cursor:pointer" title="Tap to re-scan">' +
            '<span class="h-article">' + esc(r.Article) + '</span>' +
            '<span class="h-tag pct">' + esc(r.pctDisplay) + '</span>' +
            '<span class="h-tag orig">' + esc(r.origDisplay) + '</span>' +
            '<span class="h-tag disc">' + esc(r.discDisplay) + '</span>' +
            '<div class="h-barcode-row"><i class="fas fa-barcode" style="margin-right:5px;opacity:.4"></i>' + esc(r.Barcode) + '</div>' +
        '</div>';
    }).join('');
}
