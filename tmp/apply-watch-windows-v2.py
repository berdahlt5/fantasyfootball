from pathlib import Path
p=Path('schedule-tool.html')
s=p.read_text()
marker='/* watch-windows-v2 */'
if marker in s:
    raise SystemExit(0)

css='''
    /* watch-windows-v2 */
    .games.watch-window-mode{display:block!important;grid-template-columns:1fr!important}
    .games.watch-window-mode .watch-window{display:block;width:100%;margin-bottom:18px}
    .games.watch-window-mode .watch-window-games{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    @media(max-width:980px){.games.watch-window-mode .watch-window-games{grid-template-columns:1fr}}
'''
s=s.replace('</style>',css+'\n</style>',1)

old='''      const mySkill = groupPlayerExposures((game.exposures || []).filter(item => WATCH_SKILL_POSITIONS.has(String(item.position || "").toUpperCase())));
      const oppSkill = groupPlayerExposures((game.opponentExposures || []).filter(item => WATCH_SKILL_POSITIONS.has(String(item.position || "").toUpperCase())));'''
new='''      const mySkill = groupPlayerExposures((game.exposures || []).filter(item => WATCH_SKILL_POSITIONS.has(String(item.position || "").toUpperCase())));
      const oppSkill = groupPlayerExposures((game.opponentExposures || []).filter(item => WATCH_SKILL_POSITIONS.has(String(item.position || "").toUpperCase())));
      const mySpecial = groupPlayerExposures((game.exposures || []).filter(item => ["K","DEF","DST"].includes(String(item.position || "").toUpperCase())));
      const oppSpecial = groupPlayerExposures((game.opponentExposures || []).filter(item => ["K","DEF","DST"].includes(String(item.position || "").toUpperCase())));'''
if old not in s: raise SystemExit('watchAnalysis player block missing')
s=s.replace(old,new,1)

old='''      let score = mySkill.length * 3 + oppSkill.length * 2 + starredMine.length * 5 + starredOpp.length * 3 + priorityLeagueIds.size * 2;
      if (mySkill.length >= 2) score += 2;'''
new='''      let score = mySkill.length * 3 + oppSkill.length * 2 + starredMine.length * 5 + starredOpp.length * 3 + priorityLeagueIds.size * 2;
      if (!mySkill.length && !oppSkill.length) score += mySpecial.length * 0.35 + oppSpecial.length * 0.15;
      if (mySkill.length >= 2) score += 2;'''
if old not in s: raise SystemExit('watchAnalysis score block missing')
s=s.replace(old,new,1)

s=s.replace('if (weekday === "Sun" && hour < 12) return { key: "sun-morning", label: "Sunday morning", order: 10 };',
'''if (weekday === "Fri") return { key: "fri", label: "Friday", order: 7 };
      if (weekday === "Sat") return { key: "sat", label: "Saturday", order: 8 };
      if (weekday === "Sun" && hour < 12) return { key: "sun-morning", label: "Sunday morning", order: 10 };''',1)
s=s.replace('label: "1:00 PM window"','label: "Sunday · 1:00 PM window"',1)
s=s.replace('label: "4:00 PM window"','label: "Sunday · 4:00 PM window"',1)

old='''      const watchMode = els.sort.value === "watch";
      const displayRows = watchMode
        ? gameRows.filter(game => !game.completed && String(game.statusState || "").toLowerCase() !== "post" && watchAnalysis(game).score > 0)
        : gameRows;

      els.gamesNote.textContent = watchMode
        ? `${displayRows.length} games worth tracking, grouped by kickoff window and ranked within each window. Unrelated and K/DEF-only games are hidden unless they become a Crunchtime decider.`'''
new='''      const watchMode = els.sort.value === "watch";
      const displayRows = gameRows;
      els.games.classList.toggle("watch-window-mode", watchMode);

      els.gamesNote.textContent = watchMode
        ? `Full NFL slate grouped chronologically by kickoff window. Games are ranked within each window; no-exposure and K/DEF-only games remain visible at lower priority unless Crunchtime elevates them.`'''
if old not in s: raise SystemExit('displayRows block missing')
s=s.replace(old,new,1)

old='''        : `<div class="empty">No games currently rate as worth tracking. Change the sort to Kickoff time to see the full NFL slate.</div>`;'''
new='''        : `<div class="empty">No NFL games were returned for this week.</div>`;'''
if old not in s: raise SystemExit('empty state missing')
s=s.replace(old,new,1)

p.write_text(s)
