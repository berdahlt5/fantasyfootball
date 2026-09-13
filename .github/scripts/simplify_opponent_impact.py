from pathlib import Path

p = Path('schedule-tool.html')
s = p.read_text()

old_fn = '''    function scheduleImpactPlayerMarkup(player) {
      const impact = scheduleImpactForPlayer(player.playerId);
      return `<div class="impact-player"><div class="impact-player-main"><span>${escapeHtml(player.name)}</span><span class="impact-pos">${escapeHtml(player.position || "")}</span>${impact.projection > 0 ? `<span class="impact-proj">proj ~${impact.projection.toFixed(1)}</span>` : ""}</div><div class="impact-lines">${impact.helps.length ? `<span class="impact-help">↑ Helps: ${escapeHtml(scheduleLeagueTagList(impact.helps))}</span>` : ""}${impact.hurts.length ? `<span class="impact-hurt">↓ Hurts: ${escapeHtml(scheduleLeagueTagList(impact.hurts))}</span>` : ""}</div></div>`;
    }
'''
new_fn = '''    function scheduleImpactPlayerMarkup(player) {
      const impact = scheduleImpactForPlayer(player.playerId);
      return `<div class="impact-player"><div class="impact-player-main"><span>${escapeHtml(player.name)}</span><span class="impact-pos">${escapeHtml(player.position || "")}</span>${impact.projection > 0 ? `<span class="impact-proj">proj ~${impact.projection.toFixed(1)}</span>` : ""}</div><div class="impact-lines">${impact.helps.length ? `<span class="impact-help">↑ Helps: ${escapeHtml(scheduleLeagueTagList(impact.helps))}</span>` : ""}${impact.hurts.length ? `<span class="impact-hurt">↓ Hurts: ${escapeHtml(scheduleLeagueTagList(impact.hurts))}</span>` : ""}</div></div>`;
    }

    function scheduleOpponentPlayerMarkup(player) {
      const projection = schedulePlayerProjection(player.playerId);
      return `<div class="impact-player"><div class="impact-player-main"><span>${escapeHtml(player.name)}</span><span class="impact-pos">${escapeHtml(player.position || "")}</span>${projection > 0 ? `<span class="impact-proj">proj ~${projection.toFixed(1)}</span>` : ""}</div></div>`;
    }
'''
assert old_fn in s, 'impact player function not found'
s = s.replace(old_fn, new_fn, 1)

old_opp = 'analysis.oppAll.map(scheduleImpactPlayerMarkup).join("")'
new_opp = 'analysis.oppAll.map(scheduleOpponentPlayerMarkup).join("")'
assert old_opp in s, 'opponent impact rendering not found'
s = s.replace(old_opp, new_opp, 1)

p.write_text(s)
print('opponent impact simplified')
