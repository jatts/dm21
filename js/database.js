/* ═══════════════════════════════════════════════════════
   DATABASE — Brand-based DB via GAS Proxy
   ═══════════════════════════════════════════════════════
   Flow:
   1. Login ke baad brand detect (session se)
   2. GAS ko request → validate → GitHub latest info return
   3. Cached version == latest? → IDB se load (fast)
   4. Naya version → forced update UI → ZIP download (% progress)
   5. 3 retry logic → corrupt check → extract → cache → mount
   6. No internet + no cache → block (AdMob app, no offline)
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ── Version helpers for naming: dm.al.XX.X / dm.j.XX.X ─ */
function parseDbVer(verStr) {
    // "44.1" → 44001 for comparison
    if (!verStr) return 0;
    const parts = String(verStr).split('.');
    if (parts.length >= 2) return parseInt(parts[0]) * 1000 + parseInt(parts[1]);
    return parseInt(parts[0]) || 0;
}
function extractVerFromName(filename) {
    // Naya GitHub naming system:
    //   JDot     → dm.j.01.1.zip        (01.1, 01.2 ... 01.10, phir 02.1)
    //   Almirah  → dm.almirah.01.1.zip  (same pattern)
    // dm.j.01.1.zip or dm.almirah.01.1.zip → "01.1"
    const m = filename.match(/dm\.(?:j|almirah)\.(\d+\.\d+)/i);
    return m ? m[1] : null;
}


/* ── CONFIG ─────────────────────────────────────────── */
const DB_CFG = {
    IDB_DB     : 'DM_DbCache',
    STORE      : 'files',
    KEY_BLOB   : 'active_blob',
    KEY_VER    : 'active_ver',
    KEY_BRAND  : 'active_brand',
    KEY_LOADED : 'active_loaded_ts',
    KEY_SIZE   : 'active_size',
    MAX_RETRY  : 3,
};

/* ── STATE (settings.js reads this) ─────────────────── */
window.DB_STATE = {
    activeVersion : '?',
    activeSize    : 0,
    activeLoaded  : null,
    activeBrand   : '?',
};

/* ── BRAND MAP ───────────────────────────────────────── */
// Brand name (from session) → folder name on GitHub
function getBrandFolder(brand) {
    if (!brand) return null;
    const b = brand.toLowerCase();
    if (b.includes('almirah'))          return 'Almirah';
    if (b.includes('junaid') || b.includes('jdot') || b.includes('j.')) return 'JDot';
    return null;
}

/* ── IndexedDB helpers ───────────────────────────────── */
let _idb = null;
async function idbOpen() {
    if (_idb) return _idb;
    return new Promise((res, rej) => {
        const req = indexedDB.open(DB_CFG.IDB_DB, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_CFG.STORE);
        req.onsuccess = e => { _idb = e.target.result; res(_idb); };
        req.onerror   = e => rej(e.target.error);
    });
}
async function idbGet(key) {
    const d = await idbOpen();
    return new Promise((res, rej) => {
        const req = d.transaction(DB_CFG.STORE, 'readonly').objectStore(DB_CFG.STORE).get(key);
        req.onsuccess = e => res(e.target.result ?? null);
        req.onerror   = e => rej(e.target.error);
    });
}
async function idbSet(key, val) {
    const d = await idbOpen();
    return new Promise((res, rej) => {
        const req = d.transaction(DB_CFG.STORE, 'readwrite').objectStore(DB_CFG.STORE).put(val, key);
        req.onsuccess = () => res();
        req.onerror   = e  => rej(e.target.error);
    });
}
async function idbDel(key) {
    const d = await idbOpen();
    return new Promise((res, rej) => {
        const req = d.transaction(DB_CFG.STORE, 'readwrite').objectStore(DB_CFG.STORE).delete(key);
        req.onsuccess = () => res();
        req.onerror   = e  => rej(e.target.error);
    });
}

