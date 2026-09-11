from pathlib import Path
import re

p = Path('schedule-tool.html')
s = p.read_text()
marker = '/* watch-priority-v1 */'
if marker in s:
    print('Already patched')
    raise SystemExit(0)

css = r'''
    /* watch-priority-v1 */
    .games{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
    .watch-card{position:relative;overflow:hidden;border-radius:14px!important}
    .watch-card-main{padding:11px 12px}
    .watch-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .watch-matchup{min-width:0}
    .watch-teams{color:var(--mint);font-size:1rem;font-weight:1000;line-height:1.15}
    .watch-kickoff{margin-top:3px;color:var(--muted);font-size:.7rem;font-weight:800}
    .watch-tier{flex:0 0 auto;display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;font-size:.61rem;font-weight:1000;text-transform:uppercase;letter-spacing:.055em;border:1px solid rgba(132,186,215,.32);background:rgba(132,186,215,.12);color:var(--sky)}
    .watch-tier.must{border-color:rgba(216,169,74,.65);background:rgba(216,169,74,.17);color:#F2CC7C}
    .watch-tier.watch{border-color:rgba(169,230,165,.52);background:rgba(169,230,165,.1);color:#B9F0B5}
    .watch-tier.radar{color:var(--sky)}
    .watch-tier.skip{color:var(--muted);opacity:.72}
    .watch-counts{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
    .watch-count{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;background:rgba(255,255,237,.08);border:1px solid rgba(132,186,215,.18);color:var(--muted);font-size:.63rem;font-weight:900}
    .watch-count strong{color:var(--mint);font-size:.73rem}
    .watch-count.starred{border-color:rgba(216,169,74,.34);color:#F0CA78}
    .watch-count.starred strong{color:#F0CA78}
    .watch-roots{display:grid;gap:4px;margin-top:9px}
    .watch-root-line{min-width:0;color:var(--muted);font-size:.69rem;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .watch-root-line strong{color:var(--sky);margin-right:4px}
    .crunch-flags{display:grid;gap:5px;margin-top:9px}
    .crunch-flag{padding:7px 8px;border-radius:8px;border:1px solid rgba(216,169,74,.46);background:rgba(216,169,74,.1);color:#F4D58E;font-size:.68rem;font-weight:1000;line-height:1.3}
    .crunch-flag.priority{box-shadow:inset 3px 0 0 rgba(216,169,74,.94)}
    .watch-details{border-top:1px solid rgba(132,186,215,.14)}
    .watch-details>summary{cursor:pointer;list-style:none;padding:7px 11px;color:var(--muted);font-size:.64rem;font-weight:1000;text-transform:uppercase;letter-spacing:.045em;background:rgba(57,50,43,.3)}
    .watch-details>summary::-webkit-details-marker{display:none}
    .watch-details>summary::after{content:' +';color:var(--gold)}
    .watch-details[open]>summary::after{content:' −'}
    .watch-details .game-league-groups{padding:8px 9px 9px!important}
    .watch-none{padding:5px 0;color:var(--muted);font-size:.65rem}
    .watch-card.final-card{opacity:.48;filter:grayscale(.65)}
    @media(max-width:980px){.games{grid-template-columns:1fr!important}}
'''
s = s.replace('</style>', css + '\n</style>', 1)

