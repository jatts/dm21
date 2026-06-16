/* AppDB - SmartWebView Safe Storage
   SmartWebView mein localStorage blocked hai
   Primary: In-memory cache (instant reads/writes)
   Secondary: IndexedDB (persistent, async)
   Fallback: localStorage (browser/debug mode)
*/
var AppDB = (function() {
    var DB_NAME = 'DiscountManagerDB', DB_VERSION = 1, STORE = 'appdata';
    var cache = {}, idb = null;

    // localStorage safely try karo (SmartWebView mein fail ho sakta hai)
    function lsGet(k) {
        try { return localStorage.getItem(k); } catch(e) { return null; }
    }
    function lsSet(k, v) {
        try { localStorage.setItem(k, v); } catch(e) {}
    }
    function lsRemove(k) {
        try { localStorage.removeItem(k); } catch(e) {}
    }

    // Seed cache from localStorage (agar available ho)
    try {
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k) cache[k] = localStorage.getItem(k);
        }
    } catch(e) {}

    // IndexedDB init
    function openDB(cb) {
        if (idb) { cb(idb); return; }
        try {
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function(e) {
                if (!e.target.result.objectStoreNames.contains(STORE))
                    e.target.result.createObjectStore(STORE, { keyPath: 'k' });
            };
            req.onsuccess = function(e) {
                idb = e.target.result;
                // IDB se cache update karo
                try {
                    var tx = idb.transaction(STORE, 'readonly');
                    var req2 = tx.objectStore(STORE).getAll();
                    req2.onsuccess = function(ev) {
                        (ev.target.result||[]).forEach(function(r) {
                            // IDB data cache mein dalo (IDB wins)
                            cache[r.k] = r.v;
                        });
                    };
                } catch(ex) {}
                cb(idb);
            };
            req.onerror = function() { cb(null); };
        } catch(e) { cb(null); }
    }

    function write(key, val) {
        // 1. Memory cache (instant - sync reads work)
        cache[key] = val;
        // 2. localStorage (agar available ho)
        lsSet(key, val);
        // 3. IndexedDB (persistent)
        openDB(function(db) {
            if (!db) return;
            try {
                db.transaction(STORE,'readwrite').objectStore(STORE).put({k:key, v:val});
            } catch(e) {}
        });
    }

    function del(key) {
        delete cache[key];
        lsRemove(key);
        openDB(function(db) {
            if (!db) return;
            try { db.transaction(STORE,'readwrite').objectStore(STORE).delete(key); } catch(e) {}
        });
    }

    openDB(function(){}); // early init

    return {
        get:     function(k, d) {
            var v = cache[k];
            // Cache miss? Try localStorage as fallback
            if (v === undefined || v === null) {
                var ls = lsGet(k);
                if (ls !== null) { cache[k] = ls; v = ls; }
            }
            return (v === undefined || v === null) ? (d !== undefined ? d : null) : v;
        },
        getInt:  function(k, d) { var v = parseInt(this.get(k)); return isNaN(v) ? (d !== undefined ? d : 0) : v; },
        getBool: function(k, d) { var v = this.get(k); return v === null || v === undefined ? d : v === '1' || v === 'true'; },
        set:     function(k, v) { write(k, String(v)); },
        setJSON: function(k, o) { write(k, JSON.stringify(o)); },
        getJSON: function(k, d) {
            var v = this.get(k);
            try { return JSON.parse(v); } catch(e) { return d !== undefined ? d : null; }
        },
        remove:  function(k) { del(k); },
        clear:   function(keys) {
            if (keys) {
                keys.forEach(function(k) { del(k); });
            } else {
                cache = {};
                try { localStorage.clear(); } catch(e) {}
                openDB(function(db) {
                    if (db) try { db.transaction(STORE,'readwrite').objectStore(STORE).clear(); } catch(e) {}
                });
            }
        }
    };
})();
