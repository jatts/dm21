/* ═══════════════════════════════════════
   INTERNET CONNECTIVITY MONITOR
   BUG FIX: Previous version pinged GAS URL every 5s with 6s timeout.
   GAS cold-start can take 8-10s → false "offline" overlay showed even
   when internet was perfectly fine.
   Fix:
   - Use navigator.onLine as PRIMARY check (instant, no network call)
   - Only ping GAS if navigator.onLine is true (verifies GAS reachability)
   - 12s timeout (GAS cold-start safe)
   - 20s interval (was 5s — too aggressive for GAS)
   - Require 2 consecutive failures before showing overlay
═══════════════════════════════════════ */
(function() {
    var overlay        = document.getElementById('netOverlay');
    var retryBtn       = document.getElementById('netRetryBtn');
    var chip           = document.getElementById('netStatusChip');
    var timer          = null;
    var isOffline      = false;
    var failCount      = 0;       // consecutive fail counter
    var FAIL_THRESHOLD = 2;       // show overlay only after 2 consecutive failures
    var pingInFlight   = false;   // prevent concurrent pings

    function showOffline() {
        if (isOffline) return;
        isOffline = true;
        if (overlay) { overlay.style.display = 'flex'; overlay.style.flexDirection = 'column'; }
        if (chip) chip.textContent = 'Internet connection nahi hai';
    }

    function hideOffline() {
        isOffline = false;
        failCount = 0;
        if (overlay) overlay.style.display = 'none';
        if (chip) chip.textContent = 'Connected \u2713';
    }

    function ping() {
        // PRIMARY CHECK: navigator.onLine is instant (no network call)
        if (!navigator.onLine) {
            failCount++;
            if (failCount >= FAIL_THRESHOLD) showOffline();
            return;
        }

        // If a ping is already in flight, skip this cycle
        if (pingInFlight) return;
        pingInFlight = true;

        var pingUrl = GS_SCRIPT_URL + '?action=ping&ts=' + Date.now();
        var done = false;

        // 12 second timeout — GAS cold-start can be 8-10s
        var t = setTimeout(function() {
            if (done) return;
            done = true;
            pingInFlight = false;
            failCount++;
            if (failCount >= FAIL_THRESHOLD) showOffline();
        }, 12000);

        fetch(pingUrl, { method: 'GET', redirect: 'follow' })
        .then(function(r) {
            if (done) return;
            done = true;
            pingInFlight = false;
            clearTimeout(t);
            // opaque = CORS but request reached server → online
            if (r.ok || r.status === 200 || r.type === 'opaque') {
                hideOffline();
            } else {
                failCount++;
                if (failCount >= FAIL_THRESHOLD) showOffline();
            }
        })
        .catch(function() {
            if (done) return;
            done = true;
            pingInFlight = false;
            clearTimeout(t);
            failCount++;
            if (failCount >= FAIL_THRESHOLD) showOffline();
        });
    }

    function startMonitor() {
        ping();
        clearInterval(timer);
        // 20s interval — GAS is not a lightweight ping target
        timer = setInterval(ping, 20000);
    }

    if (retryBtn) {
        retryBtn.onclick = function() {
            if (chip) chip.textContent = 'Checking...';
            failCount = 0;
            pingInFlight = false;
            ping();
        };
    }

    window.addEventListener('online',  hideOffline);
    window.addEventListener('offline', showOffline);

    // Start after 2s so GS_SCRIPT_URL is defined and page is settled
    setTimeout(startMonitor, 2000);
})();
