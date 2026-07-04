/* ═══════════════════════════════════════
   LOGIN + GOOGLE SHEETS AUTH
   Script URL hardcoded - no config needed
═══════════════════════════════════════ */
var GS_SCRIPT_URL  = 'https://script.google.com/macros/s/AKfycbwyQEWiUnPu_c3ZSuYPyTIxLi80E-LVuI-YUUYeppq6RqbNjV3KQwWpTxdoP1_ATu9q/exec';
var GS_SESSION_KEY = 'dmSession';

function gsGetSession() {
    try {
        var s = AppDB.getJSON(GS_SESSION_KEY, null);
        if (!s) return null;
        // Session never expires — removed expiry check
        return s;
    } catch(e) { return null; }
}

function gsSetSession(s) {
    AppDB.setJSON(GS_SESSION_KEY, s);
}

function gsClearSession() {
    AppDB.remove(GS_SESSION_KEY);
}

function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h).toString(36);
}

function showLoginOverlay() {
    document.getElementById('loginOverlay').classList.add('show');
    document.getElementById('loginErr').textContent = '';
    document.getElementById('loginIdInput').value = '';
    document.getElementById('loginPassInput').value = '';
    switchAuthTab('login');
}

function hideLoginOverlay() {
    document.getElementById('loginOverlay').classList.remove('show');
}

function switchAuthTab(tab) {
    var loginForm  = document.getElementById('loginForm');
    var signupForm = document.getElementById('signupForm');
    var tabL = document.getElementById('tabLoginBtn');
    var tabS = document.getElementById('tabSignupBtn');
    if (tab === 'login') {
        loginForm.style.display  = 'block';
        signupForm.style.display = 'none';
        tabL.classList.add('active');
        tabS.classList.remove('active');
    } else {
        loginForm.style.display  = 'none';
        signupForm.style.display = 'block';
        tabL.classList.remove('active');
        tabS.classList.add('active');
    }
}

// Pakistan cities list
var PK_CITIES = [
    'Abbottabad','Adezai','Attock','Awaran','Badin','Bahawalpur','Bahawalnagar',
    'Bannu','Battagram','Bhakkar','Bhalwal','Bhimbar','Burewala','Chakwal',
    'Chaman','Charsadda','Chiniot','Chishtian','Chitral','Dadu','Dera Ghazi Khan',
    'Dera Ismail Khan','Faisalabad','Ghotki','Gojra','Gujranwala','Gujrat',
    'Gwadar','Hafizabad','Haripur','Hub','Hyderabad','Islamabad','Jacobabad',
    'Jalalpur Jattan','Jamshoro','Jhang','Jhelum','Kamalia','Kamoke','Karachi',
    'Kasur','Khairpur','Khanewal','Khanpur','Khushab','Khuzdar','Kohat',
    'Kot Addu','Lahore','Larkana','Layyah','Lodhran','Mailsi','Malakand',
    'Mandi Bahauddin','Mansehra','Mardan','Mianwali','Mingora','Mirpur',
    'Mirpur Khas','Multan','Muzaffarabad','Muzaffargarh','Narowal','Nawabshah',
    'Nowshera','Nushki','Okara','Pakpattan','Pasrur','Peshawar','Pind Dadan Khan',
    'Quetta','Rahim Yar Khan','Rawalpindi','Sadiqabad','Sahiwal','Sargodha',
    'Sheikhupura','Shikarpur','Sialkot','Sibi','Sukkur','Swabi','Swat',
    'Tando Adam','Tando Allahyar','Taxila','Toba Tek Singh','Turbat',
    'Umerkot','Vehari','Wah Cantonment','Zhob'
];

