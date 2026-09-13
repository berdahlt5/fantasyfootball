from pathlib import Path

# Shared navigation labels.
js_path = Path('app-shell.js')
js = js_path.read_text()
replacements = [
    ('["./index.html","Dashboard","dashboard"]', '["./index.html","Owner Dashboard","dashboard"]'),
    ('["./schedule-tool.html","Watch","watch"]', '["./schedule-tool.html","Watch Planner","watch"]'),
]
for old, new in replacements:
    if old not in js:
        raise SystemExit(f'app-shell nav anchor not found: {old}')
    js = js.replace(old, new, 1)
js_path.write_text(js)

# Watch Planner page branding.
schedule_path = Path('schedule-tool.html')
schedule = schedule_path.read_text()
if '<title>Fantasy Football Schedule Tool</title>' not in schedule:
    raise SystemExit('schedule title anchor not found')
if '<h1>Fantasy Schedule Tool</h1>' not in schedule:
    raise SystemExit('schedule h1 anchor not found')
schedule = schedule.replace('<title>Fantasy Football Schedule Tool</title>', '<title>Fantasy Football Watch Planner</title>', 1)
schedule = schedule.replace('<h1>Fantasy Schedule Tool</h1>', '<h1>Watch Planner</h1>', 1)
schedule_path.write_text(schedule)

# Shared visual/mobile polish.
css_path = Path('app-shell.css')
css = css_path.read_text()
marker = '/* mobile-glass-v5 */'
if marker in css:
    raise SystemExit('mobile glass v5 already applied')