helpers = r'''
    const WATCH_SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

    function watchGameForExposure(exposure) {
      const team = normalizeTeam(exposure?.team);
      if (!team) return null;
      return (state.games || []).find(game => game.away?.abbreviation === team || game.home?.abbreviation === team) || null;
    }

    function watchRemainingExposure(exposure) {
      const game = watchGameForExposure(exposure);
      return Boolean(game && !game.completed && String(game.statusState || "").toLowerCase() !== "post");
    }

    function uniqueExposurePlayers(items) {
      const map = new Map();
      for (const item of items || []) {
        const id = String(item.playerId || item.name || "");
        if (!id) continue;
        if (!map.has(id)) map.set(id, item);
      }
      return [...map.values()];
    }

    function crunchSignalsForGame(game) {
      const signals = [];
      const gameTeams = new Set([game.away?.abbreviation, game.home?.abbreviation].filter(Boolean));
      const add = signal => {
        const key = `${signal.leagueId}|${signal.text}`;
        if (!signals.some(item => `${item.leagueId}|${item.text}` === key)) signals.push(signal);
      };

      for (const live of state.liveScores || []) {
        if (!live || live.error) continue;
        const league = state.leagues.find(item => String(item.league_id) === String(live.leagueId));
        if (!league || league.isBestBall) continue;
        const leagueName = league.name || "League";
        const priority = isPriorityLeagueName(leagueName);
        const myScore = Number(live.myScore || 0);
        const oppScore = Number(live.opponentScore || 0);
        const margin = myScore - oppScore;

        const myRemaining = uniqueExposurePlayers((state.rosterExposures || []).filter(item =>
          String(item.leagueId) === String(live.leagueId) && item.bucket === "starter" && watchRemainingExposure(item)
        ));
        const oppRemaining = uniqueExposurePlayers((state.opponentExposures || []).filter(item =>
          String(item.leagueId) === String(live.leagueId) && item.bucket === "starter" && watchRemainingExposure(item)
        ));

        const mineHere = myRemaining.filter(item => gameTeams.has(normalizeTeam(item.team)));
        const oppHere = oppRemaining.filter(item => gameTeams.has(normalizeTeam(item.team)));
        const remainingGameIds = new Set([...myRemaining, ...oppRemaining].map(item => watchGameForExposure(item)?.id).filter(Boolean));

        if (myRemaining.length === 1 && oppRemaining.length === 0 && mineHere.length === 1) {
          const player = mineHere[0];
          const need = Math.max(0, oppScore - myScore + 0.01);
          const must = need > 0 ? (need <= 25 || (priority && need <= 35)) : priority;
          add({
            leagueId: live.leagueId,
            leagueName,
            priority,
            must,
            weight: must ? (priority ? 42 : 34) : 20,
            text: need > 0
              ? `${priority ? "★ " : ""}${leagueName}: need ${need.toFixed(1)} more from ${player.name} to move ahead`
              : `${priority ? "★ " : ""}${leagueName}: ${player.name} is your last player with a ${Math.abs(margin).toFixed(1)}-point lead`
          });
          continue;
        }

        if (myRemaining.length === 0 && oppRemaining.length === 1 && oppHere.length === 1) {
          const player = oppHere[0];
          const cushion = myScore - oppScore;
          const must = cushion > 0 && (cushion <= 20 || (priority && cushion <= 30));
          add({
            leagueId: live.leagueId,
            leagueName,
            priority,
            must,
            weight: must ? (priority ? 40 : 31) : 16,
            text: cushion > 0
              ? `${priority ? "★ " : ""}${leagueName}: keep ${player.name} under ${cushion.toFixed(1)} more points`
              : `${priority ? "★ " : ""}${leagueName}: only ${player.name} remains for your opponent; you trail by ${Math.abs(cushion).toFixed(1)}`
          });
          continue;
        }

        if (myRemaining.length === 1 && oppRemaining.length === 1 && (mineHere.length || oppHere.length)) {
          const mine = myRemaining[0];
          const opp = oppRemaining[0];
          const must = Math.abs(margin) <= 20 || priority;
          const condition = margin < 0
            ? `${mine.name} needs to outscore ${opp.name} by more than ${Math.abs(margin).toFixed(1)} from here`
            : `${mine.name} can be outscored by less than ${margin.toFixed(1)} by ${opp.name}`;
          add({
            leagueId: live.leagueId,
            leagueName,
            priority,
            must,
            weight: must ? (priority ? 42 : 32) : 19,
            text: `${priority ? "★ " : ""}${leagueName}: ${condition}`
          });
          continue;
        }

        if (remainingGameIds.size === 1 && remainingGameIds.has(game.id) && (mineHere.length || oppHere.length)) {
          const close = Math.abs(margin) <= (priority ? 30 : 20);
          add({
            leagueId: live.leagueId,
            leagueName,
            priority,
            must: close,
            weight: close ? (priority ? 36 : 27) : 14,
            text: `${priority ? "★ " : ""}${leagueName}: final NFL game with active starters · ${Math.abs(margin).toFixed(1)}-point margin`
          });
        }
      }

      return signals.sort((a, b) => Number(b.must) - Number(a.must) || Number(b.priority) - Number(a.priority) || b.weight - a.weight);
    }

    function watchAnalysis(game) {
      const completed = Boolean(game.completed) || String(game.statusState || "").toLowerCase() === "post";
      const mySkill = groupPlayerExposures((game.exposures || []).filter(item => WATCH_SKILL_POSITIONS.has(String(item.position || "").toUpperCase())));
      const oppSkill = groupPlayerExposures((game.opponentExposures || []).filter(item => WATCH_SKILL_POSITIONS.has(String(item.position || "").toUpperCase())));
      const starredMine = mySkill.filter(player => [...player.leagues].some(name => isPriorityLeagueName(name)));
      const starredOpp = oppSkill.filter(player => [...player.leagues].some(name => isPriorityLeagueName(name)));
      const priorityLeagueIds = new Set([...(game.exposures || []), ...(game.opponentExposures || [])]
        .filter(item => isPriorityLeagueName(item.leagueName))
        .map(item => String(item.leagueId)));
      const crunch = completed ? [] : crunchSignalsForGame(game);

      let score = mySkill.length * 3 + oppSkill.length * 2 + starredMine.length * 5 + starredOpp.length * 3 + priorityLeagueIds.size * 2;
      if (mySkill.length >= 2) score += 2;
      if (crunch.length) score += Math.max(...crunch.map(item => item.weight || 0));
      if (completed) score = -100;

      let tier = "skip", label = "Skip";
      if (completed) { tier = "final"; label = "Final"; }
      else if (crunch.some(item => item.must) || score >= 24) { tier = "must"; label = "Must Watch"; }
      else if (score >= 7) { tier = "watch"; label = "Watch"; }
      else if (score >= 3) { tier = "radar"; label = "On Radar"; }

      return {
        score, tier, label, crunch,
        mine: mySkill,
        opponents: oppSkill,
        myCount: mySkill.length,
        starredCount: starredMine.length,
        opponentCount: oppSkill.length,
        priorityLeagueCount: priorityLeagueIds.size
      };
    }

'''
anchor = '    function aggregateData() {'
if anchor not in s:
    raise SystemExit('aggregateData anchor not found')
