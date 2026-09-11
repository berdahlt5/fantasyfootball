from pathlib import Path

p = Path("schedule-tool.html")
s = p.read_text()
marker = "/* schedule-focus-v3 */"
if marker in s:
    print("Already patched")
    raise SystemExit(0)

css = r'''
    /* schedule-focus-v3 */
    .metric-grid,.sidebar-panel{display:none!important}
    .content-grid{grid-template-columns:1fr!important;gap:12px}
    .controls{padding:12px 14px;margin-bottom:12px}
    .control-grid{grid-template-columns:110px minmax(145px,.9fr) minmax(165px,1fr)!important;gap:9px}
    .account-settings{margin:0 0 10px;border:1px solid rgba(132,186,215,.22);border-radius:10px;background:rgba(57,50,43,.52);overflow:hidden}
    .account-settings>summary{list-style:none;cursor:pointer;padding:8px 11px;color:var(--muted);font-size:.7rem;font-weight:1000;text-transform:uppercase;letter-spacing:.055em}
    .account-settings>summary::-webkit-details-marker{display:none}
    .account-settings>summary::after{content:' ▸';color:var(--gold)}
    .account-settings[open]>summary::after{content:' ▾'}
    .account-settings-body{display:grid;grid-template-columns:minmax(180px,1fr) 120px auto;gap:9px;align-items:end;padding:0 10px 10px}
    .league-filter,.live-scores-panel{padding:0!important;margin-bottom:10px!important;overflow:hidden}
    .league-filter>summary,.live-scores-panel>summary{list-style:none;cursor:pointer;padding:10px 14px;color:var(--mint);font-size:.8rem;font-weight:1000;display:flex;align-items:center;justify-content:space-between}
    .league-filter>summary::-webkit-details-marker,.live-scores-panel>summary::-webkit-details-marker{display:none}
    .league-filter>summary::after,.live-scores-panel>summary::after{content:'▸';color:var(--gold)}
    .league-filter[open]>summary::after,.live-scores-panel[open]>summary::after{content:'▾'}
    .league-filter .filter-head{display:none}
    .league-filter .league-chips{padding:0 12px 12px}
    .live-scores-panel .live-score-head{padding:0 12px 8px;margin:0}
    .live-scores-panel .live-score-head>div:first-child{display:none}
    .live-scores-panel .live-score-actions{margin-left:auto}
    .live-scores-panel .live-refresh-note{padding:0 12px 8px}
    .live-scores-panel .live-score-grid{padding:0 12px 12px}
    .section{padding:13px}
    .section-head{margin-bottom:8px}
    .section-note{font-size:.76rem}
    .games{display:grid;gap:10px}
    .game-card{border-radius:14px;overflow:hidden}
    .game-card .game-main{padding:11px 13px}
    .game-card .count{font-size:1.35rem}
    .game-card .count-caption{font-size:.61rem}
    .game-detail-summary{padding:7px 12px;border-top:1px solid rgba(132,186,215,.16);color:var(--muted);font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.045em;background:rgba(57,50,43,.35)}
    .game-league-groups{padding:8px 10px 10px!important;gap:7px!important}
    .game-league-block{border-radius:9px!important}
    .game-league-head{padding:7px 9px!important}
    .game-league-column{padding:7px 9px!important}
    .league-player-row{padding:5px 0!important}
    .past-game{opacity:.46!important;filter:grayscale(.65)}
    .past-game:hover{opacity:.66!important}
    @media(max-width:720px){
      .control-grid{grid-template-columns:1fr 1fr!important}
      .account-settings-body{grid-template-columns:1fr 1fr}
      .account-settings-body .primary{grid-column:1/-1}
      .game-league-columns{grid-template-columns:1fr!important}
    }
    @media(max-width:470px){.control-grid,.account-settings-body{grid-template-columns:1fr!important}}
'''
s = s.replace("</style>", css + "\n</style>", 1)

anchor = "    const state = {"
injection = r'''    const simplifyScheduleControls = () => {
      const grid = document.querySelector(".control-grid");
      if (!grid || document.querySelector(".account-settings")) return;
      const userLabel = els.username?.closest("label");
      const seasonLabel = els.season?.closest("label");
      if (!userLabel || !seasonLabel || !els.loadBtn) return;
      const details = document.createElement("details");
      details.className = "account-settings";
      details.innerHTML = '<summary>Account / reload settings</summary><div class="account-settings-body"></div>';
      const body = details.querySelector(".account-settings-body");
      body.append(userLabel, seasonLabel, els.loadBtn);
      grid.parentNode.insertBefore(details, grid);
    };
    simplifyScheduleControls();

'''
if anchor not in s:
    raise SystemExit("state anchor not found")
s = s.replace(anchor, injection + anchor, 1)

old = '<section class="panel league-filter" id="leagueFilter">'
if old not in s:
    raise SystemExit("league filter opening not found")
s = s.replace(old, '<details class="panel league-filter" id="leagueFilter"><summary>Leagues & priorities</summary>', 1)
old = '      <div class="league-chips" id="leagueChips"></div>\n    </section>\n\n    <section class="panel live-scores-panel" id="liveScoresPanel">'
new = '      <div class="league-chips" id="leagueChips"></div>\n    </details>\n\n    <details class="panel live-scores-panel" id="liveScoresPanel"><summary>Live league scores</summary>'
if old not in s:
    raise SystemExit("league/live transition not found")
s = s.replace(old, new, 1)
old = '      <div class="live-score-grid" id="liveScores">\n        <div class="empty">Load your Sleeper leagues to view scores.</div>\n      </div>\n    </section>\n\n    <div class="content-grid">'
new = '      <div class="live-score-grid" id="liveScores">\n        <div class="empty">Load your Sleeper leagues to view scores.</div>\n      </div>\n    </details>\n\n    <div class="content-grid">'
if old not in s:
    raise SystemExit("live/content transition not found")
s = s.replace(old, new, 1)

old = '''          <details>
            <summary>${game.uniqueCount} your player${game.uniqueCount === 1 ? "" : "s"} • ${game.opponentUniqueCount || 0} opponent player${game.opponentUniqueCount === 1 ? "" : "s"} • ${leagueGroups.length} league${leagueGroups.length === 1 ? "" : "s"}</summary>
            <div class="game-league-groups">${leagueDetails}</div>
          </details>'''
new = '''          <div class="game-detail-summary">${leagueGroups.length} league${leagueGroups.length === 1 ? "" : "s"} · ${game.uniqueCount} your player${game.uniqueCount === 1 ? "" : "s"} · ${game.opponentUniqueCount || 0} opponent player${game.opponentUniqueCount === 1 ? "" : "s"}</div>
          <div class="game-league-groups">${leagueDetails}</div>'''
if old not in s:
    raise SystemExit("game details block not found")
s = s.replace(old, new, 1)
s = s.replace('els.gamesTitle.textContent = `Week ${week} games`;', 'els.gamesTitle.textContent = `What to watch · Week ${week}`;', 1)

p.write_text(s)
print("Schedule simplification patch applied")