css += r'''

/* mobile-glass-v5 */
:root{
  --app-heading:#3453b9;
  --app-heading-soft:rgba(52,83,185,.10);
  --app-gradient:linear-gradient(135deg,#25cbe7 0%,#438bf4 52%,#6659f2 100%);
  --app-glass-card:rgba(255,255,255,.60);
  --app-glass-card-strong:rgba(255,255,255,.76);
  --app-glass-border:rgba(255,255,255,.70);
  --app-depth-shadow:0 15px 36px rgba(47,67,128,.10),0 3px 9px rgba(26,38,78,.055),inset 0 1px 0 rgba(255,255,255,.88);
}
html[data-theme="dark"]{
  --app-heading:#a9bdff;
  --app-heading-soft:rgba(169,189,255,.10);
  --app-glass-card:rgba(23,29,36,.76);
  --app-glass-card-strong:rgba(29,37,46,.86);
  --app-glass-border:rgba(255,255,255,.10);
  --app-depth-shadow:0 16px 38px rgba(0,0,0,.28),0 3px 10px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.05);
}

/* Stronger section hierarchy without adding lots of competing colors. */
.section-title,
.lineup-pulse-title,
.expandable-title,
.watch-window-title,
.filter-title,
.position-group-title,
.model-summary-title,
.impact-section-title,
.roster-title{
  color:var(--app-heading)!important;
  font-weight:950!important;
  letter-spacing:-.012em!important;
}
.section-title,
.lineup-pulse-title,
.expandable-title{
  position:relative;
  padding-bottom:7px;
}
.section-title::after,
.lineup-pulse-title::after,
.expandable-title::after{
  content:"";
  display:block;
  width:34px;
  height:3px;
  margin-top:6px;
  border-radius:999px;
  background:var(--app-gradient);
  box-shadow:0 3px 9px rgba(67,139,244,.17);
}

/* Clean gradient buttons: one clipped shape, translucent edge, no protruding ornaments. */
.primary,
.app-settings-save,
.app-nav-link.active,
.window-ranked-game.recommended .window-rank{
  background:var(--app-gradient)!important;
  color:#fff!important;
  border:1px solid rgba(255,255,255,.64)!important;
  background-clip:padding-box!important;
  overflow:hidden!important;
  isolation:isolate!important;
  box-shadow:0 11px 26px rgba(64,91,210,.19),0 3px 8px rgba(30,42,92,.08),inset 0 1px 0 rgba(255,255,255,.48)!important;
}
.primary,.app-settings-save{border-radius:14px!important}
.app-nav-link.active{border-radius:999px!important}
.window-ranked-game.recommended .window-rank{
  border-radius:999px!important;
  padding-left:13px!important;
  padding-right:13px!important;
}
.window-ranked-game.recommended .window-rank::before,
.window-ranked-game.recommended .window-rank::after,
.primary::before,.primary::after,
.app-nav-link.active::before,.app-nav-link.active::after{
  content:none!important;
  display:none!important;
}
.secondary,.secondary-btn,.app-nav-button,.app-more>summary,.lineup-pulse-link{
  border:1px solid rgba(111,129,181,.18)!important;
  background:rgba(255,255,255,.48)!important;
  box-shadow:0 8px 20px rgba(54,71,126,.07),inset 0 1px 0 rgba(255,255,255,.82)!important;
  backdrop-filter:blur(14px) saturate(120%);
  -webkit-backdrop-filter:blur(14px) saturate(120%);
  overflow:hidden!important;
  background-clip:padding-box!important;
}
html[data-theme="dark"] .secondary,
html[data-theme="dark"] .secondary-btn,
html[data-theme="dark"] .app-nav-button,
html[data-theme="dark"] .app-more>summary,
html[data-theme="dark"] .lineup-pulse-link{
  background:rgba(29,37,46,.70)!important;
  border-color:rgba(255,255,255,.09)!important;
  box-shadow:0 8px 20px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.04)!important;
}

/* Remove remaining legacy dark cards from the light theme. */
html:not([data-theme="dark"]) .projection-card,
html:not([data-theme="dark"]) .history-card,
html:not([data-theme="dark"]) .score-card,
html:not([data-theme="dark"]) .team-history-team,
html:not([data-theme="dark"]) .draft-team,
html:not([data-theme="dark"]) .draft-season{
  background:var(--app-glass-card)!important;
  color:var(--app-text)!important;
  border-color:rgba(103,122,178,.15)!important;
  box-shadow:var(--app-depth-shadow)!important;
  backdrop-filter:blur(17px) saturate(124%);
  -webkit-backdrop-filter:blur(17px) saturate(124%);
}
html:not([data-theme="dark"]) .projection-card:hover,
html:not([data-theme="dark"]) .history-card:hover{
  background:var(--app-glass-card-strong)!important;
  border-color:rgba(75,112,218,.20)!important;
}
html:not([data-theme="dark"]) .projection-team,
html:not([data-theme="dark"]) .projection-stat strong,
html:not([data-theme="dark"]) .history-title,
html:not([data-theme="dark"]) .history-card strong,
html:not([data-theme="dark"]) .score-card strong,
html:not([data-theme="dark"]) .team-history-name,
html:not([data-theme="dark"]) .draft-team-name,
html:not([data-theme="dark"]) .draft-season-title{
  color:var(--app-text)!important;
}
html:not([data-theme="dark"]) .projection-league,
html:not([data-theme="dark"]) .projection-current,
html:not([data-theme="dark"]) .projection-stat span,
html:not([data-theme="dark"]) .history-sub,
html:not([data-theme="dark"]) .team-history-league,
html:not([data-theme="dark"]) .draft-team-meta{
  color:var(--app-muted)!important;
}

/* Give primary glass surfaces a little more lift while keeping text crisp. */
html:not([data-theme="dark"]) .panel,
html:not([data-theme="dark"]) .topbar,
html:not([data-theme="dark"]) .game-card,
html:not([data-theme="dark"]) .watch-card,
html:not([data-theme="dark"]) .league-card,
html:not([data-theme="dark"]) .metric-band{
  border-color:rgba(255,255,255,.76)!important;
  box-shadow:0 16px 38px rgba(50,69,132,.09),0 3px 9px rgba(30,42,86,.045),inset 0 1px 0 rgba(255,255,255,.90)!important;
}

/* Dedicated phone presentation rather than simply shrinking desktop. */
@media(max-width:640px){
  body{background-attachment:fixed!important}
  .shell{
    width:calc(100% - 20px)!important;
    padding:10px 0 96px!important;
  }
  .topbar{
    padding:12px!important;
    margin-bottom:10px!important;
    border-radius:24px!important;
    gap:9px!important;
  }
  .topbar h1,.brand h1,h1{font-size:1.36rem!important;line-height:1.08!important}
  .brand{width:100%!important}.brand-mark{display:none!important}
  .subtitle{display:none!important}
  .header-actions{
    width:100%!important;
    overflow:visible!important;
  }
  .app-nav{
    width:100%!important;
    display:flex!important;
    flex-wrap:nowrap!important;
    gap:5px!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    padding:3px 1px 7px!important;
    -webkit-overflow-scrolling:touch;
    scrollbar-width:none;
    overscroll-behavior-x:contain;
  }
  .app-nav::-webkit-scrollbar{display:none}
  .app-nav-link,.app-nav-button,.app-more>summary{
    flex:0 0 auto!important;
    min-height:40px!important;
    padding:9px 12px!important;
    border-radius:999px!important;
    font-size:.72rem!important;
  }
  .app-more-menu{position:fixed!important;left:12px!important;right:12px!important;top:auto!important;bottom:18px!important;border-radius:20px!important;padding:8px!important}

  .panel,.section,.lineup-pulse,.metric-band{
    border-radius:22px!important;
  }
  .controls,.section,.league-body,.crunch-body{padding:13px!important}
  .control-grid{
    grid-template-columns:1fr!important;
    gap:9px!important;
  }
  .control-grid>*{grid-column:auto!important;grid-row:auto!important}
  .control-grid button,.control-grid .primary,.control-grid .secondary,.control-grid .secondary-btn{width:100%!important}
  input,select,textarea{min-height:44px!important;border-radius:13px!important}
  .primary,.secondary,.secondary-btn{min-height:44px!important}

  .section-head{
    display:block!important;
    margin-bottom:11px!important;
  }
  .section-title,.lineup-pulse-title,.expandable-title{font-size:1.02rem!important}
  .section-note,.lineup-pulse-sub,.expandable-note{font-size:.74rem!important;line-height:1.38!important}

  .metric-grid,.career-grid,.summary{grid-template-columns:1fr 1fr!important;gap:8px!important}
  .metric{padding:11px!important;border-radius:17px!important}
  .metric-value{font-size:1.38rem!important}

  .projection-grid,.history-grid,.score-grid{grid-template-columns:1fr!important}
  .projection-card{
    grid-template-columns:minmax(0,1fr) auto 28px!important;
    gap:9px!important;
    padding:13px!important;
    border-radius:18px!important;
  }
  .history-card,.score-card{border-radius:18px!important;padding:12px!important}
  .projection-team{font-size:.91rem!important}
  .projection-league,.projection-current{font-size:.67rem!important}
  .projection-stat{text-align:right!important}

  .watch-window-games,.games{grid-template-columns:1fr!important}
  .watch-window{margin-bottom:16px!important}
  .watch-window-head{align-items:flex-end!important}
  .watch-window-title{font-size:.92rem!important}
  .watch-card,.game-card{border-radius:20px!important}
  .watch-card-main{padding:12px!important}
  .watch-details>summary{padding:10px 12px!important}
  .impact-grid,.remaining-grid{grid-template-columns:1fr!important}

  .table-wrap{
    margin-inline:-2px!important;
    border-radius:18px!important;
    -webkit-overflow-scrolling:touch;
  }
  th,td{padding:9px 8px!important}
  .team-detail-top,.detail-rank-groups,.roster-grid{grid-template-columns:1fr!important}

  .lineup-pulse-head{display:block!important}
  .lineup-pulse-link{display:inline-flex!important;margin-top:8px!important}
  .lineup-pulse-metrics{gap:6px!important}
  .lineup-issue{border-radius:16px!important;padding:10px!important}

  .app-settings-backdrop{
    align-items:end!important;
    padding:0!important;
  }
  .app-settings-dialog{
    width:100%!important;
    max-height:88vh!important;
    overflow:auto!important;
    border-radius:24px 24px 0 0!important;
  }
  .app-settings-body{grid-template-columns:1fr!important}
  .app-settings-wide{grid-column:auto!important}
}

@media(max-width:390px){
  .metric-grid,.career-grid,.summary{grid-template-columns:1fr!important}
  .app-nav-link,.app-nav-button,.app-more>summary{padding:9px 10px!important;font-size:.69rem!important}
}
'''
css_path.write_text(css)

print('mobile glass v5 applied')
