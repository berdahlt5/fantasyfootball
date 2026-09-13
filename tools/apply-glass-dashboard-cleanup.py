from pathlib import Path
import re

# 1) Team Rankings: remove low-value modeling summary cards and their DOM writes.
rankings = Path('team-rankings.html')
text = rankings.read_text()
old_block = '''      <section class="metric-grid">
        <div class="metric"><div class="metric-label">Teams</div><div class="metric-value" id="teamMetric">—</div><div class="metric-note">league rosters</div></div>
        <div class="metric"><div class="metric-label">Regular season</div><div class="metric-value" id="weekMetric">—</div><div class="metric-note">weeks modeled</div></div>
        <div class="metric"><div class="metric-label">Completed</div><div class="metric-value" id="completedMetric">—</div><div class="metric-note">actual results preserved</div></div>
        <div class="metric"><div class="metric-label">Projection coverage</div><div class="metric-value" id="coverageMetric">—</div><div class="metric-note">future weeks with projection data</div></div>
        <div class="metric"><div class="metric-label">Modeled slots</div><div class="metric-value" id="slotMetric">—</div><div class="metric-note">K / D-ST excluded</div></div>
      </section>

'''
if old_block not in text:
    raise SystemExit('summary metric block not found')
text = text.replace(old_block, '', 1)
pattern = re.compile(r';els\.teamMetric\.textContent=teams\.length;els\.weekMetric\.textContent=maxWeek;els\.completedMetric\.textContent=completedThrough;els\.coverageMetric\.textContent=`\$\{projectionWeeks\.length\}/\$\{Math\.max\(0,maxWeek-completedThrough\)\}`;els\.slotMetric\.textContent=slots\.length;')
text, count = pattern.subn(';', text, count=1)
if count != 1:
    raise SystemExit(f'metric JS cleanup count={count}')
rankings.write_text(text)

# 2) Shared glass/contrast polish across the app.
css = Path('app-shell.css')
style = css.read_text()
marker = '/* glass-polish-v2 */'
if marker in style:
    raise SystemExit('glass polish already applied')