s = s.replace(anchor, helpers + anchor, 1)

old_sort = '''      const sort = els.sort.value;\n      gameRows.sort((a, b) => {\n        if (sort === "priority") {'''
new_sort = '''      const sort = els.sort.value;\n      gameRows.sort((a, b) => {\n        if (sort === "watch") {\n          const aWatch = watchAnalysis(a);\n          const bWatch = watchAnalysis(b);\n          return bWatch.score - aWatch.score || new Date(a.date).getTime() - new Date(b.date).getTime();\n        }\n        if (sort === "priority") {'''
if old_sort not in s:
    raise SystemExit('sort anchor not found')
s = s.replace(old_sort, new_sort, 1)

s = s.replace('<option value="priority">Priority leagues first</option>', '<option value="watch" selected>Best games to watch</option>\n            <option value="priority">Priority leagues first</option>', 1)
s = s.replace('<option value="kickoff" selected>Kickoff time</option>', '<option value="kickoff">Kickoff time</option>', 1)

new_render = r'''    function renderGame(game, kickoffMode = false, kickoffColorMap = new Map()) {
      const analysis = watchAnalysis(game);
      const kickoff = formatKickoffLabel(game.date, game.status || "TBD");
      const isPast = Boolean(game.completed) || String(game.statusState || "").toLowerCase() === "post";
      const matchup = `${game.away.abbreviation} @ ${game.home.abbreviation}`;

      const leagueIds = new Set([...(game.exposures || []), ...(game.opponentExposures || [])].map(item => String(item.leagueId)));
      const leagueGroups = [...leagueIds].map(leagueId => {
        const league = state.leagues.find(item => String(item.league_id) === leagueId);
        const mineRaw = (game.exposures || []).filter(item => String(item.leagueId) === leagueId);
        const oppRaw = (game.opponentExposures || []).filter(item => String(item.leagueId) === leagueId);
        const fallback = mineRaw[0]?.leagueName || oppRaw[0]?.leagueName || "League";
        const name = league?.name || String(fallback).split(":")[0].trim();
        return {
          leagueId,
          name,
          priority: isPriorityLeagueName(name),
          opponentName: oppRaw[0]?.opponentName || "Opponent",
          mine: groupPlayerExposures(mineRaw),
          opp: groupPlayerExposures(oppRaw)
        };
      }).sort((a, b) => Number(b.priority) - Number(a.priority) || a.name.localeCompare(b.name));

      const detailRows = players => players.length ? players.map(player => `
        <div class="league-player-row">
          ${playerAvatarMarkup(player)}
          <div><div class="league-player-name">${escapeHtml(player.name)}</div><div class="league-player-meta">${escapeHtml(player.position)} · ${escapeHtml([...player.buckets].map(bucketLabel).join(" / "))}</div></div>
        </div>`).join("") : `<div class="watch-none">None</div>`;

      const leagueDetails = leagueGroups.length ? leagueGroups.map(group => `
        <section class="game-league-block ${group.priority ? "priority" : ""}">
          <div class="game-league-head"><div class="game-league-name">${escapeHtml(group.name)}</div>${group.priority ? '<span class="priority-label">★ Priority</span>' : ''}</div>
          <div class="game-league-columns">
            <div class="game-league-column"><div class="game-column-title">Your players</div>${detailRows(group.mine)}</div>
            <div class="game-league-column"><div class="game-column-title">${escapeHtml(group.opponentName)}</div>${detailRows(group.opp)}</div>
          </div>
        </section>`).join("") : `<div class="empty">No player details for this game.</div>`;

      const nameList = players => {
        const shown = players.slice(0, 4).map(player => `${player.name} (${player.position})`);
        if (players.length > 4) shown.push(`+${players.length - 4} more`);
        return shown.join(", ");
      };

      const crunchMarkup = analysis.crunch.length
        ? `<div class="crunch-flags">${analysis.crunch.slice(0, 2).map(item => `<div class="crunch-flag ${item.priority ? "priority" : ""}">${escapeHtml(item.text)}</div>`).join("")}</div>`
        : "";

      return `
        <article class="game-card watch-card ${isPast ? "final-card" : ""}">
          <div class="watch-card-main">
            <div class="watch-card-top">
              <div class="watch-matchup"><div class="watch-teams">${escapeHtml(matchup)}</div><div class="watch-kickoff">${escapeHtml(kickoff)}</div></div>
              <span class="watch-tier ${analysis.tier}">${escapeHtml(analysis.label)}</span>
            </div>
            <div class="watch-counts">
              <span class="watch-count"><strong>${analysis.myCount}</strong> your players</span>
              <span class="watch-count starred"><strong>${analysis.starredCount}</strong> ★ players</span>
              <span class="watch-count"><strong>${analysis.opponentCount}</strong> against</span>
            </div>
            ${crunchMarkup}
            <div class="watch-roots">
              ${analysis.mine.length ? `<div class="watch-root-line"><strong>For you:</strong>${escapeHtml(nameList(analysis.mine))}</div>` : ""}
              ${analysis.opponents.length ? `<div class="watch-root-line"><strong>Against:</strong>${escapeHtml(nameList(analysis.opponents))}</div>` : ""}
              ${!analysis.mine.length && !analysis.opponents.length && !analysis.crunch.length ? `<div class="watch-root-line">Only K/DEF or no meaningful fantasy exposure.</div>` : ""}
            </div>
          </div>
          <details class="watch-details">
            <summary>See players by league · ${leagueGroups.length} league${leagueGroups.length === 1 ? "" : "s"}</summary>
            <div class="game-league-groups">${leagueDetails}</div>
          </details>
        </article>`;
    }

'''
pattern = re.compile(r'    function renderGame\(game, kickoffMode = false, kickoffColorMap = new Map\(\)\) \{[\s\S]*?\n    \}\n\n    function renderSidebar')
m = pattern.search(s)
if not m:
    raise SystemExit('renderGame function not found')
