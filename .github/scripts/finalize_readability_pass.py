from pathlib import Path

# 1) Allow users to intentionally have zero starred leagues.
p = Path('app-shell.js')
s = p.read_text()
old = '''  function readPriorityLeagues() {
    try {
      const parsed = JSON.parse(safeGet(KEYS.priorityLeagues, "[]"));
      if (Array.isArray(parsed) && parsed.length) return normalizePriorityLeagues(parsed);
    } catch (_) {}
    const defaults = [...DEFAULT_PRIORITY_LEAGUES];
    safeSet(KEYS.priorityLeagues, JSON.stringify(defaults));
    return defaults;
  }
'''
new = '''  function readPriorityLeagues() {
    const stored = safeGet(KEYS.priorityLeagues, "");
    if (stored !== "") {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return normalizePriorityLeagues(parsed);
      } catch (_) {}
    }
    const defaults = [...DEFAULT_PRIORITY_LEAGUES];
    safeSet(KEYS.priorityLeagues, JSON.stringify(defaults));
    return defaults;
  }
'''
assert old in s, 'priority settings block not found'
p.write_text(s.replace(old, new))

# 2) Make Schedule Tool immediately re-read starred leagues after Settings changes.
p = Path('schedule-tool.html')
s = p.read_text()
old = 'window.addEventListener("fantasy-settings-changed", () => renderAll());'
new = '''window.addEventListener("fantasy-settings-changed", () => {
      state.priorityLeagueNames = loadPriorityLeagueNames();
      renderLeagueFilters();
      renderAll();
    });'''
assert old in s, 'schedule settings listener not found'
p.write_text(s.replace(old, new))

# 3) Make Lineup Assistant immediately re-read starred leagues after Settings changes.
p = Path('lineup-assistant.html')
s = p.read_text()
needle = 'els.loadBtn.addEventListener("click",load);'
insert = 'window.addEventListener("fantasy-settings-changed",()=>{state.priorityNames=readPriorityNames();if(state.leagues.length)render()});'
assert needle in s, 'lineup listener anchor not found'
s = s.replace(needle, insert + needle, 1)
p.write_text(s)

print('readability finalize patch complete')
