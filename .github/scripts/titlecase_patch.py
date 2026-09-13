from pathlib import Path

FILES = [
    "index.html",
    "home.html",
    "schedule-tool.html",
    "team-rankings.html",
    "waiver-wire-agent.html",
    "lineup-assistant.html",
    "crunchtime.html",
    "app-shell.js",
]

REPLACEMENTS = {
    "Lineup check": "Lineup Check",
    "Team projections": "Team Projections",
    "Owner history": "Owner History",
    "Draft history": "Draft History",
    "Live league scores": "Live League Scores",
    "Leagues & priorities": "Leagues & Priorities",
    "Current season": "Current Season",
    "Owner dashboard": "Owner Dashboard",
    "Watch planner": "Watch Planner",
    "Best games to watch": "Best Games to Watch",
    "Full lineup assistant": "Full Lineup Assistant",
    "App settings": "App Settings",
    "Favorite NFL team": "Favorite NFL Team",
    "Games you can watch at once": "Games You Can Watch at Once",
    "Starred leagues": "Starred Leagues",
    "Sleeper username": "Sleeper Username",
}

changed = []
for filename in FILES:
    path = Path(filename)
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in REPLACEMENTS.items():
        text = text.replace(old, new)
    if text != original:
        path.write_text(text, encoding="utf-8")
        changed.append(filename)

print("Capitalized UI titles in:", ", ".join(changed) if changed else "no files")
