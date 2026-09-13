from pathlib import Path
import re

# Auto-load Owner Dashboard on initial page load, and make manual action a refresh.
for name in ['home.html','index.html']:
    p=Path(name)
    text=p.read_text()
    old='''      }catch(error){}\n    }\n\n    function applyTheme(theme){'''
    new='''      }catch(error){}\n      if(els.username.value.trim()) await loadDashboard();\n    }\n\n    function applyTheme(theme){'''
    if old not in text:
        raise SystemExit(f'initialize anchor missing in {name}')
    text=text.replace(old,new,1)
    text=text.replace('>Load Owner Dashboard</button>','>Refresh Owner Dashboard</button>',1)
    text=re.sub(r'<title>.*?</title>', '<title>Fantasy Assistant · Owner Dashboard</title>', text, count=1, flags=re.S)
    p.write_text(text)

# Give every page a static Fantasy Assistant browser title before shared JS enhances it.
titles={
  'schedule-tool.html':'Watch Planner',
  'team-rankings.html':'Rankings',
  'waiver-wire-agent.html':'Waivers',
  'lineup-assistant.html':'Lineup Check',
  'crunchtime.html':'Crunchtime',
}
for name,page in titles.items():
    p=Path(name)
    text=p.read_text()
    text=re.sub(r'<title>.*?</title>', f'<title>Fantasy Assistant · {page}</title>', text, count=1, flags=re.S)
    p.write_text(text)

css=Path('app-shell.css')
text=css.read_text()
marker='/* fantasy-assistant-brand-v7 */'
if marker in text:
    raise SystemExit('branding css already applied')
text += r'''

/* fantasy-assistant-brand-v7 */
.app-product-name{
  margin:0 0 3px;
  font-size:.58rem;
  line-height:1;
  font-weight:950;
  letter-spacing:.105em;
  text-transform:uppercase;
  background:var(--app-gradient);
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
}
html[data-theme="dark"] .app-product-name{filter:brightness(1.16) saturate(1.05)}
@media(max-width:560px){
  .app-product-name{font-size:.55rem;letter-spacing:.09em;margin-bottom:4px}
}
'''
css.write_text(text)
print('Fantasy Assistant branding and Owner Dashboard autoload applied')