// City search functionality
(function() {
    var cityInput = document.getElementById('suCityInput');
    var cityHidden = document.getElementById('suCity');
    var dropdown = document.getElementById('cityDropdown');
    if (!cityInput) return;

    cityInput.addEventListener('input', function() {
        var q = this.value.trim().toLowerCase();
        cityHidden.value = '';
        if (!q) { dropdown.style.display = 'none'; return; }
        var matches = PK_CITIES.filter(function(c) {
            return c.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);
        if (!matches.length) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = matches.map(function(c) {
            return '<div style="padding:9px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border);color:var(--text)" class="city-opt">' + c + '</div>';
        }).join('');
        dropdown.style.display = 'block';
        dropdown.querySelectorAll('.city-opt').forEach(function(opt) {
            opt.addEventListener('click', function() {
                cityInput.value  = this.textContent;
                cityHidden.value = this.textContent;
                dropdown.style.display = 'none';
            });
        });
    });

    document.addEventListener('click', function(e) {
        if (!cityInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
})();

// Check session on boot - show login if no valid session
(function() {
    var session = gsGetSession();
    if (!session) {
        showLoginOverlay();
    } else {
        // Already logged in - update UI
        gsUpdateUI(session);
    }
})();

// Update all UI elements with session info
function gsUpdateUI(session) {
    if (!session) return;
    var gbName = document.getElementById('gbUserName');
    if (gbName) gbName.textContent = session.name || session.playerId;
    var ppName = document.getElementById('ppName');
    var ppId   = document.getElementById('ppId');
    if (ppName) ppName.textContent = session.name || 'Player';
    if (ppId)   ppId.textContent   = session.playerId || '---';
    // Brand + Region + City
    var ppBR = document.getElementById('ppBrandRegion');
    if (ppBR) {
        var parts = [];
        if (session.brand)  parts.push(session.brand);
        if (session.region) parts.push(session.region);
        if (session.city)   parts.push(session.city);
        ppBR.textContent = parts.length ? parts.join(' | ') : '---';
    }
    // Avatar: show real picture if available, else colored initials
    if (session.avatarUrl) {
        AppDB.set('playerAvatar', session.avatarUrl);
        showAvatarImg(session.avatarUrl);
    } else {
        var localAvatar = AppDB.get('playerAvatar', '');
        if (localAvatar && localAvatar.indexOf('http') === 0) {
            showAvatarImg(localAvatar);
        } else {
            // Fallback: colored initials
            var av = document.getElementById('ppAvatarPlaceholder');
            if (av && session.name) {
                var initials = session.name.trim().split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
                av.textContent = initials || '?';
                var colors = ['#7c4dff','#00e5ff','#00e676','#ff9100','#f50057','#2979ff','#00bcd4','#8bc34a'];
                var hash = 0;
                for (var ci=0; ci<session.name.length; ci++) hash += session.name.charCodeAt(ci);
                av.style.background = colors[hash % colors.length];
            }
        }
    }
    // Login status badge
    var loginStatusEl = document.getElementById('ppLoginStatus');
    if (loginStatusEl) { loginStatusEl.textContent = '● Online'; loginStatusEl.style.color = 'var(--success)'; }
}

// Login button
document.getElementById('loginBtn').addEventListener('click', function() {
    var idVal   = document.getElementById('loginIdInput').value.trim();
    var passVal = document.getElementById('loginPassInput').value.trim();
    var errEl   = document.getElementById('loginErr');
    var btn     = this;

    errEl.textContent = '';
    if (!idVal || !passVal) {
        errEl.textContent = 'ID aur password dono likhein.';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="login-spin"></span>Check ho raha hai...';

    // Use fetch with GET - GAS allows GET requests without CORS issues
    var url = GS_SCRIPT_URL
        + '?action=login'
        + '&playerId=' + encodeURIComponent(idVal)
        + '&password=' + encodeURIComponent(passVal);

    fetch(url, { method: 'GET', redirect: 'follow' })
    .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
    })
    .then(function(text) {
        // Response might be JSONP wrapped: callback({...}) or plain JSON
        var json = text.trim();
        if (json.indexOf('{') !== 0) {
            // Strip JSONP wrapper if present
            json = json.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
        }
        var data = JSON.parse(json);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        if (data.success) {
            var session = {
                playerId : data.playerId,
                name     : data.name || idVal,
                token    : data.token,
                mobile   : data.mobile   || '',
                region   : data.region   || '',
                brand    : data.brand    || '',
                city     : data.city     || '',
                avatarUrl: data.avatarUrl || '',
                // expires: removed
            };
            gsSetSession(session);

            // Restore game data from GS (authoritative)
            // GS returns: coins, totalScans, coinsEarned, coinsSpent, adsWatched, level
            var gsCoins = data.coins !== undefined ? parseInt(data.coins) : 
                          data.coinsBalance !== undefined ? parseInt(data.coinsBalance) : null;
            var gsScans = data.totalScans !== undefined ? parseInt(data.totalScans) : null;
            var gsEarned = data.coinsEarned !== undefined ? parseInt(data.coinsEarned) : null;
            var gsSpent  = data.coinsSpent  !== undefined ? parseInt(data.coinsSpent)  : null;
            var gsAds    = data.adsWatched  !== undefined ? parseInt(data.adsWatched)  : null;
            var gsLevel  = data.level       !== undefined ? parseInt(data.level)       : null;

            if (gsCoins !== null && !isNaN(gsCoins))  { coins = Math.max(0, gsCoins); AppDB.set('coins', coins); }
            if (gsScans !== null && !isNaN(gsScans))  { totalScans = Math.max(0, gsScans); AppDB.set('totalScans', totalScans); }
            if (gsEarned !== null && !isNaN(gsEarned)) AppDB.set('coinsEarned', gsEarned);
            if (gsSpent  !== null && !isNaN(gsSpent))  AppDB.set('coinsSpent',  gsSpent);
            if (gsAds    !== null && !isNaN(gsAds))    AppDB.set('adsWatched',   gsAds);
            if (gsLevel  !== null && !isNaN(gsLevel))  { level = Math.max(1, gsLevel); }

            updateGameBar();
            gsUpdateUI(session);
            hideLoginOverlay();
            showToast('Welcome ' + session.name + '!', 'success', 2500);
            // DB load — login ke baad brand pata chala
            if (typeof initDatabase === 'function') initDatabase();
        } else {
            errEl.textContent = data.message || 'Login fail hua.';
        }
    })
    .catch(function(err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        errEl.textContent = 'Error: ' + err.message;
    });
});

// Enter key on password field
document.getElementById('loginPassInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

// SIGNUP BUTTON
document.getElementById('signupBtn').addEventListener('click', function() {
    var btn     = this;
    var errEl   = document.getElementById('signupErr');
    errEl.textContent = '';

    var empCode = document.getElementById('suEmpCode').value.trim();
    var name    = document.getElementById('suName').value.trim();
    var mobile  = document.getElementById('suMobile').value.trim();
    var region  = document.getElementById('suRegion').value;
    var city    = document.getElementById('suCity').value.trim() || document.getElementById('suCityInput').value.trim();
    var brand   = document.getElementById('suBrand').value;

    // Validation
    if (!empCode) { errEl.textContent = 'Employee Code likhein.'; return; }
    if (empCode.length < 3) { errEl.textContent = 'Employee Code kam az kam 3 characters ka hona chahiye.'; return; }
    if (!name)   { errEl.textContent = 'Naam likhein.'; return; }
    if (!mobile) { errEl.textContent = 'Mobile number likhein.'; return; }
    if (!/^[0-9]{11}$/.test(mobile)) { errEl.textContent = 'Mobile number exactly 11 digits ka hona chahiye (e.g. 03001234567).'; return; }
    if (!region) { errEl.textContent = 'Region select karein.'; return; }
    if (!city)   { errEl.textContent = 'City search karein aur select karein.'; return; }
    if (!brand)  { errEl.textContent = 'Brand select karein.'; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="login-spin"></span>Account ban raha hai...';

    var url = GS_SCRIPT_URL
        + '?action=signup'
        + '&empCode='   + encodeURIComponent(empCode)
        + '&name='      + encodeURIComponent(name)
        + '&mobile='    + encodeURIComponent(mobile)
        + '&region='    + encodeURIComponent(region)
        + '&city='      + encodeURIComponent(city)
        + '&brand='     + encodeURIComponent(brand);

    fetch(url, { method: 'GET', redirect: 'follow' })
    .then(function(r) { return r.text(); })
    .then(function(text) {
        var json = text.trim();
        if (json.indexOf('{') !== 0) {
            json = json.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
        }
        var data = JSON.parse(json);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Account Banayein';

        if (data.success) {
            var session = {
                playerId: empCode,
                name    : name,
                token   : data.token || '',
                mobile  : mobile,
                region  : region,
                city    : city,
                brand   : brand,
                // expires: removed
            };
            gsSetSession(session);
            gsUpdateUI(session);
            hideLoginOverlay();
            showToast('Account ban gaya! Welcome ' + name + '!', 'success', 3000);
            // DB load — signup ke baad brand pata chala
            if (typeof initDatabase === 'function') initDatabase();
        } else {
            errEl.textContent = data.message || 'Signup fail hua. Dobara try karein.';
        }
    })
    .catch(function(err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Account Banayein';
        errEl.textContent = 'Error: ' + err.message;
    });
});

// (logout handler below)

