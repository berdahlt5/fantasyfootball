from pathlib import Path

schedule_path = Path('schedule-tool.html')
schedule = schedule_path.read_text()
old = '      const projection = schedulePlayerProjection(player.playerId);'
new = '      const projection = scheduleImpactForPlayer(player.playerId).projection;'
if old not in schedule:
    raise SystemExit('schedule projection error anchor not found')
schedule = schedule.replace(old, new, 1)
schedule_path.write_text(schedule)

css_path = Path('app-shell.css')
css = css_path.read_text()
marker = '/* glass-polish-v4 */'
if marker in css:
    raise SystemExit('glass polish v4 already applied')
css += r'''

/* glass-polish-v4 */
:root{
  --app-warning-glass:rgba(255,249,224,.46);
  --app-warning-border:rgba(185,139,32,.24);
  --app-warning-edge:rgba(173,126,20,.50);
  --app-light-glass:rgba(255,255,255,.58);
  --app-light-glass-strong:rgba(255,255,255,.72);
}

/* Make caution states feel like tinted glass instead of yellow cards. */
html:not([data-theme="dark"]) .lineup-issue.warn,
html:not([data-theme="dark"]) .alert.warn,
html:not([data-theme="dark"]) .warning-box,
html:not([data-theme="dark"]) .tip.strong{
  background:linear-gradient(135deg,rgba(255,253,244,.68),rgba(255,246,207,.34))!important;
  border-color:var(--app-warning-border)!important;
  border-left:3px solid var(--app-warning-edge)!important;
  box-shadow:0 12px 30px rgba(66,80,137,.075),inset 0 1px 0 rgba(255,255,255,.92)!important;
  backdrop-filter:blur(14px) saturate(122%);
  -webkit-backdrop-filter:blur(14px) saturate(122%);
  color:var(--app-text)!important;
}
html:not([data-theme="dark"]) .lineup-issue.warn .lineup-issue-title,
html:not([data-theme="dark"]) .alert.warn strong,
html:not([data-theme="dark"]) .warning-box strong{
  color:var(--app-text)!important;
}
html:not([data-theme="dark"]) .lineup-issue.warn,
html:not([data-theme="dark"]) .alert.warn{
  box-shadow:0 12px 30px rgba(66,80,137,.075),inset 3px 0 0 var(--app-warning-edge),inset 0 1px 0 rgba(255,255,255,.92)!important;
}
html:not([data-theme="dark"]) .lineup-pulse-pill.warn{
  background:rgba(255,249,224,.34)!important;
  border-color:rgba(185,139,32,.24)!important;
  color:#83651f!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.88)!important;
}
html:not([data-theme="dark"]) .lineup-pulse-pill.warn strong{color:#83651f!important}
html:not([data-theme="dark"]) .priority-badge,
html:not([data-theme="dark"]) .favorite-watch,
html:not([data-theme="dark"]) .watch-count.starred{
  background:rgba(255,249,224,.34)!important;
  border-color:rgba(185,139,32,.22)!important;
}

/* Sweep up legacy dark inline surfaces that were still visible in light mode. */
html:not([data-theme="dark"]) table th,
html:not([data-theme="dark"]) .team-history-table th{
  background:rgba(255,255,255,.74)!important;
  color:var(--app-text)!important;
  border-color:rgba(108,126,180,.13)!important;
  backdrop-filter:blur(12px) saturate(118%);
  -webkit-backdrop-filter:blur(12px) saturate(118%);
}
html:not([data-theme="dark"]) .team-detail-row td{
  background:rgba(255,255,255,.40)!important;
}
html:not([data-theme="dark"]) .week-card,
html:not([data-theme="dark"]) .detail-stat,
html:not([data-theme="dark"]) .detail-ranks,
html:not([data-theme="dark"]) .roster-position,
html:not([data-theme="dark"]) details.model .model-card,
html:not([data-theme="dark"]) .recent-games,
html:not([data-theme="dark"]) .availability{
  background:var(--app-light-glass)!important;
  color:var(--app-text)!important;
  border-color:rgba(108,126,180,.16)!important;
  box-shadow:0 12px 30px rgba(57,74,131,.07),inset 0 1px 0 rgba(255,255,255,.82)!important;
  backdrop-filter:blur(14px) saturate(120%);
  -webkit-backdrop-filter:blur(14px) saturate(120%);
}
html:not([data-theme="dark"]) .recent-game,
html:not([data-theme="dark"]) .availability-row,
html:not([data-theme="dark"]) .weight-card{
  background:var(--app-light-glass-strong)!important;
  color:var(--app-text)!important;
  border-color:rgba(108,126,180,.14)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.84)!important;
}
html:not([data-theme="dark"]) .recent-games-head,
html:not([data-theme="dark"]) .availability>summary,
html:not([data-theme="dark"]) .week-card-head,
html:not([data-theme="dark"]) .detail-stat strong,
html:not([data-theme="dark"]) .roster-player-name,
html:not([data-theme="dark"]) details.model .model-card strong{
  color:var(--app-text)!important;
}
html:not([data-theme="dark"]) .info-icon,
html:not([data-theme="dark"]) .taxi-badge{
  background:rgba(236,242,255,.72)!important;
  color:var(--app-accent-strong)!important;
  border-color:rgba(73,103,197,.20)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.84)!important;
}

/* Keep semantic bars, but soften heavy blocks in light mode. */
html:not([data-theme="dark"]) .team-detail,
html:not([data-theme="dark"]) .recent-games,
html:not([data-theme="dark"]) .availability{
  border-color:rgba(108,126,180,.14)!important;
}
'''
css_path.write_text(css)

print('glass cleanup v4 applied')
