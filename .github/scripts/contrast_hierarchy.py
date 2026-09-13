from pathlib import Path

css_path = Path('app-shell.css')
css = css_path.read_text()
marker = '/* contrast-hierarchy-v2 */'
block = r'''

/* contrast-hierarchy-v2 */
:root{
  --app-bg:#f3f5f7;
  --app-surface:#ffffff;
  --app-surface-subtle:#f6f8fa;
  --app-border:#cfd6de;
  --app-text:#121a23;
  --app-muted:#526071;
  --app-accent:#245d8f;
  --app-accent-strong:#173f63;
  --app-accent-soft:#e4eff8;
  --app-success:#286846;
  --app-warning:#7a5200;
  --app-warning-soft:#fff1c7;
  --app-danger:#a32f3a;
  --app-danger-soft:#fde6e9;
}
html[data-theme="dark"]{
  --app-bg:#0d1116;
  --app-surface:#171d24;
  --app-surface-subtle:#202832;
  --app-border:#3a4654;
  --app-text:#f4f7fa;
  --app-muted:#bcc6d1;
  --app-accent:#8fc4ee;
  --app-accent-strong:#b8daf4;
  --app-accent-soft:#19344b;
  --app-success:#8ed3a8;
  --app-warning:#ffd27a;
  --app-warning-soft:#483617;
  --app-danger:#ff9ca4;
  --app-danger-soft:#47252b;
}

/* Stronger page hierarchy without reintroducing visual clutter. */
.topbar{border-bottom:3px solid var(--app-accent)!important}
.topbar h1,.brand h1{font-weight:900!important}
.panel{border-color:var(--app-border)!important}
.section-title,.filter-title,.watch-window-title{font-weight:900!important;color:var(--app-text)!important}
.section-note,.watch-window-note{color:var(--app-muted)!important;font-weight:700!important}
.metric-value{color:var(--app-accent-strong)!important;font-weight:950!important}

/* Navigation: selected destination should be immediately obvious. */
.app-nav-link.active,.app-more>summary.active{
  background:var(--app-accent)!important;color:#fff!important;border-color:var(--app-accent)!important;
  font-weight:850!important
}
html[data-theme="dark"] .app-nav-link.active,html[data-theme="dark"] .app-more>summary.active{color:#0d1116!important}
.app-settings-button{background:var(--app-surface-subtle)!important;border-color:var(--app-border)!important}

/* Watch guide hierarchy. */
.watch-window-head{padding:0 2px 7px!important;border-bottom:2px solid var(--app-border)!important}
.watch-window-title{font-size:1rem!important;letter-spacing:-.01em!important}
.window-ranked-game{padding-top:20px!important}
.window-rank{font-size:.61rem!important;font-weight:900!important;color:var(--app-muted)!important}
.window-ranked-game.recommended .window-rank{
  display:inline-flex;align-items:center;width:max-content;padding:3px 7px;border-radius:999px;
  background:var(--app-accent)!important;color:#fff!important;letter-spacing:.035em!important
}
html[data-theme="dark"] .window-ranked-game.recommended .window-rank{color:#0d1116!important}
.window-ranked-game.recommended .game-card{
  border:2px solid color-mix(in srgb,var(--app-accent) 72%, var(--app-border))!important;
  box-shadow:inset 4px 0 0 var(--app-accent)!important;
  background:color-mix(in srgb,var(--app-accent) 4%, var(--app-surface))!important
}
.window-ranked-game.must-watch .game-card{
  border-color:var(--app-accent)!important;
  box-shadow:inset 6px 0 0 var(--app-accent)!important
}
.watch-tier{font-weight:900!important;letter-spacing:.015em!important}
.watch-tier.must{
  background:var(--app-accent)!important;color:#fff!important;border-color:var(--app-accent)!important
}
html[data-theme="dark"] .watch-tier.must{color:#0d1116!important}
.watch-tier.watch{
  background:var(--app-accent-soft)!important;color:var(--app-accent-strong)!important;
  border:1px solid color-mix(in srgb,var(--app-accent) 50%, var(--app-border))!important
}
.watch-tier.radar{color:var(--app-text)!important;border-color:var(--app-border)!important;background:var(--app-surface-subtle)!important}
.watch-tier.skip,.watch-tier.final{color:var(--app-muted)!important;background:var(--app-surface-subtle)!important;opacity:1!important}
.watch-teams{font-size:.93rem!important;font-weight:900!important}
.watch-time{font-weight:700!important}
.watch-count{color:var(--app-muted)!important}
.watch-count strong{font-size:.76rem!important;color:var(--app-text)!important}

/* Starred / favorite context gets amber, and only amber. */
.league-control.priority{
  border:2px solid color-mix(in srgb,var(--app-warning) 60%, var(--app-border))!important;
  box-shadow:inset 4px 0 0 var(--app-warning)!important;background:var(--app-warning-soft)!important
}
.priority-badge,.favorite-watch{
  background:var(--app-warning)!important;color:#fff!important;border-color:var(--app-warning)!important;font-weight:900!important
}
html[data-theme="dark"] .priority-badge,html[data-theme="dark"] .favorite-watch{color:#1d1606!important}
.watch-count.starred{background:var(--app-warning-soft)!important;color:var(--app-warning)!important;border-color:color-mix(in srgb,var(--app-warning) 42%, var(--app-border))!important}
.watch-count.starred strong{color:var(--app-warning)!important}
.priority-star[aria-pressed="true"]{color:var(--app-warning)!important;background:color-mix(in srgb,var(--app-warning) 16%, var(--app-surface))!important}

/* Lineup health: use strong left-edge signals and high-contrast titles. */
.lineup-issue,.alert{border-width:1px!important}
.lineup-issue.critical,.alert.critical{border-left:5px solid var(--app-danger)!important}
.lineup-issue.warn,.alert.warn{border-left:5px solid var(--app-warning)!important}
.lineup-issue.timing{border-left:5px solid var(--app-accent)!important}
.lineup-issue-title{color:var(--app-text)!important;font-weight:900!important}
.lineup-issue.critical .lineup-issue-title{color:var(--app-danger)!important}
.lineup-issue.warn .lineup-issue-title{color:var(--app-warning)!important}
.lineup-clear{border-left:5px solid var(--app-success)!important;font-weight:850!important}

/* Live score state should remain obvious. */
.live-score-card.leading{border-left:5px solid var(--app-success)!important}
.live-score-card.trailing{border-left:5px solid var(--app-danger)!important}
.live-score-card.tied{border-left:5px solid var(--app-accent)!important}
.live-team-score{color:var(--app-text)!important;font-weight:950!important}
.live-team-score.winning,.live-team-projection.winning{color:var(--app-success)!important}
.live-team-score.losing,.live-team-projection.losing{color:var(--app-danger)!important}

/* Keep secondary content quiet so the hierarchy above works. */
.watch-details>summary,.player-sub,.player-meta,.impact-pos,.impact-proj,.impact-none,.headline-meta,.league-meta{color:var(--app-muted)!important}
.impact-help{color:var(--app-success)!important;font-weight:800!important}.impact-hurt{color:var(--app-danger)!important;font-weight:800!important}
'''
if marker not in css:
    css_path.write_text(css + block)

sched = Path('schedule-tool.html')
s = sched.read_text()
old = '''              return `<div class="window-ranked-game">${single ? "" : `<div class="window-rank">#${index + 1} this window${index < capacity ? " · recommended" : ""}</div>`}${renderGame(game,kickoffMode,kickoffColorMap,context)}</div>`;'''
new = '''              const mustWatch = analysis.crunch.some(item => item.must) || analysis.favorite;
              const recommendedGame = !single && (mustWatch || index < capacity);
              const rowClass = `window-ranked-game${recommendedGame ? " recommended" : ""}${mustWatch ? " must-watch" : ""}`;
              return `<div class="${rowClass}">${single ? "" : `<div class="window-rank">#${index + 1} this window${index < capacity || mustWatch ? " · recommended" : ""}</div>`}${renderGame(game,kickoffMode,kickoffColorMap,context)}</div>`;'''
assert old in s, 'schedule ranked game renderer not found'
sched.write_text(s.replace(old, new, 1))

print('contrast hierarchy patch complete')