style += r'''

/* glass-polish-v2 */
:root{
  --app-glass:rgba(255,255,255,.72);
  --app-glass-strong:rgba(255,255,255,.86);
  --app-glass-subtle:rgba(247,250,255,.66);
  --app-glass-border:rgba(255,255,255,.72);
  --app-glass-shadow:0 18px 46px rgba(59,76,145,.11),0 3px 10px rgba(50,66,118,.07),inset 0 1px 0 rgba(255,255,255,.80);
  --app-button-shadow:0 9px 22px rgba(72,95,222,.24),0 2px 6px rgba(48,62,139,.12),inset 0 1px 0 rgba(255,255,255,.48),inset 0 -1px 0 rgba(43,55,164,.16);
}
html[data-theme="dark"]{
  --app-glass:rgba(23,30,43,.76);
  --app-glass-strong:rgba(26,34,49,.90);
  --app-glass-subtle:rgba(30,39,56,.70);
  --app-glass-border:rgba(255,255,255,.12);
  --app-glass-shadow:0 20px 48px rgba(0,0,0,.34),0 3px 9px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.07);
  --app-button-shadow:0 10px 24px rgba(65,90,210,.26),0 2px 8px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.20),inset 0 -1px 0 rgba(0,0,0,.18);
}

body{
  background:
    radial-gradient(circle at 8% -4%,rgba(35,214,231,.18),transparent 27rem),
    radial-gradient(circle at 94% 1%,rgba(99,93,243,.16),transparent 30rem),
    linear-gradient(180deg,color-mix(in srgb,var(--app-bg) 92%,#fff) 0%,var(--app-bg) 42%,var(--app-bg) 100%)!important;
}

.topbar,.panel,.app-settings-dialog{
  background:var(--app-glass)!important;
  border:1px solid var(--app-glass-border)!important;
  box-shadow:var(--app-glass-shadow)!important;
  backdrop-filter:blur(22px) saturate(145%)!important;
  -webkit-backdrop-filter:blur(22px) saturate(145%)!important;
}
.topbar{border-bottom:1px solid var(--app-glass-border)!important}
.panel{border-radius:22px!important}

.app-nav{
  background:var(--app-glass-subtle)!important;
  border:1px solid var(--app-glass-border)!important;
  box-shadow:0 10px 28px rgba(55,72,132,.10),inset 0 1px 0 rgba(255,255,255,.72)!important;
  backdrop-filter:blur(18px) saturate(145%)!important;
  -webkit-backdrop-filter:blur(18px) saturate(145%)!important;
}
html[data-theme="dark"] .app-nav{box-shadow:0 10px 28px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.07)!important}

/* Clean button edges: clip the gradient, add a glass highlight, and avoid hard outlines. */
.app-nav-link,.app-nav-button,.app-more>summary,.primary,.secondary,.secondary-btn,.app-settings-save,.app-settings-cancel{
  position:relative!important;
  isolation:isolate;
  overflow:hidden!important;
  -webkit-background-clip:padding-box!important;
  background-clip:padding-box!important;
}
.app-nav-link.active,.app-more>summary.active,.primary,.app-settings-save{
  border:1px solid rgba(255,255,255,.42)!important;
  box-shadow:var(--app-button-shadow)!important;
}
.app-nav-link.active,.app-more>summary.active{background:var(--app-gradient)!important}
.primary,.app-settings-save{background:var(--app-gradient)!important;border-radius:14px!important}
.app-settings-button,.secondary,.secondary-btn,.app-settings-cancel{
  background:var(--app-glass-strong)!important;
  border:1px solid color-mix(in srgb,var(--app-border) 72%, rgba(255,255,255,.55))!important;
  box-shadow:0 6px 16px rgba(52,68,122,.07),inset 0 1px 0 rgba(255,255,255,.64)!important;
}
html[data-theme="dark"] .app-settings-button,html[data-theme="dark"] .secondary,html[data-theme="dark"] .secondary-btn,html[data-theme="dark"] .app-settings-cancel{
  box-shadow:0 6px 16px rgba(0,0,0,.19),inset 0 1px 0 rgba(255,255,255,.07)!important;
}

input,select,textarea{
  background:var(--app-glass-strong)!important;
  border:1px solid color-mix(in srgb,var(--app-border) 76%, rgba(255,255,255,.55))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 3px 10px rgba(55,72,128,.04)!important;
}
html[data-theme="dark"] input,html[data-theme="dark"] select,html[data-theme="dark"] textarea{
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 3px 10px rgba(0,0,0,.16)!important;
}

.metric,.watch-card,.league-card,.live-score-card,.remaining-box,.lineup-row,.sidebar-row,.impact-player,.team-history-team,.draft-team,.draft-season{
  background:var(--app-glass-strong)!important;
  border:1px solid color-mix(in srgb,var(--app-border) 72%, rgba(255,255,255,.58))!important;
  box-shadow:0 10px 28px rgba(55,72,132,.08),inset 0 1px 0 rgba(255,255,255,.70)!important;
  backdrop-filter:blur(14px) saturate(125%)!important;
  -webkit-backdrop-filter:blur(14px) saturate(125%)!important;
}
html[data-theme="dark"] .metric,html[data-theme="dark"] .watch-card,html[data-theme="dark"] .league-card,html[data-theme="dark"] .live-score-card,html[data-theme="dark"] .remaining-box,html[data-theme="dark"] .lineup-row,html[data-theme="dark"] .sidebar-row,html[data-theme="dark"] .impact-player,html[data-theme="dark"] .team-history-team,html[data-theme="dark"] .draft-team,html[data-theme="dark"] .draft-season{
  box-shadow:0 10px 28px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.06)!important;
}

/* Team Rankings: the expanded roster area must obey the current theme instead of the old brown palette. */
.table-wrap{
  background:var(--app-glass)!important;
  border-color:color-mix(in srgb,var(--app-border) 72%, rgba(255,255,255,.42))!important;
  box-shadow:0 10px 30px rgba(55,72,132,.07),inset 0 1px 0 rgba(255,255,255,.55)!important;
  backdrop-filter:blur(16px) saturate(130%)!important;
  -webkit-backdrop-filter:blur(16px) saturate(130%)!important;
}
html:not([data-theme="dark"]) th{
  background:rgba(237,243,255,.94)!important;
  color:var(--app-accent-strong)!important;
  border-bottom-color:rgba(72,91,150,.14)!important;
}
html:not([data-theme="dark"]) td{color:#4d596c!important}
html:not([data-theme="dark"]) tbody tr:hover td{background:rgba(73,112,243,.045)!important}
html:not([data-theme="dark"]) tr.mine td{background:rgba(61,155,244,.055)!important}
html:not([data-theme="dark"]) .team-detail-row td{
  background:rgba(239,244,255,.76)!important;
  color:var(--app-text)!important;
}
html:not([data-theme="dark"]) .team-detail{border-bottom-color:rgba(72,91,150,.13)!important}
html:not([data-theme="dark"]) .detail-stat,
html:not([data-theme="dark"]) .detail-ranks,
html:not([data-theme="dark"]) .roster-position,
html:not([data-theme="dark"]) .week-card,
html:not([data-theme="dark"]) .model-card{
  background:rgba(255,255,255,.78)!important;
  border-color:rgba(72,91,150,.15)!important;
  box-shadow:0 7px 20px rgba(59,76,145,.06),inset 0 1px 0 rgba(255,255,255,.82)!important;
}
html:not([data-theme="dark"]) .detail-stat strong,
html:not([data-theme="dark"]) .roster-title,
html:not([data-theme="dark"]) .roster-player-name,
html:not([data-theme="dark"]) .week-card-head,
html:not([data-theme="dark"]) .model-card strong{color:var(--app-text)!important}
html:not([data-theme="dark"]) .detail-stat span,
html:not([data-theme="dark"]) .roster-player-meta,
html:not([data-theme="dark"]) .roster-player-value small,
html:not([data-theme="dark"]) .week-card-note,
html:not([data-theme="dark"]) .model-card span{color:var(--app-muted)!important}
html:not([data-theme="dark"]) .detail-ranks-title,
html:not([data-theme="dark"]) .roster-position-head,
html:not([data-theme="dark"]) .roster-player-value,
html:not([data-theme="dark"]) .week-card-value{color:var(--app-accent-strong)!important}
html:not([data-theme="dark"]) .roster-position-head{background:rgba(81,101,246,.08)!important}
html:not([data-theme="dark"]) .roster-player-row{border-top-color:rgba(72,91,150,.10)!important}

/* Accessible rank/status colors on the light glass theme. */
html:not([data-theme="dark"]) .rank-number.playoff,
html:not([data-theme="dark"]) .mini-rank.playoff,
html:not([data-theme="dark"]) .rank-chip.playoff,
html:not([data-theme="dark"]) .legend-pill.playoff{background:#eaf7ef!important;border-color:#afd8bf!important;color:#226b45!important}
html:not([data-theme="dark"]) .finish-value.playoff{color:#226b45!important}
html:not([data-theme="dark"]) .rank-number.bubble,
html:not([data-theme="dark"]) .mini-rank.bubble,
html:not([data-theme="dark"]) .rank-chip.bubble,
html:not([data-theme="dark"]) .legend-pill.bubble{background:#fff5dc!important;border-color:#e6ca83!important;color:#805700!important}
html:not([data-theme="dark"]) .finish-value.bubble{color:#805700!important}
html:not([data-theme="dark"]) .rank-number.longshot,
html:not([data-theme="dark"]) .mini-rank.longshot,
html:not([data-theme="dark"]) .rank-chip.longshot,
html:not([data-theme="dark"]) .legend-pill.longshot{background:#fdecee!important;border-color:#e4adb5!important;color:#9b3544!important}
html:not([data-theme="dark"]) .finish-value.longshot{color:#9b3544!important}

/* Keep text crisp on translucent surfaces. */
.subtitle,.section-note,.load-note,.helper,.footer-note,.app-settings-subtitle,.app-settings-help{color:var(--app-muted)!important}
.section-title,.team-name,.record,.value-main,.roster-player-name{color:var(--app-text)!important}

@media(max-width:600px){
  .topbar,.panel{backdrop-filter:blur(18px) saturate(135%)!important;-webkit-backdrop-filter:blur(18px) saturate(135%)!important}
  .app-nav{padding:5px!important;gap:4px!important}
  .app-nav-link,.app-nav-button,.app-more>summary{min-height:38px!important;padding:8px 12px!important}
}
'''
css.write_text(style)

print('glass dashboard cleanup applied')