/* ── Loading UI helpers ──────────────────────────────── */
function ldMsg(text) { const e = document.getElementById('loadingMsg'); if (e) e.textContent = text; }
function ldSub(text) { const e = document.getElementById('loadingSub'); if (e) e.textContent = text; }
function ldPct(pct) {
    const wrap = document.getElementById('loadingBarWrap');
    const fill = document.getElementById('loadingBarFill');
    const lbl  = document.getElementById('loadingBarPct');
    if (!wrap) return;
    if (pct < 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    if (fill) fill.style.width  = Math.min(pct, 100) + '%';
    if (lbl)  lbl.textContent   = Math.min(pct, 100) + '%';
}
function hideLoading() {
    const el = document.getElementById('loading');
    if (!el) return;
    el.style.display = 'none';
}
function fmtSize(bytes) {
    if (!bytes) return '?';
    return bytes > 1048576
        ? (bytes / 1048576).toFixed(1) + ' MB'
        : (bytes / 1024).toFixed(0) + ' KB';
}
function fmtDate(ts) {
    if (!ts) return '?';
    const d = new Date(ts);
    return d.toLocaleDateString('ur-PK') + ' ' + d.toLocaleTimeString('ur-PK', { hour: '2-digit', minute: '2-digit' });
}

/* ── Show update banner (forced — no skip) ───────────── */
function showUpdateBanner(oldVer, newVer, onConfirm) {
    // Remove existing
    const old = document.getElementById('dbUpdateBanner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'dbUpdateBanner';
    banner.style.cssText = [
        'position:fixed','inset:0','z-index:99999',
        'background:rgba(0,0,0,0.88)','backdrop-filter:blur(6px)',
        'display:flex','align-items:center','justify-content:center',
        'padding:24px'
    ].join(';');

    banner.innerHTML = `
        <div style="background:var(--surface,#1e1e2e);border:1px solid var(--border,#333);
                    border-radius:20px;padding:24px 20px;width:100%;max-width:340px;text-align:center">
            <div style="font-size:28px;margin-bottom:10px">🔄</div>
            <div style="font-size:15px;font-weight:700;color:var(--text,#fff);margin-bottom:6px">
                Naya Database Available!
            </div>
            <div style="font-size:12px;color:var(--muted,#888);margin-bottom:16px">
                v${oldVer} &rarr; <span style="color:var(--accent,#00e5ff);font-weight:700">v${newVer}</span>
                <br>Download zaruri hai — app is ke baghair kaam nahi kar sakti
            </div>
            <button id="dbUpdateBtn" style="width:100%;padding:12px;border:none;border-radius:12px;
                    background:linear-gradient(135deg,var(--accent2,#7c4dff),var(--accent,#00e5ff));
                    color:#fff;font-size:14px;font-weight:700;cursor:pointer">
                ⬇️ Abhi Download Karo
            </button>
        </div>`;

    document.body.appendChild(banner);
    document.getElementById('dbUpdateBtn').onclick = function () {
        banner.remove();
        onConfirm();
    };
}

/* ── Show error screen (no cache, no internet) ────────── */
function showBlockScreen(msg) {
    ldMsg('❌ ' + msg);
    ldSub('Internet check karein aur app reload karein');
    ldPct(-1);
    // Keep loading screen visible — app is blocked
}

/* ── ZIP extract (native DecompressionStream) ─────────── */
function parseZip(buffer) {
    const v = new DataView(buffer), b = new Uint8Array(buffer);
    const files = new Map();
    let off = 0;
    while (off + 30 < b.length) {
        if (v.getUint32(off, true) !== 0x04034b50) break;
        const comp  = v.getUint16(off + 8,  true);
        const cSize = v.getUint32(off + 18, true);
        const uSize = v.getUint32(off + 22, true);
        const fnLen = v.getUint16(off + 26, true);
        const exLen = v.getUint16(off + 28, true);
        const name  = new TextDecoder().decode(b.slice(off + 30, off + 30 + fnLen));
        const dOff  = off + 30 + fnLen + exLen;
        files.set(name, { data: b.slice(dOff, dOff + (comp === 0 ? uSize : cSize)), comp, uSize });
        off = dOff + cSize;
    }
    return files;
}
async function deflateRaw(compressed) {
    const ds = new DecompressionStream('deflate-raw');
    const w  = ds.writable.getWriter();
    const r  = ds.readable.getReader();
    w.write(compressed); w.close();
    const chunks = []; let total = 0;
    while (true) {
        const { done, value } = await r.read();
        if (done) break;
        chunks.push(value); total += value.length;
    }
    const out = new Uint8Array(total); let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.length; }
    return out;
}
async function extractDbFromZip(arrayBuffer) {
    const entries = parseZip(arrayBuffer);
    for (const [name, entry] of entries) {
        if (name.endsWith('.db') || /\.db$/i.test(name)) {
            return entry.comp === 8 ? await deflateRaw(entry.data) : entry.data;
        }
    }
    throw new Error('ZIP ke andar .db file nahi mili');
}

/* ── Validate extracted DB bytes ──────────────────────── */
function validateDbBytes(bytes) {
    if (!bytes || bytes.length < 100) throw new Error('DB file bahut chhoti hai (corrupt?)');
    // SQLite magic header: "SQLite format 3\0"
    const magic = String.fromCharCode(...bytes.slice(0, 15));
    if (!magic.startsWith('SQLite format 3')) throw new Error('DB file valid SQLite nahi hai (corrupt?)');
    return true;
}

/* ── SQL.js mount ─────────────────────────────────────── */
let _db = null;
async function mountSqlDb(uint8) {
    const SQL = await initSqlJs({ locateFile: f => 'assets/js/' + f });
    _db = new SQL.Database(uint8);
    window.sqlDB = _db;  // global reference
    window.db    = _db;  // legacy alias — search.js/lookup.js use this
    window._dbInitRunning = false;
}

/* ── GAS: get DB info (version + download URL) ────────── */
async function gasCall(session, brandFolder, mode) {
    const timestamp = Date.now();
    const params = new URLSearchParams({
        action    : 'getDbInfo',
        playerId  : session.playerId,
        token     : session.token,
        brand     : brandFolder,
        timestamp : timestamp,
        mode      : mode || 'info',
    });
    const gasUrl = (typeof GS_SCRIPT_URL !== 'undefined') ? GS_SCRIPT_URL : null;
    if (!gasUrl) throw new Error('GAS URL missing — auth.js load order check karo');
    const url  = gasUrl + '?' + params.toString();
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error('GAS response: ' + resp.status);
    const data = await resp.json();
    // TEMP DEBUG — issue trace ke baad hata dena
    console.log('[DEBUG gasCall] mode=' + mode + ' url=' + url);
    console.log('[DEBUG gasCall] response=', JSON.stringify(data).slice(0, 500));
    if (!data.success) throw new Error(data.message || 'GAS error');
    return data;
}

// Alias for version check
async function gasGetDbInfo(session, brandFolder) {
    return gasCall(session, brandFolder, 'info');
}

/* ── Download ZIP via GAS proxy (base64) — 3 retry ──────── */
async function downloadViaGas(session, brandFolder, expectedSize) {
    let lastError;
    for (let attempt = 1; attempt <= DB_CFG.MAX_RETRY; attempt++) {
        try {
            if (attempt > 1) {
                ldMsg('Retry ' + attempt + '/' + DB_CFG.MAX_RETRY + '...');
                ldSub(''); ldPct(0);
                await new Promise(r => setTimeout(r, 2000));
            }

            ldMsg('GAS se ZIP download ho rahi hai...');
            ldSub(fmtSize(expectedSize) + ' - please wait...');
            ldPct(10);

            const data = await gasCall(session, brandFolder, 'download');

            ldPct(80);
            ldSub('Decoding...');

            if (!data.data) throw new Error('GAS se data nahi mila');

            const b64    = data.data;
            const binary = atob(b64);
            const bytes  = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

            ldPct(100);
            ldSub(fmtSize(bytes.length) + ' received');

            if (expectedSize && bytes.length < expectedSize * 0.3) {
                throw new Error('Data incomplete: ' + fmtSize(bytes.length));
            }

            return bytes.buffer;

        } catch (e) {
            lastError = e;
            console.warn('[DB] Download attempt ' + attempt + ' fail:', e.message);
            ldSub('Fail: ' + e.message);
        }
    }
    throw new Error('3 retry ke baad bhi download fail: ' + lastError.message);
}

/* ── Full download + extract + save + mount ───────────── */
async function downloadAndInstall(info, session, brandFolder, cachedVer) {
    // Download
    ldMsg('Database download ho rahi hai...');
    ldSub('v' + cachedVer + ' → v' + info.version);
    ldPct(0);

    const zipBuffer = await downloadViaGas(session, brandFolder, info.size);

    // Extract
    ldMsg('ZIP extract ho rahi hai...'); ldSub(''); ldPct(-1);
    const dbBytes = await extractDbFromZip(zipBuffer);

    // Validate
    ldMsg('Database verify ho rahi hai...');
    validateDbBytes(dbBytes);  // throws if corrupt

    // Clear old cache
    ldMsg('Purana cache clear ho raha hai...');
    try { await idbDel(DB_CFG.KEY_BLOB); } catch (e) {}

    // Save new
    ldMsg('Naya database save ho raha hai...');
    await idbSet(DB_CFG.KEY_BLOB,   dbBytes);
    await idbSet(DB_CFG.KEY_VER,    info.version);
    await idbSet(DB_CFG.KEY_BRAND,  brandFolder);
    await idbSet(DB_CFG.KEY_LOADED, Date.now());
    await idbSet(DB_CFG.KEY_SIZE,   dbBytes.length);
    AppDB.set('dmDbVer_' + brandFolder, info.version);

    // Update state
    window.DB_STATE.activeVersion = info.version;
    window.DB_STATE.activeBrand   = brandFolder;
    window.DB_STATE.activeSize    = dbBytes.length;
    window.DB_STATE.activeLoaded  = Date.now();

    // Mount
    ldMsg('Database mount ho rahi hai...');
    await mountSqlDb(dbBytes);
    console.log('✅ DB v' + info.version + ' (' + brandFolder + ') ready — ' + fmtSize(dbBytes.length));
}

/* ══════════════════════════════════════════════════════
   BACKGROUND POLLING — app khuli hi rahe tab bhi
   har 8 second baad GitHub/GAS se naya version check
   karta hai. Agar naya version mile to forced update
   banner dikha deta hai (auto-download nahi karta).
══════════════════════════════════════════════════════ */
const DB_POLL_INTERVAL_MS = 8000; // 8 sec (5-10s range)
let _dbPollTimer = null;

function startDbVersionPolling(session, brandFolder) {
    // Pehle se chal raha hai to dobara start na karo
    if (_dbPollTimer) return;

    _dbPollTimer = setInterval(async function () {
        try {
            // Skip agar: download/install already chal raha hai,
            // banner already dikh raha hai, ya internet nahi hai
            if (window._dbInitRunning) return;
            if (document.getElementById('dbUpdateBanner')) return;
            if (!navigator.onLine) return;

            const gasInfo   = await gasGetDbInfo(session, brandFolder);
            const latestVer = gasInfo.version;
            const activeVer = window.DB_STATE.activeVersion;

            if (activeVer === '?' || !latestVer) return;

            if (parseDbVer(latestVer) > parseDbVer(activeVer)) {
                console.log('[DB] Background poll: naya version mila v' + latestVer);
                showUpdateBanner(activeVer, latestVer, async function () {
                    const ld = document.getElementById('loading');
                    if (ld) { ld.style.display = 'flex'; ld.classList.remove('fade'); }
                    ldMsg('Update download ho rahi hai...');
                    ldSub(''); ldPct(0);
                    try {
                        await downloadAndInstall(gasInfo, session, brandFolder, activeVer);
                        settingsDbUpdate();
                        hideLoading();
                        if (typeof showToast === 'function') showToast('✅ DB v' + latestVer + ' update ho gayi!', 'success', 3000);
                    } catch (e) {
                        showBlockScreen('Update fail: ' + e.message);
                    }
                });
            }
        } catch (e) {
            // Background check chup chaap fail ho — user ko disturb mat karo
            console.warn('[DB] Background version poll fail:', e.message);
        }
    }, DB_POLL_INTERVAL_MS);
}

function stopDbVersionPolling() {
    if (_dbPollTimer) { clearInterval(_dbPollTimer); _dbPollTimer = null; }
}

/* ══════════════════════════════════════════════════════
   MAIN: initDatabase()
   Called from boot.js AFTER login (session must exist)
══════════════════════════════════════════════════════ */
async function initDatabase() {
    // Guard: agar already run ho raha hai to skip
    if (window._dbInitRunning) return;
    window._dbInitRunning = true;

    ldMsg('Database check ho rahi hai...');
    ldSub(''); ldPct(-1);

    // ── 1. Session + brand check ──
    if (typeof gsGetSession !== 'function') {
        // auth.js abhi load nahi hua — silently return
        window._dbInitRunning = false;
        return;
    }
    const session = gsGetSession();
    if (!session || !session.playerId) {
        // Not logged in yet — boot.js handles this, just return
        return;
    }

    const brandFolder = getBrandFolder(session.brand);
    if (!brandFolder) {
        showBlockScreen('Brand identify nahi hua (' + (session.brand || 'empty') + ')');
        window._dbInitRunning = false; return;
    }

    ldSub(brandFolder + ' DB...');

    const cachedVer   = AppDB.get('dmDbVer_' + brandFolder, '0');
    const cachedBrand = await idbGet(DB_CFG.KEY_BRAND);

    // ── 2. Brand switch? → clear old cache ──
    if (cachedBrand && cachedBrand !== brandFolder) {
        ldMsg('Brand change detect hua — purana cache clear...');
        try { await idbDel(DB_CFG.KEY_BLOB); } catch (e) {}
        try { await idbDel(DB_CFG.KEY_VER);  } catch (e) {}
    }

    // ── 3. Internet check ──
    const isOnline = navigator.onLine;
    if (!isOnline) {
        // Try cached
        const cached = await idbGet(DB_CFG.KEY_BLOB);
        if (cached && cached.length > 100) {
            showBlockScreen('Offline — app ko internet chahiye');
        } else {
            showBlockScreen('Koi DB cache nahi aur internet bhi nahi');
        }
        return;
    }

    // ── 4. GAS se latest info lo ──
    let gasInfo = null;
    ldMsg('Server se version check...');
    try {
        gasInfo = await gasGetDbInfo(session, brandFolder);
    } catch (e) {
        console.warn('[DB] GAS check fail:', e.message);
        const msg = e.message || '';

        // Session invalid → silently logout aur login page dikhao
        // User ko confusing error nahi dikhni chahiye
        if (msg.includes('Session invalid') || msg.includes('session') || msg.includes('login karein') || msg.includes('Unauthorized')) {
            console.warn('[DB] Session expired — clearing session, showing login');
            if (typeof gsClearSession === 'function') gsClearSession();
            window._dbInitRunning = false;
            // Loading screen hide karo, login page dikhao
            const ldEl = document.getElementById('loading');
            if (ldEl) ldEl.style.display = 'none';
            if (typeof showLoginOverlay === 'function') {
                showLoginOverlay();
            } else {
                const loginEl = document.getElementById('loginOverlay');
                if (loginEl) loginEl.classList.add('show');
            }
            return;
        }

        // GAS down ya network issue — cache check karo
        const cached = await idbGet(DB_CFG.KEY_BLOB);
        if (cached && cached.length > 100) {
            showBlockScreen('Server se connect nahi ho raha — app ko internet chahiye');
        } else {
            showBlockScreen('Server se connect nahi ho raha aur koi cache bhi nahi');
        }
        return;
    }

    const latestVer = gasInfo.version;
    const isSame    = cachedVer === latestVer || parseDbVer(cachedVer) >= parseDbVer(latestVer);

    // ── 5. Same version → load from cache ──
    if (isSame) {
        try {
            const cached = await idbGet(DB_CFG.KEY_BLOB);
            if (cached && cached.length > 100) {
                const size   = await idbGet(DB_CFG.KEY_SIZE)   || cached.length;
                const loaded = await idbGet(DB_CFG.KEY_LOADED) || null;

                ldMsg('Database load ho rahi hai...');
                ldSub('v' + latestVer + ' · ' + fmtSize(size));
                await mountSqlDb(cached);

                window.DB_STATE.activeVersion = latestVer;
                window.DB_STATE.activeBrand   = brandFolder;
                window.DB_STATE.activeSize    = size;
                window.DB_STATE.activeLoaded  = loaded;

                settingsDbUpdate();
                hideLoading();
                console.log('✅ DB v' + latestVer + ' loaded from cache');
                startDbVersionPolling(session, brandFolder);
                return;
            }
        } catch (e) {
            console.warn('[DB] Cache load fail:', e.message);
        }
    }

    // ── 6. New version OR no cache → forced download ──
    const isFirstInstall = cachedVer === '0';

    if (isFirstInstall) {
        // No banner for first install — direct download
        ldMsg('Pehli baar DB download ho rahi hai...');
        ldSub(brandFolder + ' v' + latestVer);
        ldPct(0);
        try {
            await downloadAndInstall(gasInfo, session, brandFolder, cachedVer);
            settingsDbUpdate();
            hideLoading();
            if (typeof showToast === 'function') showToast('Database ready! v' + latestVer, 'success', 3000);
            startDbVersionPolling(session, brandFolder);
        } catch (e) {
            showBlockScreen('Download fail: ' + e.message);
        }
    } else {
        // Show forced update banner — user must tap to download
        showUpdateBanner(cachedVer, latestVer, async function () {
            const ld = document.getElementById('loading');
            if (ld) { ld.style.display = 'flex'; ld.classList.remove('fade'); }
            ldMsg('Update download ho rahi hai...');
            ldSub(''); ldPct(0);
            try {
                await downloadAndInstall(gasInfo, session, brandFolder, cachedVer);
                settingsDbUpdate();
                hideLoading();
                if (typeof showToast === 'function') showToast('✅ DB v' + latestVer + ' update ho gayi!', 'success', 3000);
                startDbVersionPolling(session, brandFolder);
            } catch (e) {
                showBlockScreen('Update fail: ' + e.message);
            }
        });
    }
}

/* ── Query helper (used by lookup.js, search.js etc.) ── */
function queryDB(sql, params) {
    params = params || [];
    if (!_db) return [];
    try {
        const stmt = _db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
    } catch (e) {
        console.error('[DB] query error:', e);
        return [];
    }
}

function getDbVersion() { return window.DB_STATE.activeVersion; }

/* ── Settings UI update ───────────────────────────────── */
function settingsDbUpdate() {
    const s = window.DB_STATE;
    const badge  = document.getElementById('dbVerBadge');
    const desc   = document.getElementById('dbInfoDesc');
    const footer = document.getElementById('dbVerFooter');
    const sizeTag= document.getElementById('dbSizeTag');

    if (badge)   badge.textContent  = 'v' + s.activeVersion;
    if (footer)  footer.textContent = 'v' + s.activeVersion;
    if (desc)    desc.textContent   = s.activeBrand + ' · ' + fmtSize(s.activeSize) + ' · ' + fmtDate(s.activeLoaded);
    if (sizeTag) sizeTag.textContent = fmtSize(s.activeSize);
}
