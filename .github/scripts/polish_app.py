from pathlib import Path
import re

ROOT = Path('.')
HTML_FILES = [
    'index.html','home.html','schedule-tool.html','lineup-assistant.html',
    'crunchtime.html','team-rankings.html','waiver-wire-agent.html'
]

for name in HTML_FILES:
    path = ROOT / name
    text = path.read_text(encoding='utf-8')
    if 'app-shell.css' not in text:
        text = text.replace('</head>', '  <link rel="stylesheet" href="./app-shell.css" />\n</head>', 1)
    if 'app-shell.js' not in text:
        text = text.replace('</body>', '  <script src="./app-shell.js"></script>\n</body>', 1)
    path.write_text(text, encoding='utf-8')

# Lineup Assistant: best-ball leagues do not require lineup management.
path = ROOT / 'lineup-assistant.html'
text = path.read_text(encoding='utf-8')
text = text.replace(
    'const DEFAULT_PRIORITY=["gridiron gurus","tnt fantasy"];',
    'const DEFAULT_PRIORITY=["girdiron gurus","gridiron gurus","tnt fantasy"];'
)
text = text.replace(
    'const state={user:null,players:{},leagues:[],games:new Map(),news:[],loading:false,week:1,season:"2026",priorityNames:new Set()};',
    'const state={user:null,players:{},leagues:[],games:new Map(),news:[],loading:false,week:1,season:"2026",priorityNames:new Set(),skippedBestBall:0};'
)
old = 'const leagueViews=await Promise.all((leagues||[]).filter(l=>["in_season","pre_draft","drafting","post_season"].includes(l.status)||!l.status).map(async league=>{'
new = 'const activeLeagues=(leagues||[]).filter(l=>["in_season","pre_draft","drafting","post_season"].includes(l.status)||!l.status);const lineupLeagues=activeLeagues.filter(league=>!Boolean(Number(league.settings?.best_ball||0)));state.skippedBestBall=activeLeagues.length-lineupLeagues.length;const leagueViews=await Promise.all(lineupLeagues.map(async league=>{'
if old not in text:
    raise SystemExit('lineup league-load anchor not found')
text = text.replace(old, new, 1)
text = text.replace('owned Sleeper teams</div>', 'set-lineup leagues</div>', 1)
text = text.replace('Checks your starters for injury risk, questionable tags, kickoff timing, and FLEX-slot strategy across every Sleeper league.', 'Checks injury risk and FLEX timing only in leagues where you actually set a lineup. Best ball is skipped.')
text = text.replace('`<div class="empty">No owned leagues were found.</div>`', '`<div class="empty">No set-lineup leagues were found. Best-ball leagues are intentionally excluded from lineup checks.</div>`')
old_status = 'els.statusLine.textContent=`Checked ${analyzed.length} lineups for Week ${state.week}. Injury tags come from Sleeper; recent headline context comes from ESPN NFL news.`'
new_status = 'els.statusLine.textContent=`Checked ${analyzed.length} set-lineup league${analyzed.length===1?"":"s"} for Week ${state.week}.${state.skippedBestBall?` Skipped ${state.skippedBestBall} best-ball league${state.skippedBestBall===1?"":"s"}.`:""} Injury tags come from Sleeper; recent headline context comes from ESPN NFL news.`'
if old_status not in text:
    raise SystemExit('lineup status anchor not found')
text = text.replace(old_status, new_status, 1)
path.write_text(text, encoding='utf-8')

# Schedule Tool: settings-driven favorite team + screen capacity, selective labels,
# and no lineup warnings for best-ball leagues.
path = ROOT / 'schedule-tool.html'
text = path.read_text(encoding='utf-8')

fav_pattern = re.compile(r'    const SCHEDULE_FAVORITE_TEAM = \(\(\) => \{.*?    \}\)\(\);\n', re.S)
fav_replacement = '''    function scheduleFavoriteTeam() {
      try { return normalizeTeam(String(localStorage.getItem("fantasyFavoriteTeam") || "PHI").toUpperCase()); }
      catch (_) { return "PHI"; }
    }
    function scheduleWatchCount() {
      try {
        const value = Number(localStorage.getItem("fantasyWatchGameCount") || 4);
        return Number.isFinite(value) ? Math.max(1, Math.min(6, Math.round(value))) : 4;
      } catch (_) { return 4; }
    }
'''
text, n = fav_pattern.subn(fav_replacement, text, count=1)
if n != 1:
    raise SystemExit(f'favorite-team block replacements: {n}')
