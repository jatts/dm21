/* ═══════════════════════════════════════
   STATS PAGE
═══════════════════════════════════════ */

// ACHIEVEMENTS - extensive list
const ACHIEVEMENTS = [
    // Scan milestones
    { id:'s1',    icon:'\uD83C\uDFAF', label:'First Scan',    req:(s)=>s>=1      },
    { id:'s5',    icon:'\u270B', label:'5 Scans',        req:(s)=>s>=5      },
    { id:'s10',   icon:'\u26A1', label:'10 Scans',       req:(s)=>s>=10     },
    { id:'s25',   icon:'\uD83D\uDCAB', label:'25 Scans',       req:(s)=>s>=25     },
    { id:'s50',   icon:'\uD83D\uDD25', label:'50 Scans',       req:(s)=>s>=50     },
    { id:'s100',  icon:'\uD83D\uDCAF', label:'100 Scans',      req:(s)=>s>=100    },
    { id:'s250',  icon:'\uD83C\uDF1F', label:'250 Scans',      req:(s)=>s>=250    },
    { id:'s500',  icon:'\uD83D\uDE80', label:'500 Scans',      req:(s)=>s>=500    },
    { id:'s1k',   icon:'\uD83D\uDC51', label:'1K Scans',       req:(s)=>s>=1000   },
    { id:'s2k',   icon:'\uD83C\uDFC6', label:'2K Scans',       req:(s)=>s>=2000   },
    { id:'s5k',   icon:'\uD83D\uDC8E', label:'5K Scans',       req:(s)=>s>=5000   },
    { id:'s10k',  icon:'\uD83C\uDF08', label:'10K Scans',      req:(s)=>s>=10000  },
    { id:'s25k',  icon:'\uD83D\uDD2E', label:'25K Scans',      req:(s)=>s>=25000  },
    { id:'s50k',  icon:'\u269C\uFE0F', label:'50K Scans',      req:(s)=>s>=50000  },
    { id:'s100k', icon:'\uD83C\uDF0C', label:'100K Scans',     req:(s)=>s>=100000 },
    // Level milestones
    { id:'l2',    icon:'\uD83C\uDFC5', label:'Level 2',        req:(_,l)=>l>=2    },
    { id:'l3',    icon:'\uD83E\uDD49', label:'Level 3',        req:(_,l)=>l>=3    },
    { id:'l5',    icon:'\uD83E\uDD48', label:'Level 5',        req:(_,l)=>l>=5    },
    { id:'l10',   icon:'\uD83E\uDD47', label:'Level 10',       req:(_,l)=>l>=10   },
    { id:'l20',   icon:'\uD83C\uDF96\uFE0F', label:'Level 20',       req:(_,l)=>l>=20   },
    { id:'l50',   icon:'\uD83C\uDF97\uFE0F', label:'Level 50',       req:(_,l)=>l>=50   },
    { id:'l100',  icon:'\uD83C\uDFF5\uFE0F', label:'Level 100',      req:(_,l)=>l>=100  },
];

