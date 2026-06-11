/* ═══════════════════════════════════════
   PLAYER PROFILE
═══════════════════════════════════════ */
(function() {
    function getPlayerId() {
        let id = AppDB.get('playerId');
        if (!id) {
            id = 'DM-' + Math.floor(100000 + Math.random() * 900000);
            AppDB.set('playerId', id);
        }
        return id;
    }
    function getJoinDate() {
        let d = AppDB.get('joinDate');
        if (!d) {
            d = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
            AppDB.set('joinDate', d);
        }
        return d;
    }

    function loadProfile() {
        const session = gsGetSession();
        const name    = (session && session.name) || AppDB.get('playerName', 'Player');
        AppDB.set('playerName', name);

        const ppNameEl = document.getElementById('ppName');
        const ppIdEl   = document.getElementById('ppId');
        const ppJoined = document.getElementById('ppJoined');
        if (ppNameEl) ppNameEl.textContent = name;
        if (ppIdEl)   ppIdEl.textContent   = (session && session.playerId) || getPlayerId();
        if (ppJoined) ppJoined.textContent  = 'Joined: ' + getJoinDate();

        // Avatar: URL from session/AppDB (Drive thumbnail) or hide
        const avatarUrl = (session && session.avatarUrl) || AppDB.get('playerAvatar', '');
        if (avatarUrl && avatarUrl.indexOf('http') === 0) {
            showAvatarImg(avatarUrl);
        } else {
            hideAvatarImg();
            // Show initials in placeholder if session available
            if (session && session.name) {
                const av = document.getElementById('ppAvatarPlaceholder');
                if (av) {
                    const inits = session.name.trim().split(' ')
                        .map(w => w[0]).join('').toUpperCase().slice(0,2);
                    av.textContent = inits || '?';
                    const colors = ['#7c4dff','#00e5ff','#00e676','#ff9100','#f50057','#2979ff','#00bcd4','#8bc34a'];
                    let h = 0;
                    for (let ci=0; ci<session.name.length; ci++) h += session.name.charCodeAt(ci);
                    av.style.background = colors[h % colors.length];
                }
            }
        }
    }

    loadProfile();

    // Edit name
    const ppEditBtn = document.getElementById('ppEditBtn');
    if (ppEditBtn) {
        ppEditBtn.addEventListener('click', () => {
            const s = gsGetSession();
            document.getElementById('ppNameInput').value = (s && s.name) || AppDB.get('playerName', '');
            document.getElementById('profileEditOverlay').style.display = 'flex';
        });
    }
    const ppSaveBtn = document.getElementById('ppSaveBtn');
    if (ppSaveBtn) {
        ppSaveBtn.addEventListener('click', () => {
            const name = document.getElementById('ppNameInput').value.trim() || 'Player';
            AppDB.set('playerName', name);
            loadProfile();
            document.getElementById('profileEditOverlay').style.display = 'none';
            showToast('Naam update ho gaya! \u2705', 'success');
        });
    }
    const ppCancelBtn = document.getElementById('ppCancelBtn');
    if (ppCancelBtn) {
        ppCancelBtn.addEventListener('click', () => {
            document.getElementById('profileEditOverlay').style.display = 'none';
        });
    }

    // Avatar upload → Drive → URL → Users sheet
    const ppAvatarEditBtn = document.getElementById('ppAvatarEditBtn');
    const ppAvatarInput   = document.getElementById('ppAvatarInput');
    if (ppAvatarEditBtn) {
        ppAvatarEditBtn.addEventListener('click', () => {
            var session = gsGetSession();
            if (!session) { showToast('Pehle login karein', 'error'); return; }
            ppAvatarInput.click();
        });
    }
    if (ppAvatarInput) {
        ppAvatarInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            // Reset input so same file can be re-selected
            this.value = '';
            uploadAvatarFile(file);
        });
    }
})();