text = text.replace('includes(SCHEDULE_FAVORITE_TEAM)', 'includes(scheduleFavoriteTeam())')
text = text.replace('const starredMine = myAll.filter(player => [...player.leagues].some(name => isPriorityLeagueName(name)));', 'const starredMine = mySkill.filter(player => [...player.leagues].some(name => isPriorityLeagueName(name)));')
text = text.replace('const starredOpp = oppAll.filter(player => [...player.leagues].some(name => isPriorityLeagueName(name)));', 'const starredOpp = oppSkill.filter(player => [...player.leagues].some(name => isPriorityLeagueName(name)));')

old_score = '''      let score = 0;
      for (const exposure of mySkillExp) {
        score += 24 + (isPriorityLeagueName(exposure.leagueName) ? 14 : 0);
        score += Math.min(12, scheduleProjectionForExposure(exposure) * 0.42);
      }
      for (const exposure of oppSkillExp) {
        score += 4 + (isPriorityLeagueName(exposure.leagueName) ? 3 : 0);
        score += Math.min(2.5, scheduleProjectionForExposure(exposure) * 0.08);
      }
      for (const exposure of mySpecialExp) score += 1.2 + (isPriorityLeagueName(exposure.leagueName) ? 0.8 : 0);
      for (const exposure of oppSpecialExp) score += 0.25;
      if (mySkill.length > 1) score += (mySkill.length - 1) * 5;
      if (favorite) score += 70;'''
new_score = '''      let score = 0;
      for (const exposure of mySkillExp) {
        const factor = exposure.isBestBall ? 0.35 : 1;
        score += (24 + (isPriorityLeagueName(exposure.leagueName) ? 14 : 0)) * factor;
        score += Math.min(12, scheduleProjectionForExposure(exposure) * 0.42) * factor;
      }
      for (const exposure of oppSkillExp) {
        const factor = exposure.isBestBall ? 0.25 : 1;
        score += (4 + (isPriorityLeagueName(exposure.leagueName) ? 3 : 0)) * factor;
        score += Math.min(2.5, scheduleProjectionForExposure(exposure) * 0.08) * factor;
      }
      for (const exposure of mySpecialExp) score += (1.0 + (isPriorityLeagueName(exposure.leagueName) ? 0.5 : 0)) * (exposure.isBestBall ? 0.3 : 1);
      for (const exposure of oppSpecialExp) score += 0.15 * (exposure.isBestBall ? 0.3 : 1);
      if (mySkill.length > 1) score += (mySkill.length - 1) * 4;
      if (favorite) score += 100;'''
if old_score not in text:
    raise SystemExit('schedule scoring anchor not found')
text = text.replace(old_score, new_score, 1)

old_labels = '''      let tier = "skip", label = "Low Interest";
      if (completed) { tier = "final"; label = "Final"; }
      else if (crunch.some(item => item.must)) { tier = "must"; label = "Must Watch"; }
      else if (favorite) { tier = "must"; label = "Eagles · Always Watch"; }
      else if (mySkill.length && starredMine.length) { tier = "must"; label = "Very High"; }
      else if (mySkill.length) { tier = "watch"; label = "High Interest"; }
      else if (oppSkill.length) { tier = "radar"; label = "Some Interest"; }
      else if (mySpecialExp.length) { tier = "skip"; label = "Low · K/DEF"; }'''
new_labels = '''      let tier = "skip", label = "No fantasy stake";
      if (completed) { tier = "final"; label = "Final"; }
      else if (crunch.some(item => item.must)) { tier = "must"; label = "Must Watch"; }
      else if (favorite) { tier = "must"; label = "Favorite · Must Watch"; }
      else if (mySkill.length && starredMine.length) { tier = "watch"; label = "High fantasy relevance"; }
      else if (mySkill.length) { tier = "watch"; label = "Fantasy relevance"; }
      else if (oppSkill.length) { tier = "radar"; label = "Opponent relevance"; }
      else if (mySpecialExp.length) { tier = "skip"; label = "K/DEF only"; }'''
if old_labels not in text:
    raise SystemExit('schedule label anchor not found')
text = text.replace(old_labels, new_labels, 1)

# Schedule's integrated lineup pulse should also skip best-ball leagues.
old_selected = 'const selected = (state.leagues || []).filter(league => state.selectedLeagueIds.has(league.league_id));'
new_selected = 'const selected = (state.leagues || []).filter(league => state.selectedLeagueIds.has(league.league_id) && !league.isBestBall);'
if old_selected not in text:
    raise SystemExit('lineup pulse selection anchor not found')
text = text.replace(old_selected, new_selected, 1)

