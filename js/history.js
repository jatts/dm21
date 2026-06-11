/* ═══════════════════════════════════════
   SCAN HISTORY
═══════════════════════════════════════ */
let scanHistory = (() => {
    try { return AppDB.getJSON('scanHistory', []); }
    catch(e) { return []; }
})();

function saveScanHistory() {
    try { AppDB.setJSON('scanHistory', scanHistory.slice(0,200)); }
    catch(e) {}
}

function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderHistory() {
    const list = document.getElementById('historyList');
    if (!scanHistory.length) {
        list.innerHTML='<div class="empty-state"><i class="fas fa-barcode"></i>Koi scan nahi kiya abhi tak</div>';
        return;
    }
    // FIX: history item tap pe barcode re-scan hota hai (UX improvement)
    list.innerHTML = scanHistory.map(r=>`
        <div class="h-item" onclick="lookupBarcode('${esc(r.Barcode)}', true)" style="cursor:pointer" title="Tap to re-scan">
            <span class="h-article">${esc(r.Article)}</span>
            <span class="h-tag pct">${esc(r.pctDisplay)}</span>
            <span class="h-tag orig">${esc(r.origDisplay)}</span>
            <span class="h-tag disc">${esc(r.discDisplay)}</span>
            <div class="h-barcode-row"><i class="fas fa-barcode" style="margin-right:5px;opacity:.4"></i>${esc(r.Barcode)}</div>
        </div>`).join('');
}

