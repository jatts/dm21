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
    list.innerHTML = scanHistory.map(function(r, idx) {
        var manualBadge = r.isManualPrice
            ? '<span class="h-manual-badge"><i class="fas fa-keyboard"></i> Manual</span>'
            : '';
        // Agar price abhi tak N/A hai (pending), to tap karne se SEEDHA calculator
        // khulta hai isi entry ke liye — dobara lookup nahi hoti (warna duplicate
        // entry ban jati thi aur calculator galat/nayi entry update karta tha).
        // Agar price already mil chuki hai, to tap se dobara scan/lookup hoti hai.
        var tapAction = r.discDisplay === 'N/A'
            ? "openHistoryPriceEntry(" + idx + ")"
            : "lookupBarcode('" + esc(r.Barcode).replace(/'/g, "\\'") + "', true)";
        var tapTitle = r.discDisplay === 'N/A' ? 'Tap to enter price' : 'Tap to re-scan';
        return '<div class="h-item" onclick="' + tapAction + '" style="cursor:pointer" title="' + tapTitle + '">' +
            '<span class="h-article">' + esc(r.Article) + '</span>' +
            '<span class="h-tag pct">' + esc(r.pctDisplay) + '</span>' +
            '<span class="h-tag orig">' + esc(r.origDisplay) + '</span>' +
            '<span class="h-tag disc">' + esc(r.discDisplay) + '</span>' +
            '<div class="h-barcode-row"><span><i class="fas fa-barcode" style="margin-right:5px;opacity:.4"></i>' + esc(r.Barcode) + '</span>' + manualBadge + '</div>' +
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
