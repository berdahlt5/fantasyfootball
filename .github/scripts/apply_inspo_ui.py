from pathlib import Path

p = Path('app-shell.css')
s = p.read_text()
marker = '/* inspo-ui-v1 */'
assert marker not in s, 'inspo ui already applied'

block = r'''

/* inspo-ui-v1 */
:root{
  --app-bg:#f3f6ff;
  --app-surface:#ffffff;
  --app-surface-subtle:#f7f9ff;
  --app-border:rgba(55,72,104,.16);
  --app-text:#20283a;
  --app-muted:#667085;
  --app-accent:#5265f6;
  --app-accent-strong:#3448d8;
  --app-accent-soft:#edf2ff;
  --app-cyan:#24cfe5;
  --app-gradient:linear-gradient(135deg,#27d4e7 0%,#438ff5 48%,#635df3 100%);
  --app-gradient-soft:linear-gradient(135deg,rgba(39,212,231,.13),rgba(67,143,245,.11) 52%,rgba(99,93,243,.12));
  --app-shadow:0 12px 34px rgba(49,69,128,.10);
}
html[data-theme="dark"]{
  --app-bg:#0f1420;
  --app-surface:#171e2b;
  --app-surface-subtle:#1d2635;
  --app-border:rgba(185,201,228,.18);
  --app-text:#f4f7ff;
  --app-muted:#aeb9ca;
  --app-accent:#8190ff;
  --app-accent-strong:#b0bcff;
  --app-accent-soft:#253151;
  --app-cyan:#57d8e8;
  --app-gradient:linear-gradient(135deg,#39d3e5 0%,#6097ff 50%,#8a76ff 100%);
  --app-gradient-soft:linear-gradient(135deg,rgba(57,211,229,.13),rgba(96,151,255,.14) 52%,rgba(138,118,255,.13));
  --app-shadow:0 14px 36px rgba(0,0,0,.26);
}

body{
  background:
    radial-gradient(circle at 10% 0%,rgba(36,207,229,.13),transparent 26rem),
    radial-gradient(circle at 92% 2%,rgba(99,93,243,.11),transparent 28rem),
    var(--app-bg)!important;
  background-attachment:fixed!important;
}

.topbar{
  border-radius:22px!important;
  padding:14px 16px!important;
  background:color-mix(in srgb,var(--app-surface) 94%, transparent)!important;
  border:1px solid color-mix(in srgb,var(--app-border) 86%, transparent)!important;
  box-shadow:0 14px 36px rgba(48,69,126,.10)!important;
  backdrop-filter:blur(16px) saturate(125%);
}
html[data-theme="dark"] .topbar{box-shadow:0 16px 38px rgba(0,0,0,.28)!important}
.brand-mark{
  border-radius:14px!important;
  background:var(--app-gradient-soft)!important;
  border:1px solid color-mix(in srgb,var(--app-accent) 22%, var(--app-border))!important;
}

.app-nav{
  gap:3px!important;
  padding:4px!important;
  border:1px solid color-mix(in srgb,var(--app-border) 90%, transparent);
  border-radius:999px;
  background:color-mix(in srgb,var(--app-surface) 88%, var(--app-accent-soft));
  box-shadow:0 6px 18px rgba(54,74,134,.07);
}
.app-nav-link,.app-nav-button,.app-more>summary{
  border-radius:999px!important;
  min-height:36px!important;
  padding:8px 12px!important;
  font-weight:800!important;
}
.app-nav-link.active,.app-more>summary.active{
  background:var(--app-gradient)!important;
  color:#fff!important;
  border-color:transparent!important;
  box-shadow:0 6px 16px rgba(74,108,244,.23)!important;
}
.app-nav-link.active:hover,.app-more>summary.active:hover{color:#fff!important}
.app-settings-button{
  background:var(--app-surface)!important;
  border-color:var(--app-border)!important;
  color:var(--app-text)!important;
}
.app-more-menu{
  border-radius:16px!important;
  border-color:var(--app-border)!important;
  box-shadow:0 18px 44px rgba(35,52,98,.16)!important;
  overflow:hidden;
}

.panel,.game-card,.watch-card,.league-card,.live-score-card,.remaining-box,.lineup-row,.sidebar-row,.metric,.metric-band,.team-history-team,.draft-team,.draft-season,.impact-player{
  border-radius:18px!important;
}
.panel{
  border-color:var(--app-border)!important;
  box-shadow:var(--app-shadow)!important;
  background:color-mix(in srgb,var(--app-surface) 97%, var(--app-accent-soft))!important;
}
.controls{padding:14px!important}
.section,.league-body,.crunch-body{padding:14px!important}

.primary,.app-settings-save{
  background:var(--app-gradient)!important;
  color:#fff!important;
  border-color:transparent!important;
  box-shadow:0 7px 18px rgba(74,108,244,.20)!important;
}
.primary:hover:not(:disabled),.app-settings-save:hover{filter:brightness(1.03);transform:translateY(-1px)}
html[data-theme="dark"] .primary,html[data-theme="dark"] .app-settings-save{color:#fff!important}
.secondary,.secondary-btn{
  background:var(--app-surface)!important;
  border-color:var(--app-border)!important;
  color:var(--app-text)!important;
}
input,select,textarea{
  border-radius:12px!important;
  border-color:var(--app-border)!important;
  min-height:40px;
}
input:focus,select:focus,textarea:focus{
  border-color:var(--app-accent)!important;
  box-shadow:0 0 0 4px color-mix(in srgb,var(--app-accent) 14%, transparent)!important;
}

.metric{
  position:relative;
  overflow:hidden;
  background:var(--app-surface)!important;
  border-color:var(--app-border)!important;
  box-shadow:0 8px 24px rgba(47,69,127,.07)!important;
}
.metric::before{
  content:"";
  position:absolute;
  inset:0 0 auto 0;
  height:4px;
  background:var(--app-gradient);
}
.metric-value{color:var(--app-accent-strong)!important;font-weight:900!important}

.watch-window{margin-bottom:24px!important}
.watch-window-head{padding:0 3px 2px!important}
.watch-window-title{font-size:1rem!important;font-weight:900!important;letter-spacing:-.01em!important}
.watch-window-note{font-size:.63rem!important;color:var(--app-muted)!important}
.watch-card{
  background:var(--app-surface)!important;
  border:1px solid var(--app-border)!important;
  box-shadow:0 8px 24px rgba(48,69,127,.07)!important;
  overflow:hidden;
}
.watch-card-main{padding:13px 14px!important}
.watch-teams{font-size:1rem!important;font-weight:900!important;letter-spacing:-.012em!important}
.watch-time{font-size:.7rem!important}
.watch-details>summary{
  padding:9px 12px!important;
  background:var(--app-surface-subtle)!important;
  border-top:1px solid var(--app-border)!important;
  color:var(--app-muted)!important;
}

.window-ranked-game.recommended>.watch-card{
  border:2px solid transparent!important;
  background:linear-gradient(var(--app-surface),var(--app-surface)) padding-box,var(--app-gradient) border-box!important;
  box-shadow:0 12px 30px rgba(71,101,230,.15)!important;
}
.window-ranked-game.must-watch>.watch-card{
  box-shadow:0 14px 34px rgba(71,101,230,.22)!important;
}
.window-ranked-game.recommended .window-rank{
  display:inline-flex!important;
  align-items:center!important;
  min-height:22px!important;
  padding:4px 8px!important;
  border-radius:999px!important;
  background:var(--app-gradient)!important;
  color:#fff!important;
  font-size:.58rem!important;
  letter-spacing:.045em!important;
  box-shadow:0 5px 14px rgba(74,108,244,.18)!important;
}
.window-ranked-game:not(.recommended) .window-rank{color:var(--app-muted)!important}

.watch-tier.must,.watch-tier.watch{
  background:var(--app-gradient)!important;
  color:#fff!important;
  border-color:transparent!important;
  box-shadow:0 4px 12px rgba(74,108,244,.18)!important;
}
.watch-tier.radar{
  background:var(--app-accent-soft)!important;
  color:var(--app-accent-strong)!important;
  border-color:color-mix(in srgb,var(--app-accent) 18%, var(--app-border))!important;
}
.watch-tier.skip,.watch-tier.final{background:var(--app-surface-subtle)!important;color:var(--app-muted)!important}
.priority-game{
  border-color:transparent!important;
  box-shadow:0 12px 30px rgba(71,101,230,.17)!important;
}
.favorite-watch,.priority-badge,.watch-count.starred{
  background:#fff7df!important;
  color:#8c5e00!important;
  border-color:#e9c971!important;
}
html[data-theme="dark"] .favorite-watch,html[data-theme="dark"] .priority-badge,html[data-theme="dark"] .watch-count.starred{
  background:#352d19!important;color:#ffd36a!important;border-color:#6f5a20!important;
}

.impact-player{
  background:var(--app-surface-subtle)!important;
  border-color:var(--app-border)!important;
  padding:9px 10px!important;
}
.impact-player-main{font-size:.74rem!important}
.impact-help{color:#217a51!important;font-weight:800!important}
.impact-hurt{color:#b23d55!important;font-weight:800!important}
html[data-theme="dark"] .impact-help{color:#86dbac!important}
html[data-theme="dark"] .impact-hurt{color:#ff9caf!important}

.lineup-issue.critical,.alert.critical{box-shadow:inset 4px 0 0 var(--app-danger)!important}
.lineup-issue.warn,.alert.warn{box-shadow:inset 4px 0 0 var(--app-warning)!important}
.lineup-issue.timing{box-shadow:inset 4px 0 0 var(--app-accent)!important}
.lineup-clear,.alert.good{box-shadow:inset 4px 0 0 var(--app-success)!important}

.app-settings-dialog{
  border-radius:22px!important;
  border-color:var(--app-border)!important;
  box-shadow:0 26px 70px rgba(31,48,96,.24)!important;
}
.app-settings-head{background:var(--app-gradient-soft)!important}

@media(max-width:820px){
  .topbar{border-radius:18px!important}
  .app-nav{border-radius:18px!important;padding:5px!important}
  .app-nav-link,.app-nav-button,.app-more>summary{padding:8px 10px!important}
  .panel,.game-card,.watch-card,.metric{border-radius:16px!important}
}
'''

p.write_text(s + block)
print('inspiration UI applied')
