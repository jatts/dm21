/* ═══════════════════════════════════════
   SEARCH PAGE
═══════════════════════════════════════ */
// Text mein match highlight karo
function highlightMatch(text, query) {
    if (!query || !text) return esc(text || 'N/A');
    var escaped = esc(text);
    var escapedQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp('(' + escapedQ + ')', 'gi'),
        '<mark style="background:rgba(0,229,255,0.25);color:var(--accent);border-radius:3px;padding:0 2px">$1</mark>');
}

function doSearch() {
    const raw = document.getElementById('searchInput').value;
    const v   = validateInput(raw);
    if (!v.ok) { showToast(v.msg, 'error'); return; }
    if (!db)   { showToast('Database load nahi hua', 'error'); return; }

    // Keyboard band karo
    document.getElementById('searchInput').blur();

    const rows = queryDB(
        `SELECT Barcode, Article, Percentage, OriginalPrice FROM sc
         WHERE Barcode LIKE ? OR Article LIKE ? LIMIT 60`,
        [`%${v.val}%`, `%${v.val}%`]
    );

    const wrap = document.getElementById('searchResults');
    if (!rows.length) {
        wrap.innerHTML='<div class="no-results"><i class="fas fa-search-minus" style="font-size:28px;display:block;margin-bottom:8px;opacity:.3"></i>Koi result nahi mila</div>';
        return;
    }

    const qDisplay = v.val; // highlight ke liye original query
    wrap.innerHTML = `
        <table class="result-table">
            <thead><tr>
                <th>Article</th><th>Barcode</th><th>%</th><th>Price</th>
            </tr></thead>
            <tbody>${rows.map(r=>{
                const pN=parseFloat(r.Percentage), opN=parseFloat(r.OriginalPrice);
                // Percentage aur Price ALAG ALAG check hote hain — Percentage
                // har barcode mein ho sakti hai chahe Price ho ya na ho
                const hasPctS   = !isNaN(pN) && isFinite(pN);
                const rawPriceS = String(r.OriginalPrice ?? '').trim();
                const hasPriceS = rawPriceS !== '' && rawPriceS !== '0' && !isNaN(opN) && isFinite(opN) && opN > 0;
                const ok=hasPctS && hasPriceS;
                const disc=ok?Math.floor(opN*(1-pN/100)):null;
                return `<tr onclick="fillAndScan('${esc(r.Barcode)}')">
                    <td>${highlightMatch(r.Article||'N/A', qDisplay)}</td>
                    <td style="color:var(--muted)">${highlightMatch(r.Barcode, qDisplay)}</td>
                    <td><span class="badge-pct">${hasPctS?Math.floor(pN)+'%':'N/A'}</span></td>
                    <td class="badge-price">${disc!==null?disc:'N/A'}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>`;
    showToast(`${rows.length} results mile`, 'success');
}

function fillAndScan(bc) {
    // Keyboard band karo — result row pe tap karne se pehle search box
    // focused ho sakta hai (system keyboard khula reh jata hai)
    var si = document.getElementById('searchInput');
    if (si) si.blur();
    document.activeElement && document.activeElement.blur && document.activeElement.blur();

    showPage('scan', document.getElementById('nav-scan'));
    document.getElementById('barcodeInput').value = bc;
    lookupBarcode(bc, true); // true = search-mode (coins deduct, no totalScans++)
}

document.getElementById('searchGoBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', e=>{
    if(e.key==='Enter') doSearch();
});


// FIX: searchClearBtn ka handler missing tha — button HTML mein tha lekin kaam nahi karta tha
document.getElementById('searchClearBtn').addEventListener('click', function() {
    var inp = document.getElementById('searchInput');
    if (inp) { inp.value = ''; inp.blur(); }
    var wrap = document.getElementById('searchResults');
    if (wrap) wrap.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i>Search results yahan dikhengi</div>';
});
