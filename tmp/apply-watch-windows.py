from pathlib import Path
p=Path('schedule-tool.html')
s=p.read_text()
marker='/* watch-windows-v1 */'
if marker in s:
    raise SystemExit(0)
css='''
    /* watch-windows-v1 */
    .watch-window{margin-bottom:14px}
    .watch-window-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 2px 8px;padding:0 2px}
    .watch-window-title{font-size:.92rem;font-weight:1000;color:var(--taupe)}
    html[data-theme="dark"] .watch-window-title{color:var(--ivory)}
    .watch-window-note{font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.055em;color:rgba(46,40,35,.6)}
    html[data-theme="dark"] .watch-window-note{color:rgba(255,255,237,.58)}
    .watch-window-games{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .window-top-pick{position:relative}
    .window-top-pick>.top-pick-label{display:inline-flex;margin:0 0 5px 2px;padding:3px 7px;border-radius:999px;background:rgba(216,169,74,.18);border:1px solid rgba(216,169,74,.45);color:#8A6418;font-size:.58rem;font-weight:1000;text-transform:uppercase;letter-spacing:.05em}
    html[data-theme="dark"] .window-top-pick>.top-pick-label{color:#F0CA78}
    @media(max-width:860px){.watch-window-games{grid-template-columns:1fr}}
'''
s=s.replace('</style>',css+'\n</style>',1)
helper='''
    function watchWindowInfo(game) {
      const date = new Date(game.date);
      if (Number.isNaN(date.getTime())) return { key: "other", label: "Other games", order: 99 };
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true
      }).formatToParts(date).reduce((acc, part) => (acc[part.type] = part.value, acc), {});
      const weekday = parts.weekday || "";
      let hour = Number(parts.hour || 0);
      const minute = Number(parts.minute || 0);
      const dayPeriod = String(parts.dayPeriod || "").toUpperCase();
      if (dayPeriod === "PM" && hour !== 12) hour += 12;
      if (dayPeriod === "AM" && hour === 12) hour = 0;

      if (weekday === "Sun" && hour < 12) return { key: "sun-morning", label: "Sunday morning", order: 10 };
      if (weekday === "Sun" && hour >= 12 && hour < 15) return { key: "sun-early", label: "1:00 PM window", order: 20 };
      if (weekday === "Sun" && hour >= 15 && hour < 19) return { key: "sun-late", label: "4:00 PM window", order: 30 };
      if (weekday === "Sun" && hour >= 19) return { key: "snf", label: "Sunday Night Football", order: 40 };
      if (weekday === "Mon" && hour >= 17) return { key: "mnf", label: "Monday Night Football", order: 50 };
      if (weekday === "Thu" && hour >= 17) return { key: "tnf", label: "Thursday Night Football", order: 5 };
      const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(date);
      return { key: `${weekday}-${hour}-${minute}`, label: `${weekday} ${time}`, order: 60 + date.getTime()/1e13 };
    }

    function renderWatchWindows(games, kickoffMode, kickoffColorMap) {
      const groups = new Map();
      for (const game of games) {
        const info = watchWindowInfo(game);
        if (!groups.has(info.key)) groups.set(info.key, { info, games: [] });
        groups.get(info.key).games.push(game);
      }
      return [...groups.values()]
        .sort((a,b) => a.info.order - b.info.order)
        .map(group => {
          group.games.sort((a,b) => watchAnalysis(b).score - watchAnalysis(a).score || new Date(a.date) - new Date(b.date));
          return `<section class="watch-window">
            <div class="watch-window-head"><div class="watch-window-title">${escapeHtml(group.info.label)}</div><div class="watch-window-note">Top game first</div></div>
            <div class="watch-window-games">${group.games.map((game,index) => `${index===0 ? '<div class="window-top-pick"><div class="top-pick-label">Top pick this window</div>' : '<div>'}${renderGame(game,kickoffMode,kickoffColorMap)}</div>`).join("")}</div>
          </section>`;
        }).join("");
    }

'''
anchor='    function renderAll() {'
if anchor not in s: raise SystemExit('renderAll anchor missing')
s=s.replace(anchor,helper+anchor,1)
old='''      els.games.innerHTML = displayRows.length
        ? displayRows.map(game => renderGame(game, kickoffMode, kickoffColorMap)).join("")
        : `<div class="empty">No games currently rate as worth tracking. Change the sort to Kickoff time to see the full NFL slate.</div>`;'''
new='''      els.games.innerHTML = displayRows.length
        ? (watchMode ? renderWatchWindows(displayRows, kickoffMode, kickoffColorMap) : displayRows.map(game => renderGame(game, kickoffMode, kickoffColorMap)).join(""))
        : `<div class="empty">No games currently rate as worth tracking. Change the sort to Kickoff time to see the full NFL slate.</div>`;'''
if old not in s: raise SystemExit('games render block missing')
s=s.replace(old,new,1)
s=s.replace('`${displayRows.length} games worth tracking. Unrelated and K/DEF-only games are hidden unless they become a Crunchtime decider.`','`${displayRows.length} games worth tracking, grouped by kickoff window and ranked within each window. Unrelated and K/DEF-only games are hidden unless they become a Crunchtime decider.`',1)
p.write_text(s)
