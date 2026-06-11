/* ═══════════════════════════════════════
   SEARCH PAGE
═══════════════════════════════════════ */
function doSearch() {
    const raw = document.getElementById('searchInput').value;
    const v   = validateInput(raw);
    if (!v.ok) { showToast(v.msg, 'error'); return; }
    if (!db)   { showToast('Database load nahi hua', 'error'); return; }

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
    wrap.innerHTML = `
        <table class="result-table">
            <thead><tr>
                <th>Article</th><th>Barcode</th><th>%</th><th>Price</th>
            </tr></thead>
            <tbody>${rows.map(r=>{
                const pN=parseFloat(r.Percentage), opN=parseFloat(r.OriginalPrice);
                const ok=!isNaN(pN)&&!isNaN(opN);
                const disc=ok?Math.floor(opN*(1-pN/100)):null;
                return `<tr onclick="fillAndScan('${esc(r.Barcode)}')">
                    <td>${esc(r.Article||'N/A')}</td>
                    <td style="color:var(--muted)">${esc(r.Barcode)}</td>
                    <td><span class="badge-pct">${ok?Math.floor(pN)+'%':'N/A'}</span></td>
                    <td class="badge-price">${disc!==null?disc:'N/A'}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>`;
    showToast(`${rows.length} results`, 'success');
}

function fillAndScan(bc) {
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
    if (inp) { inp.value = ''; inp.focus(); }
    var wrap = document.getElementById('searchResults');
    if (wrap) wrap.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i>Search results yahan dikhengi</div>';
});
