from pathlib import Path

path = Path('app-shell.css')
text = path.read_text()
marker = '/* gradient-palette-v6 */'
if marker in text:
    raise SystemExit('gradient-palette-v6 already applied')

css = r'''

/* gradient-palette-v6 */
:root{
  --brand-cyan:#27c9e8;
  --brand-blue:#438cf5;
  --brand-violet:#6a5cf4;
  --brand-indigo:#3f55c9;
  --app-gradient:linear-gradient(135deg,var(--brand-cyan) 0%,var(--brand-blue) 52%,var(--brand-violet) 100%);
  --app-gradient-soft:linear-gradient(135deg,rgba(39,201,232,.13),rgba(67,140,245,.12) 52%,rgba(106,92,244,.12));
  --app-bg:#eef4ff;
  --app-surface:rgba(255,255,255,.70);
  --app-surface-strong:rgba(255,255,255,.90);
  --app-surface-subtle:rgba(248,250,255,.60);
  --app-border:rgba(91,112,176,.18);
  --app-text:#19223b;
  --app-muted:#68728d;
  --app-heading:#354fc3;
  --app-accent:#4b83f3;
  --app-accent-strong:#3c58cf;
  --app-accent-soft:rgba(75,131,243,.11);
  --app-success:#239b74;
  --app-success-soft:rgba(35,155,116,.11);
  --app-warning:#b87922;
  --app-warning-soft:rgba(231,173,69,.14);
  --app-danger:#d95f6a;
  --app-danger-soft:rgba(217,95,106,.12);
  --app-shadow:0 12px 32px rgba(62,86,150,.11),0 3px 10px rgba(46,65,110,.07);
  --app-shadow-elevated:0 22px 48px rgba(62,86,150,.16),0 6px 18px rgba(46,65,110,.09);
  --taupe:var(--app-text);
  --charcoal:var(--app-text);
  --panel:var(--app-surface);
  --panel-2:var(--app-surface-subtle);
  --card:var(--app-surface);
  --row:var(--app-surface-subtle);
  --ivory:#f7f9ff;
  --vanilla:#f7f9ff;
  --mint:var(--app-text);
  --text:var(--app-text);
  --muted:var(--app-muted);
  --sky:var(--app-accent);
  --chip:var(--app-accent-soft);
  --gold:var(--app-warning);
  --gold-2:#c98c30;
  --green:var(--app-success);
  --good:var(--app-success);
  --red:var(--app-danger);
  --bad:var(--app-danger);
  --line:var(--app-border);
  --shadow:var(--app-shadow);
}
html[data-theme="dark"]{
  --app-bg:#0d1324;
  --app-surface:rgba(18,25,46,.78);
  --app-surface-strong:rgba(24,32,56,.92);
  --app-surface-subtle:rgba(31,40,67,.66);
  --app-border:rgba(130,151,225,.18);
  --app-text:#f1f4ff;
  --app-muted:#acb6d1;
  --app-heading:#b7c4ff;
  --app-accent:#7f9dff;
  --app-accent-strong:#aab8ff;
  --app-accent-soft:rgba(111,139,255,.14);
  --app-success:#6fd3a7;
  --app-success-soft:rgba(76,199,150,.14);
  --app-warning:#e7b45b;
  --app-warning-soft:rgba(231,180,91,.13);
  --app-danger:#ff8790;
  --app-danger-soft:rgba(255,111,123,.13);
  --app-shadow:0 14px 34px rgba(0,0,0,.27),0 3px 12px rgba(0,0,0,.18);
  --app-shadow-elevated:0 22px 52px rgba(0,0,0,.36),0 7px 20px rgba(0,0,0,.22);
  --ivory:#f1f4ff;
  --vanilla:#f1f4ff;
}

body{
  background:
    radial-gradient(circle at 8% 5%,rgba(39,201,232,.15),transparent 28%),
    radial-gradient(circle at 88% 10%,rgba(106,92,244,.13),transparent 31%),
    linear-gradient(180deg,var(--app-bg),color-mix(in srgb,var(--app-bg) 91%,#ffffff))!important;
}
html[data-theme="dark"] body{
  background:
    radial-gradient(circle at 10% 4%,rgba(39,201,232,.10),transparent 28%),
    radial-gradient(circle at 90% 8%,rgba(106,92,244,.12),transparent 32%),
    var(--app-bg)!important;
}

/* One consistent glass surface language across every tool. */
.topbar,.panel,.metric,.metric-band,.game-card,.watch-card,.league-card,.live-score-card,.remaining-box,
.lineup-row,.sidebar-row,.team-history-team,.draft-team,.draft-season,.impact-player,.headline,.week-card,
.detail-stat,.projection-card,.history-card,.history-item,.owner-history-card,.team-card,.league-summary,
.player-card,.candidate-card,.recommendation-card,.recent-games,.availability,.app-settings-dialog{
  background:var(--app-surface)!important;
  color:var(--app-text)!important;
  border-color:var(--app-border)!important;
  box-shadow:var(--app-shadow)!important;
  backdrop-filter:blur(18px) saturate(135%);
  -webkit-backdrop-filter:blur(18px) saturate(135%);
}
input,select,textarea{
  background:var(--app-surface-strong)!important;
  border-color:var(--app-border)!important;
  color:var(--app-text)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.52)!important;
}
html[data-theme="dark"] input,html[data-theme="dark"] select,html[data-theme="dark"] textarea{
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important;
}

/* Brand color belongs to navigation, headings, actions and neutral ranking emphasis. */
.topbar h1,.brand h1,h1,.section-title,.expandable-title,.metric-group-label,.watch-window-title,
.lineup-pulse-title,.games-title,.remaining-title,.app-settings-title{
  color:var(--app-heading)!important;
}
.section-title::after,.expandable-title::after{
  content:"";display:block;width:44px;height:3px;margin-top:6px;border-radius:999px;background:var(--app-gradient);
  box-shadow:0 4px 12px rgba(67,140,245,.20);
}
.primary,.app-settings-save,.app-nav-link.active,.app-more>summary.active,.mine-badge,.window-rank.recommended{
  background:var(--app-gradient)!important;
  color:#fff!important;
  border-color:rgba(255,255,255,.54)!important;
  box-shadow:0 12px 28px rgba(67,113,228,.24),inset 0 1px 0 rgba(255,255,255,.50)!important;
}
.primary,.secondary,.secondary-btn,.app-nav-link,.app-nav-button,.app-more>summary,.app-settings-actions button,
.draft-history-toggle,.history-chevron,.draft-chevron,.window-rank{
  overflow:hidden!important;background-clip:padding-box!important;
}
.secondary,.secondary-btn,.app-nav-button,.app-more>summary:not(.active),.app-settings-cancel{
  background:rgba(255,255,255,.54)!important;
  color:var(--app-accent-strong)!important;
  border-color:rgba(97,119,186,.18)!important;
  box-shadow:0 7px 18px rgba(64,83,135,.10),inset 0 1px 0 rgba(255,255,255,.68)!important;
}
html[data-theme="dark"] .secondary,html[data-theme="dark"] .secondary-btn,html[data-theme="dark"] .app-nav-button,
html[data-theme="dark"] .app-more>summary:not(.active),html[data-theme="dark"] .app-settings-cancel{
  background:rgba(29,38,66,.68)!important;color:var(--app-accent-strong)!important;border-color:var(--app-border)!important;
  box-shadow:0 9px 20px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.08)!important;
}
.app-nav-link:not(.active){color:var(--app-muted)!important}
.app-nav-link:hover,.app-nav-button:hover,.app-more>summary:hover{
  color:var(--app-accent-strong)!important;border-color:rgba(75,131,243,.25)!important;background:var(--app-accent-soft)!important;
}
.brand-mark{
  background:var(--app-gradient-soft)!important;color:var(--app-accent-strong)!important;
  border-color:rgba(75,131,243,.24)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.55)!important;
}
.status-pill{background:var(--app-gradient-soft)!important;color:var(--app-accent-strong)!important;border-color:rgba(75,131,243,.18)!important}

/* Watch Planner: brand gradient for importance, amber only for starred context. */
.watch-tier.must{
  background:var(--app-gradient)!important;color:#fff!important;border-color:transparent!important;
  box-shadow:0 9px 22px rgba(67,113,228,.22)!important;
}
.watch-tier.watch,.watch-tier.radar,.watch-count{
  background:var(--app-accent-soft)!important;color:var(--app-accent-strong)!important;border-color:rgba(75,131,243,.16)!important;
}
.watch-count.starred,.priority-badge,.priority-star[aria-pressed="true"]{
  background:var(--app-warning-soft)!important;color:var(--app-warning)!important;
  border-color:color-mix(in srgb,var(--app-warning) 30%,transparent)!important;
}
.favorite-watch{
  background:linear-gradient(135deg,rgba(39,201,232,.13),rgba(106,92,244,.14))!important;
  color:var(--app-accent-strong)!important;border-color:rgba(91,93,230,.22)!important;
}
.priority-game{
  border-color:rgba(75,131,243,.28)!important;
  box-shadow:inset 4px 0 0 var(--app-accent),var(--app-shadow)!important;
}
.window-ranked-game.recommended .watch-card,.window-ranked-game.must-watch .watch-card{
  box-shadow:var(--app-shadow-elevated)!important;
}

/* Owner Dashboard: replace decorative gold/brown with gradient-family accents. */
.metric-band.current-season{
  background:linear-gradient(135deg,rgba(39,201,232,.09),rgba(67,140,245,.08))!important;
  border-color:rgba(67,140,245,.20)!important;box-shadow:inset 4px 0 0 var(--brand-cyan),var(--app-shadow)!important;
}
.metric-band.all-time{
  background:linear-gradient(135deg,rgba(67,140,245,.08),rgba(106,92,244,.09))!important;
  border-color:rgba(106,92,244,.20)!important;box-shadow:inset 4px 0 0 var(--brand-violet),var(--app-shadow)!important;
}
.metric-band.current-season .metric-group-label::before{background:var(--brand-cyan)!important}
.metric-band.all-time .metric-group-label::before{background:var(--brand-violet)!important}
.metric-button:hover,.metric-button[aria-expanded="true"],.team-history-team[open],.draft-team[open]{
  border-color:rgba(75,131,243,.34)!important;
}
.metric-action,.history-chevron,.draft-chevron,.draft-history-toggle{
  color:var(--app-accent-strong)!important;background:var(--app-accent-soft)!important;border-color:rgba(75,131,243,.18)!important;
}
.team-history-table th,.team-history-table td:first-child,.draft-season-title,.draft-team-name,.team-history-name{
  color:var(--app-text)!important;
}
.team-history-table th{
  background:var(--app-gradient-soft)!important;color:var(--app-accent-strong)!important;
}

/* Rankings: brand blue-violet for neutral ranks; semantic colors only for outcome tiers. */
th{
  color:var(--app-accent-strong)!important;
  background:linear-gradient(180deg,var(--app-surface-strong),var(--app-surface-subtle))!important;
}
.rank-number,.rank-chip,.mini-rank{
  background:var(--app-accent-soft)!important;color:var(--app-accent-strong)!important;border-color:rgba(75,131,243,.19)!important;
}
.rank-number.top,.rank-chip.first{
  background:var(--app-gradient)!important;color:#fff!important;border-color:transparent!important;
}
.team-toggle:hover .team-name,.team-toggle[aria-expanded="true"] .team-name,.team-chevron,
.expandable-section>summary::after{color:var(--app-accent-strong)!important}
.bar-track{background:rgba(75,131,243,.10)!important}.bar-fill{background:var(--app-gradient)!important}
.team-detail-row td{background:rgba(231,238,255,.48)!important}
html[data-theme="dark"] .team-detail-row td{background:rgba(18,25,46,.55)!important}

.rank-number.playoff,.mini-rank.playoff,.rank-chip.playoff,.legend-pill.playoff{
  background:var(--app-success-soft)!important;color:var(--app-success)!important;border-color:color-mix(in srgb,var(--app-success) 32%,transparent)!important;
}
.rank-number.bubble,.mini-rank.bubble,.rank-chip.bubble,.legend-pill.bubble{
  background:var(--app-warning-soft)!important;color:var(--app-warning)!important;border-color:color-mix(in srgb,var(--app-warning) 30%,transparent)!important;
}
.rank-number.longshot,.mini-rank.longshot,.rank-chip.longshot,.legend-pill.longshot,.rank-chip.bottom{
  background:var(--app-danger-soft)!important;color:var(--app-danger)!important;border-color:color-mix(in srgb,var(--app-danger) 28%,transparent)!important;
}
.finish-value.playoff,.history-result-good{color:var(--app-success)!important}
.finish-value.bubble,.history-result-warn{color:var(--app-warning)!important}
.finish-value.longshot,.history-result-bad{color:var(--app-danger)!important}

/* Lineup / waiver semantics stay complementary but soft and glass-compatible. */
.alert.good,.lineup-clear,.scenario.good{
  background:var(--app-success-soft)!important;color:var(--app-success)!important;border-color:color-mix(in srgb,var(--app-success) 28%,transparent)!important;
}
.alert.warn,.lineup-issue.warn,.injury.questionable,.injury.doubtful{
  --semantic-accent:var(--app-warning);
}
.lineup-issue.warn,.alert.warn{
  background:var(--app-warning-soft)!important;border-color:color-mix(in srgb,var(--app-warning) 28%,transparent)!important;
}
.alert.critical,.lineup-issue.critical,.scenario.bad{
  background:var(--app-danger-soft)!important;border-color:color-mix(in srgb,var(--app-danger) 28%,transparent)!important;
}
.lineup-issue.timing,.scenario,.availability,.recommendation-card{
  background:var(--app-accent-soft)!important;border-color:rgba(75,131,243,.15)!important;
}

/* Small neutral chips and details should visually belong to the same family. */
.watch-details>summary,.league-control,.league-chip,.empty,.app-more-menu,.app-settings-field select,.app-settings-field textarea{
  background:var(--app-surface-strong)!important;border-color:var(--app-border)!important;
}
.app-more-menu a:hover{background:var(--app-gradient-soft)!important;color:var(--app-accent-strong)!important}

@media(max-width:640px){
  .topbar,.panel,.game-card,.watch-card,.metric-band,.projection-card,.history-card{
    box-shadow:0 12px 28px rgba(62,86,150,.11),0 2px 8px rgba(46,65,110,.06)!important;
  }
}
'''

path.write_text(text.rstrip() + css + '\n')
print('appended gradient-palette-v6')