# Let ranked window context control the user-facing label.
old_sig = 'function renderGame(game, kickoffMode = false, kickoffColorMap = new Map()) {'
new_sig = 'function renderGame(game, kickoffMode = false, kickoffColorMap = new Map(), watchContext = null) {'
if old_sig not in text:
    raise SystemExit('renderGame signature anchor not found')
text = text.replace(old_sig, new_sig, 1)
old_analysis = '      const analysis = watchAnalysis(game);\n      const kickoff = formatKickoffLabel(game.date, game.status || "TBD");'
new_analysis = '      const analysis = watchAnalysis(game);\n      const displayTier = watchContext?.tier || analysis.tier;\n      const displayLabel = watchContext?.label || analysis.label;\n      const kickoff = formatKickoffLabel(game.date, game.status || "TBD");'
if old_analysis not in text:
    raise SystemExit('renderGame analysis anchor not found')
text = text.replace(old_analysis, new_analysis, 1)
text = text.replace('${analysis.tier === "must" ? "priority-game" : ""}', '${displayTier === "must" ? "priority-game" : ""}', 1)
text = text.replace('${analysis.favorite ? `<div class="favorite-watch">🦅 Eagles game</div>` : ""}', '${analysis.favorite ? `<div class="favorite-watch">Favorite team · ${escapeHtml(scheduleFavoriteTeam())}</div>` : ""}', 1)
text = text.replace('<div class="watch-tier ${analysis.tier}">${escapeHtml(analysis.label)}</div>', '<div class="watch-tier ${displayTier}">${escapeHtml(displayLabel)}</div>', 1)

old_window = '''          group.games.sort((a,b) => watchAnalysis(b).score - watchAnalysis(a).score || new Date(a.date) - new Date(b.date));
          const single = group.games.length === 1;
          const note = single ? `Importance: ${watchAnalysis(group.games[0]).label}` : `Ranked for your screens`;
          return `<section class="watch-window">
            <div class="watch-window-head"><div class="watch-window-title">${escapeHtml(group.info.label)}</div><div class="watch-window-note">${escapeHtml(note)}</div></div>
            <div class="watch-window-games">${group.games.map((game,index) => `<div class="window-ranked-game">${single ? "" : `<div class="window-rank">#${index + 1} this window</div>`}${renderGame(game,kickoffMode,kickoffColorMap)}</div>`).join("")}</div>
          </section>`;'''
new_window = '''          group.games.sort((a,b) => watchAnalysis(b).score - watchAnalysis(a).score || new Date(a.date) - new Date(b.date));
          const single = group.games.length === 1;
          const capacity = scheduleWatchCount();
          const recommended = Math.min(capacity, group.games.length);
          const note = single ? `Fantasy importance: ${watchAnalysis(group.games[0]).label}` : `Top ${recommended} recommended · ${group.games.length} games`;
          return `<section class="watch-window">
            <div class="watch-window-head"><div class="watch-window-title">${escapeHtml(group.info.label)}</div><div class="watch-window-note">${escapeHtml(note)}</div></div>
            <div class="watch-window-games">${group.games.map((game,index) => {
              const analysis = watchAnalysis(game);
              let context = null;
              if (!single) {
                if (analysis.crunch.some(item => item.must)) context = { tier: "must", label: "Must Watch" };
                else if (analysis.favorite) context = { tier: "must", label: "Favorite · Must Watch" };
                else if (index < capacity) context = { tier: "watch", label: `Watch #${index + 1}` };
                else if (analysis.myCount > 0) context = { tier: "radar", label: "Backup option" };
                else if (analysis.opponentCount > 0) context = { tier: "radar", label: "Opponent only" };
                else context = { tier: "skip", label: "Low priority" };
              }
              return `<div class="window-ranked-game">${single ? "" : `<div class="window-rank">#${index + 1} this window${index < capacity ? " · recommended" : ""}</div>`}${renderGame(game,kickoffMode,kickoffColorMap,context)}</div>`;
            }).join("")}</div>
          </section>`;'''
if old_window not in text:
    raise SystemExit('watch-window renderer anchor not found')
text = text.replace(old_window, new_window, 1)

# Rerender immediately when Settings changes.
listener_anchor = '    els.scope.addEventListener("change", renderAll);'
if listener_anchor not in text:
    raise SystemExit('settings listener anchor not found')
text = text.replace(listener_anchor, '    window.addEventListener("fantasy-settings-changed", () => renderAll());\n' + listener_anchor, 1)

# Make the schedule copy describe the actual decision rather than generic exposure counts.
text = text.replace('See how many players and roster exposures you have in every NFL game across all of your Sleeper leagues.', 'Fix lineup issues first, then see which NFL games matter most to your fantasy teams.')
path.write_text(text, encoding='utf-8')

print('polish patch complete')