s = s[:m.start()] + new_render + '    function renderSidebar' + s[m.end():]

old_render = r'''      els.gamesNote.textContent = kickoffMode
        ? `${gamesWithExposure} of ${gameRows.length} games contain at least one selected roster exposure. Matching kickoff windows are color-coded.`
        : `${gamesWithExposure} of ${gameRows.length} games contain at least one selected roster exposure.`;

      els.games.innerHTML = gameRows.length
        ? gameRows.map(game => renderGame(game, kickoffMode, kickoffColorMap)).join("")
        : `<div class="empty">No NFL games were returned for Week ${week}.</div>`;'''
new_render_all = r'''      const watchMode = els.sort.value === "watch";
      const displayRows = watchMode
        ? gameRows.filter(game => !game.completed && String(game.statusState || "").toLowerCase() !== "post" && watchAnalysis(game).score > 0)
        : gameRows;

      els.gamesNote.textContent = watchMode
        ? `${displayRows.length} games worth tracking. Unrelated and K/DEF-only games are hidden unless they become a Crunchtime decider.`
        : (kickoffMode
          ? `${gamesWithExposure} of ${gameRows.length} games contain at least one selected roster exposure. Matching kickoff windows are color-coded.`
          : `${gamesWithExposure} of ${gameRows.length} games contain at least one selected roster exposure.`);

      els.games.innerHTML = displayRows.length
        ? displayRows.map(game => renderGame(game, kickoffMode, kickoffColorMap)).join("")
        : `<div class="empty">No games currently rate as worth tracking. Change the sort to Kickoff time to see the full NFL slate.</div>`;'''
if old_render not in s:
    raise SystemExit('renderAll games block not found')
s = s.replace(old_render, new_render_all, 1)

s = s.replace('els.gamesTitle.textContent = `What to watch · Week ${week}`;', 'els.gamesTitle.textContent = `Best games to watch · Week ${week}`;', 1)

p.write_text(s)
print('Patched schedule-tool.html')
