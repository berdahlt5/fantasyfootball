from pathlib import Path

# Patch the shared navigation using the actual buildNav() markup.
js_path = Path('app-shell.js')
js = js_path.read_text()
nav_replacements = [
    ('link("index.html","Dashboard","index.html",current)', 'link("index.html","Owner Dashboard","index.html",current)'),
    ('link("schedule-tool.html","Watch","schedule-tool.html",current)', 'link("schedule-tool.html","Watch Planner","schedule-tool.html",current)'),
]
for old, new in nav_replacements:
    if old not in js:
        raise SystemExit(f'actual app-shell nav anchor not found: {old}')
    js = js.replace(old, new, 1)
js_path.write_text(js)

# Reuse the already-reviewed v5 page/CSS patch, skipping only its stale nav block.
source_path = Path('tools/apply-mobile-glass-v5.py')
source = source_path.read_text()
start = source.index('# Shared navigation labels.')
end = source.index('# Watch Planner page branding.')
source = source[:start] + '# Shared navigation labels patched by v5b.\n\n' + source[end:]
exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__'})