// RANKS - extensive, never-ending
const RANKS = [
    { min:0,      icon:'\uD83E\uDEA8', title:'Novice',         desc:'Abhi shuru kiya hai!',              badge:'Rank 1'  },
    { min:10,     icon:'\uD83E\uDD49', title:'Beginner',        desc:'Thodi practice ho gayi.',           badge:'Rank 2'  },
    { min:50,     icon:'\uD83E\uDD48', title:'Apprentice',      desc:'Ab thoda tezz ho gaye.',            badge:'Rank 3'  },
    { min:100,    icon:'\uD83E\uDD47', title:'Scanner',         desc:'Scanning aati hai tumhe!',          badge:'Rank 4'  },
    { min:250,    icon:'\u2B50', title:'Pro Scanner',     desc:'Pro level mil gaya!',               badge:'Rank 5'  },
    { min:500,    icon:'\uD83C\uDF1F', title:'Expert',          desc:'Expert ban gaye ho!',               badge:'Rank 6'  },
    { min:1000,   icon:'\uD83D\uDC8E', title:'Elite',           desc:'Elite club mein welcome!',          badge:'Rank 7'  },
    { min:2000,   icon:'\uD83C\uDFC6', title:'Champion',        desc:'Champion ki tarah scan karte ho!',  badge:'Rank 8'  },
    { min:5000,   icon:'\uD83D\uDE80', title:'Master',          desc:'Master scanner — koi roka nahi!',   badge:'Rank 9'  },
    { min:10000,  icon:'\uD83D\uDC51', title:'Grand Master',    desc:'Grand Master status haasil!',       badge:'Rank 10' },
    { min:25000,  icon:'\uD83D\uDD2E', title:'Legend',          desc:'Legend ho tum! Masha Allah!',       badge:'Rank 11' },
    { min:50000,  icon:'\u269C\uFE0F', title:'Mythic',          desc:'Mythic tier - impossible level!',   badge:'Rank 12' },
    { min:100000, icon:'\uD83C\uDF0C', title:'Godlike',         desc:'Godlike scanner. Unprecedented!',   badge:'Rank 13' },
];

function updateStatsPage() {
    const el = id => document.getElementById(id);

    // Stats grid
    el('statTotalScans').textContent = totalScans;
    el('statCoins').textContent      = coins;
    el('statLevelBadge').textContent = `Lvl ${level}`;

    // Level bar
    const prevT = level===1?0:getThreshold(level-1);
    const nextT = getThreshold(level);
    const pct   = nextT>prevT ? ((totalScans-prevT)/(nextT-prevT))*100 : 0;
    el('bigScanFill').style.width  = `${Math.max(0,Math.min(pct,100))}%`;
    el('levelSubText').textContent = `${totalScans} / ${nextT} scans - Level ${level+1} ke liye`;

    // Today scans
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayCount = scanHistory.filter(r=>r.ts && r.ts >= todayStart.getTime()).length;
    el('statToday').textContent = todayCount;

    // Coins earned
    el('statCoinsEarned').textContent = AppDB.getInt('coinsEarned', 0);

    // Streak (FIX 8: was missing from stats display)
    var streakEl = el('statStreak');
    if (streakEl) streakEl.textContent = AppDB.getInt('scanStreak', 0);

    // Coins spent
    var spentEl = el('statCoinsSpent');
    if (spentEl) spentEl.textContent = AppDB.getInt('coinsSpent', 0);

    // Achievements - show all, locked ones greyed
    const grid = el('achievementsGrid');
    grid.innerHTML = ACHIEVEMENTS.map(a => {
        const unlocked = a.req(totalScans, level);
        return `<div class="ach-item ${unlocked?'unlocked':'locked'}">
            <div class="ach-icon">${a.icon}</div>
            <div class="ach-label">${a.label}</div>
        </div>`;
    }).join('');

    // Rank — merged with level display
    let rank = RANKS[0];
    for (let i = 0; i < RANKS.length; i++) {
        if (totalScans >= RANKS[i].min) rank = RANKS[i];
    }
    const nextRankIdx = RANKS.indexOf(rank) + 1;
    const nextRank = nextRankIdx < RANKS.length ? RANKS[nextRankIdx] : null;

    // Inline title line under level progress bar
    const iconEl  = document.getElementById('rankIconInline');
    const titleEl = document.getElementById('rankTitleInline');
    const descEl  = document.getElementById('rankDescInline');
    if (iconEl)  iconEl.textContent  = rank.icon;
    if (titleEl) titleEl.textContent = rank.title;
    if (descEl)  descEl.textContent  = nextRank
        ? nextRank.min + ' scans pe: ' + nextRank.title
        : rank.desc;

    // Gamebar small title
    const gbRank = document.getElementById('gbRankTitle');
    if (gbRank) gbRank.textContent = rank.title;

    // Level badge in stats — add title: "Lvl 2 · Scanner"
    const lvlBadge = document.getElementById('statLevelBadge');
    if (lvlBadge) lvlBadge.textContent = 'Lvl ' + level + ' · ' + rank.title;
}

