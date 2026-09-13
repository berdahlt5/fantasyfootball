from pathlib import Path

path = Path('app-shell.css')
css = path.read_text()
marker = '/* mobile-nav-v8 */'
if marker in css:
    raise SystemExit('mobile-nav-v8 already applied')

patch = r'''

/* mobile-nav-v8 */
@media(max-width:640px){
  /* Mobile navigation should never hide actions off-screen. */
  .header-actions{
    display:block!important;
    width:100%!important;
    overflow:visible!important;
  }
  .app-nav{
    width:100%!important;
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:6px!important;
    overflow:visible!important;
    padding:6px!important;
    border-radius:19px!important;
    background:rgba(255,255,255,.42)!important;
    border:1px solid rgba(255,255,255,.68)!important;
    box-shadow:0 14px 32px rgba(57,78,145,.10),inset 0 1px 0 rgba(255,255,255,.88)!important;
    backdrop-filter:blur(18px) saturate(132%)!important;
    -webkit-backdrop-filter:blur(18px) saturate(132%)!important;
  }
  html[data-theme="dark"] .app-nav{
    background:rgba(22,29,45,.62)!important;
    border-color:rgba(255,255,255,.10)!important;
    box-shadow:0 16px 34px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.07)!important;
  }
  .app-nav-link,
  .app-nav-button,
  .app-more>summary{
    width:100%!important;
    min-width:0!important;
    min-height:42px!important;
    padding:9px 10px!important;
    justify-content:center!important;
    text-align:center!important;
    white-space:nowrap!important;
    border-radius:14px!important;
    font-size:.72rem!important;
  }
  .app-more{
    position:static!important;
    width:100%!important;
    min-width:0!important;
  }
  .app-more>summary{
    display:flex!important;
  }
  .app-more>summary::after{
    content:"⌄";
    margin-left:5px;
    font-size:.78rem;
    line-height:1;
    opacity:.72;
  }
  .app-more[open]>summary::after{content:"⌃"}
  .app-settings-button,
  .app-more>summary:not(.active){
    background:var(--app-gradient-soft)!important;
    color:var(--app-heading)!important;
    border-color:rgba(74,112,220,.14)!important;
  }
  html[data-theme="dark"] .app-settings-button,
  html[data-theme="dark"] .app-more>summary:not(.active){
    background:linear-gradient(135deg,rgba(39,201,232,.10),rgba(67,140,245,.12) 52%,rgba(106,92,244,.14))!important;
    color:#dce5ff!important;
    border-color:rgba(141,160,255,.14)!important;
  }
  .app-more-menu{
    position:fixed!important;
    z-index:1400!important;
    left:10px!important;
    right:10px!important;
    top:auto!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
    width:auto!important;
    min-width:0!important;
    max-height:min(60vh,360px)!important;
    overflow:auto!important;
    padding:9px!important;
    border-radius:22px!important;
    background:rgba(250,252,255,.82)!important;
    border:1px solid rgba(255,255,255,.78)!important;
    box-shadow:0 26px 64px rgba(43,61,125,.24),0 8px 22px rgba(38,52,104,.12),inset 0 1px 0 rgba(255,255,255,.92)!important;
    backdrop-filter:blur(24px) saturate(140%)!important;
    -webkit-backdrop-filter:blur(24px) saturate(140%)!important;
  }
  html[data-theme="dark"] .app-more-menu{
    background:rgba(22,29,45,.90)!important;
    border-color:rgba(255,255,255,.10)!important;
    box-shadow:0 28px 68px rgba(0,0,0,.50),inset 0 1px 0 rgba(255,255,255,.06)!important;
  }
  .app-more-menu a{
    min-height:46px!important;
    display:flex!important;
    align-items:center!important;
    padding:11px 13px!important;
    border-radius:14px!important;
    font-size:.80rem!important;
  }
  .app-more-menu a+a{margin-top:4px!important}
}

@media(max-width:390px){
  .app-nav-link,.app-nav-button,.app-more>summary{
    padding:9px 7px!important;
    font-size:.69rem!important;
  }
}
'''

path.write_text(css + patch)
print('Applied mobile-nav-v8')
