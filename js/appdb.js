/* AppDB - IndexedDB + localStorage dual-write storage */
var AppDB = (function() {
    var DB_NAME = 'DiscountManagerDB', DB_VERSION = 1, STORE = 'appdata';
    var cache = {}, idb = null;

    // Seed cache from localStorage immediately (sync reads work from day 1)
    try {
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k) cache[k] = localStorage.getItem(k);
        }
    } catch(e) {}

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
                // Merge IDB data into cache (IDB wins over localStorage)
                try {
                    var tx = idb.transaction(STORE, 'readonly');
                    var req2 = tx.objectStore(STORE).getAll();
                    req2.onsuccess = function(ev) {
                        (ev.target.result||[]).forEach(function(r){ cache[r.k] = r.v; });
                    };
                } catch(ex) {}
                cb(idb);
            };
            req.onerror = function() { cb(null); };
        } catch(e) { cb(null); }
    }

    function write(key, val) {
        cache[key] = val;
        try { localStorage.setItem(key, val); } catch(e) {}
        openDB(function(db) {
            if (!db) return;
            try { db.transaction(STORE,'readwrite').objectStore(STORE).put({k:key,v:val}); } catch(e) {}
        });
    }

    function del(key) {
        delete cache[key];
        try { localStorage.removeItem(key); } catch(e) {}
        openDB(function(db) {
            if (!db) return;
            try { db.transaction(STORE,'readwrite').objectStore(STORE).delete(key); } catch(e) {}
        });
    }

    openDB(function(){}); // init early

    return {
        get:     function(k,d){ var v=cache[k]; return (v===undefined||v===null)?(d!==undefined?d:null):v; },
        getInt:  function(k,d){ var v=parseInt(cache[k]); return isNaN(v)?(d!==undefined?d:0):v; },
        getBool: function(k,d){ var v=cache[k]; return v===null||v===undefined?d:v==='1'||v==='true'; },
        set:     function(k,v){ write(k,String(v)); },
        setJSON: function(k,o){ write(k,JSON.stringify(o)); },
        getJSON: function(k,d){ try{return JSON.parse(cache[k]);}catch(e){return d!==undefined?d:null;} },
        remove:  function(k){ del(k); },
        clear:   function(keys){
            if(keys){ keys.forEach(function(k){del(k);}); }
            else {
                cache={};
                try{localStorage.clear();}catch(e){}
                openDB(function(db){if(db)try{db.transaction(STORE,'readwrite').objectStore(STORE).clear();}catch(e){}});
            }
        }
    };
})();
