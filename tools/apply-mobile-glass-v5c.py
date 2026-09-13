from pathlib import Path
import re

# Shared navigation labels, using the actual buildNav() markup.
js_path = Path('app-shell.js')
js = js_path.read_text()
nav_replacements = [
    ('link("index.html","Dashboard","index.html",current)', 'link("index.html","Owner Dashboard","index.html",current)'),
    ('link("schedule-tool.html","Watch","schedule-tool.html",current)', 'link("schedule-tool.html","Watch Planner","schedule-tool.html",current)'),
]
for old, new in nav_replacements:
    if old not in js:
        raise SystemExit(f'app-shell nav anchor not found: {old}')
    js = js.replace(old, new, 1)
js_path.write_text(js)

# Brand the schedule page as Watch Planner without depending on the old H1 wording.
schedule_path = Path('schedule-tool.html')
schedule = schedule_path.read_text()
if '<title>Fantasy Football Schedule Tool</title>' in schedule:
    schedule = schedule.replace('<title>Fantasy Football Schedule Tool</title>', '<title>Fantasy Football Watch Planner</title>', 1)
elif '<title>Fantasy Football Watch Planner</title>' not in schedule:
    raise SystemExit('schedule title not recognized')
schedule, h1_count = re.subn(r'<h1(?:\s[^>]*)?>.*?</h1>', '<h1>Watch Planner</h1>', schedule, count=1, flags=re.S)
if h1_count != 1:
    raise SystemExit('could not replace first schedule h1')
schedule_path.write_text(schedule)

# Reuse the reviewed CSS portion of v5, skipping its stale nav/branding sections.
source_path = Path('tools/apply-mobile-glass-v5.py')
source = source_path.read_text()
start = source.index('# Shared navigation labels.')
end = source.index('# Shared visual/mobile polish.')
source = source[:start] + '# Shared navigation and Watch Planner branding patched by v5c.\n\n' + source[end:]
exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__'})
