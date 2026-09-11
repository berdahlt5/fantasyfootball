from pathlib import Path
import re

p = Path('schedule-tool.html')
s = p.read_text()
marker = '/* schedule-command-center-v1 */'
if marker in s:
    raise SystemExit(0)

css = r'''
    /* schedule-command-center-v1 */
    .lineup-pulse{display:none;margin-bottom:14px;padding:13px 14px}
    .lineup-pulse.show{display:block}
    .lineup-pulse-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
    .lineup-pulse-title{font-size:1rem;font-weight:1000;color:var(--mint)}
    .lineup-pulse-sub{margin-top:3px;color:var(--muted);font-size:.7rem}
    .lineup-pulse-link{flex:0 0 auto;padding:6px 9px;border-radius:999px;border:1px solid rgba(132,186,215,.3);background:rgba(132,186,215,.12);color:var(--sky);text-decoration:none;font-size:.62rem;font-weight:1000}
    .lineup-pulse-metrics{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:9px}
    .lineup-pulse-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;border:1px solid rgba(132,186,215,.2);background:rgba(255,255,237,.07);color:var(--muted);font-size:.62rem;font-weight:900}
    .lineup-pulse-pill strong{font-size:.73rem;color:var(--mint)}
    .lineup-pulse-pill.critical{border-color:rgba(231,128,128,.42);color:#F0A0A0}.lineup-pulse-pill.critical strong{color:#F0A0A0}
    .lineup-pulse-pill.warn{border-color:rgba(216,169,74,.42);color:#F0CA78}.lineup-pulse-pill.warn strong{color:#F0CA78}
    .lineup-issue-list{display:grid;gap:6px}
    .lineup-issue{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start;padding:8px 9px;border-radius:9px;border:1px solid rgba(132,186,215,.16);background:rgba(57,50,43,.36)}
    .lineup-issue.critical{border-color:rgba(231,128,128,.42);background:rgba(231,128,128,.08)}
    .lineup-issue.warn{border-color:rgba(216,169,74,.34);background:rgba(216,169,74,.06)}
    .lineup-issue.timing{border-color:rgba(132,186,215,.34);background:rgba(132,186,215,.07)}
    .lineup-issue-icon{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:rgba(255,255,237,.08);font-size:.67rem;font-weight:1000}
    .lineup-issue-title{color:var(--mint);font-size:.72rem;font-weight:1000;line-height:1.25}
    .lineup-issue-meta{margin-top:2px;color:var(--muted);font-size:.61rem;line-height:1.35}
    .lineup-issue-star{color:#F0CA78}
    .lineup-clear{padding:9px 10px;border-radius:9px;border:1px solid rgba(169,230,165,.3);background:rgba(169,230,165,.07);color:#B9F0B5;font-size:.7rem;font-weight:900}
    .lineup-more{padding:5px 2px 0;color:var(--muted);font-size:.61rem}
    .favorite-watch{display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:3px 7px;border-radius:999px;border:1px solid rgba(132,186,215,.34);background:rgba(132,186,215,.1);color:var(--sky);font-size:.58rem;font-weight:1000;text-transform:uppercase;letter-spacing:.05em}
    .impact-details{display:grid;gap:10px;padding:9px 10px 11px}
    .impact-section-title{margin-bottom:5px;color:var(--sky);font-size:.61rem;font-weight:1000;text-transform:uppercase;letter-spacing:.06em}
    .impact-player-list{display:grid;gap:5px}
    .impact-player{padding:7px 8px;border-radius:8px;border:1px solid rgba(132,186,215,.14);background:rgba(57,50,43,.42)}
    .impact-player-main{display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:var(--mint);font-size:.7rem;font-weight:1000}
    .impact-pos,.impact-proj{color:var(--muted);font-size:.58rem;font-weight:900}
    .impact-lines{display:flex;gap:8px;flex-wrap:wrap;margin-top:3px;font-size:.58rem;line-height:1.3}
    .impact-help{color:#B9F0B5}.impact-hurt{color:#F0A0A0}
    .impact-none{color:var(--muted);font-size:.62rem}
    .window-ranked-game{position:relative;padding-top:17px}
    .window-rank{position:absolute;top:0;left:2px;color:rgba(46,40,35,.62);font-size:.58rem;font-weight:1000;text-transform:uppercase;letter-spacing:.05em}
    html[data-theme="dark"] .window-rank{color:rgba(255,255,237,.58)}
    @media(max-width:700px){.lineup-pulse-head{flex-direction:column}.lineup-pulse-link{align-self:flex-start}}
'''
s = s.replace('</style>', css + '\n</style>', 1)

html = r'''
    <section class="panel lineup-pulse" id="lineupPulse">
      <div class="lineup-pulse-head">
        <div><div class="lineup-pulse-title">Lineup check</div><div class="lineup-pulse-sub">Only the things that need attention: injured starters and FLEX / kickoff-timing mistakes.</div></div>
        <a class="lineup-pulse-link" id="lineupPulseLink" href="./lineup-assistant.html">Full lineup assistant</a>
      </div>
      <div class="lineup-pulse-metrics">
        <span class="lineup-pulse-pill critical"><strong id="lineupCriticalCount">0</strong> fix now</span>
        <span class="lineup-pulse-pill warn"><strong id="lineupQuestionableCount">0</strong> questionable</span>
        <span class="lineup-pulse-pill"><strong id="lineupTimingCount">0</strong> timing</span>
      </div>
      <div class="lineup-issue-list" id="lineupIssueList"><div class="lineup-clear">Load your leagues to check lineups.</div></div>
    </section>
'''
anchor = '    <div class="content-grid">'
if anchor not in s:
    raise SystemExit('content-grid anchor missing')
s = s.replace(anchor, html + '\n' + anchor, 1)

old_fields = '''            scoringSettings: item.league.scoring_settings || {},\n            rosterMeta'''
new_fields = '''            scoringSettings: item.league.scoring_settings || {},\n            rosterPositions: item.league.roster_positions || [],\n            myStarters: (item.roster.starters || []).map(String),\n            myPlayers: (item.roster.players || []).map(String),\n            myReserve: (item.roster.reserve || []).map(String),\n            myTaxi: (item.roster.taxi || []).map(String),\n            rosterMeta'''
if old_fields not in s:
    raise SystemExit('league field anchor missing')
s = s.replace(old_fields, new_fields, 1)

helpers = r'''
    const SCHEDULE_FLEX_SLOTS = new Set(["FLEX","REC_FLEX","WRRB_FLEX","RB_WR_FLEX","WR_TE_FLEX","SUPER_FLEX"]);
    const SCHEDULE_NON_STARTERS = new Set(["BN","IR","TAXI"]);
    const SCHEDULE_SPECIAL_POSITIONS = new Set(["K","DEF","DST"]);
    const SCHEDULE_FAVORITE_TEAM = (() => {
      try {
        const saved = String(localStorage.getItem("fantasyFavoriteTeam") || "").toUpperCase();
        if (saved) return normalizeTeam(saved);
        localStorage.setItem("fantasyFavoriteTeam", "PHI");
      } catch (_) {}
      return "PHI";
    })();

    function scheduleBaseLeagueName(name) {
      return String(name || "").split(":")[0].trim();
    }

    function scheduleGameForTeam(team) {
      const normalized = normalizeTeam(team);
      return (state.games || []).find(game => game.away?.abbreviation === normalized || game.home?.abbreviation === normalized) || null;
    }

    function scheduleInjuryLabel(player) {
      const raw = player?.injury_status || player?.status || "";
      const value = String(raw || "").trim();
      if (!value || value.toLowerCase() === "active") return "Healthy";
      return value;
    }

    function scheduleInjuryKind(label) {
      const value = String(label || "").toLowerCase();
      if (!value || value === "healthy" || value === "active") return "healthy";
      if (value.includes("out") || value === "ir" || value.includes("pup") || value.includes("suspend")) return "critical";
      if (value.includes("question") || value.includes("doubt")) return "warn";
      return "warn";
    }

    function scheduleEligibleForSlot(position, slot) {
      const p = String(position || "").toUpperCase();
      const s = String(slot || "").toUpperCase();
      if (p === s) return true;
      if (s === "FLEX" || s === "REC_FLEX") return ["RB","WR","TE"].includes(p);
      if (s === "WRRB_FLEX" || s === "RB_WR_FLEX") return ["RB","WR"].includes(p);
      if (s === "WR_TE_FLEX") return ["WR","TE"].includes(p);
      if (s === "SUPER_FLEX") return ["QB","RB","WR","TE"].includes(p);
      return false;
    }

    function scheduleKickoffText(game) {
      if (!game) return "No game found";
      if (game.completed || String(game.statusState || "").toLowerCase() === "post") return "Final";
      try {
        return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(game.date));
      } catch (_) { return game.status || "TBD"; }
    }

    function scheduleLeagueLineupIssues(league) {
      if (league.isBestBall) return [];
      const slots = (league.rosterPositions || []).filter(slot => !SCHEDULE_NON_STARTERS.has(String(slot || "").toUpperCase()));
      const starters = (league.myStarters || []).map(String);
      if (!slots.length || !starters.length) return [];
      const rows = slots.map((slot, index) => {
        const playerId = starters[index] && starters[index] !== "0" ? starters[index] : "";
        const player = state.players?.[playerId] || {};
        const game = scheduleGameForTeam(player.team);
        return {
          slot, playerId, player, game,
          name: playerId ? playerName(player) : "Empty slot",
          position: String(player.position || "—").toUpperCase(),
          injury: scheduleInjuryLabel(player),
          kickoff: game ? new Date(game.date).getTime() : Infinity
        };
      });
      const issues = [];
      for (const row of rows) {
        if (!row.playerId) {
          issues.push({ kind: "critical", priority: isPriorityLeagueName(league.name), leagueName: league.name, title: `Empty ${row.slot} slot`, meta: "A starting slot is empty." });
          continue;
        }
        const injuryKind = scheduleInjuryKind(row.injury);
        if (injuryKind === "critical") {
          issues.push({ kind: "critical", priority: isPriorityLeagueName(league.name), leagueName: league.name, title: `${row.name} · ${row.injury}`, meta: `${row.slot} starter · ${scheduleKickoffText(row.game)} · replace if possible` });
        } else if (injuryKind === "warn") {
          issues.push({ kind: "warn", priority: isPriorityLeagueName(league.name), leagueName: league.name, title: `${row.name} · ${row.injury}`, meta: `${row.slot} starter · ${scheduleKickoffText(row.game)} · recheck before kickoff` });
        }
      }

      const flexRows = rows.filter(row => row.playerId && SCHEDULE_FLEX_SLOTS.has(String(row.slot).toUpperCase()));
      const positionRows = rows.filter(row => row.playerId && !SCHEDULE_FLEX_SLOTS.has(String(row.slot).toUpperCase()));
      const seenTiming = new Set();
      for (const flex of flexRows) {
        const later = positionRows
          .filter(pos => pos.position === flex.position && scheduleEligibleForSlot(flex.position, pos.slot) && scheduleEligibleForSlot(pos.position, flex.slot) && Number.isFinite(pos.kickoff) && Number.isFinite(flex.kickoff) && pos.kickoff > flex.kickoff + 30 * 60 * 1000)
          .sort((a,b) => b.kickoff - a.kickoff)[0];
        if (!later) continue;
        const key = `${flex.slot}|${flex.playerId}|${later.playerId}`;
        if (seenTiming.has(key)) continue;
        seenTiming.add(key);
        issues.push({
          kind: "timing",
          priority: isPriorityLeagueName(league.name),
          leagueName: league.name,
          title: `Move ${later.name} into ${flex.slot}`,
          meta: `${later.name} plays ${scheduleKickoffText(later.game)}; ${flex.name} plays ${scheduleKickoffText(flex.game)}. Put the later player in the flexible slot.`
        });
      }
      return issues;
    }

    function renderLineupPulse() {
      const panel = document.getElementById("lineupPulse");
      if (!panel) return;
      panel.classList.toggle("show", Boolean(state.user));
      if (!state.user) return;
      const selected = (state.leagues || []).filter(league => state.selectedLeagueIds.has(league.league_id));
      const issues = selected.flatMap(scheduleLeagueLineupIssues).sort((a,b) => {
        const rank = { critical: 0, timing: 1, warn: 2 };
        return (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9) || Number(b.priority) - Number(a.priority) || String(a.leagueName).localeCompare(String(b.leagueName));
      });
      const critical = issues.filter(issue => issue.kind === "critical").length;
      const questionable = issues.filter(issue => issue.kind === "warn").length;
      const timing = issues.filter(issue => issue.kind === "timing").length;
      document.getElementById("lineupCriticalCount").textContent = critical;
      document.getElementById("lineupQuestionableCount").textContent = questionable;
      document.getElementById("lineupTimingCount").textContent = timing;
      const link = document.getElementById("lineupPulseLink");
      if (link) {
        const params = new URLSearchParams({ username: els.username.value.trim(), season: String(els.season.value), week: String(els.week.value) });
        link.href = `./lineup-assistant.html?${params.toString()}`;
      }
      const list = document.getElementById("lineupIssueList");
      if (!list) return;
      if (!issues.length) {
        list.innerHTML = `<div class="lineup-clear">✓ All clear — no injured starters or FLEX / kickoff-timing issues found in your selected leagues.</div>`;
        return;
      }
      const shown = issues.slice(0, 8);
      list.innerHTML = shown.map(issue => {
        const icon = issue.kind === "critical" ? "!" : issue.kind === "timing" ? "↔" : "?";
        return `<div class="lineup-issue ${issue.kind}"><div class="lineup-issue-icon">${icon}</div><div><div class="lineup-issue-title">${issue.priority ? '<span class="lineup-issue-star">★</span> ' : ''}${escapeHtml(scheduleBaseLeagueName(issue.leagueName))} · ${escapeHtml(issue.title)}</div><div class="lineup-issue-meta">${escapeHtml(issue.meta)}</div></div></div>`;
      }).join("") + (issues.length > shown.length ? `<div class="lineup-more">+ ${issues.length - shown.length} more issue${issues.length - shown.length === 1 ? "" : "s"}. Open the Lineup Assistant for the full breakdown.</div>` : "");
    }

    function scheduleGameStarterExposures(game, opponent = false) {
      const teams = new Set([game.away?.abbreviation, game.home?.abbreviation].map(normalizeTeam).filter(Boolean));
      const source = opponent ? (state.opponentExposures || []) : (state.rosterExposures || []);
      return source.filter(item => state.selectedLeagueIds.has(item.leagueId) && (item.bucket === "starter" || item.isBestBall) && teams.has(normalizeTeam(item.team)));
    }

    function scheduleProjectionForExposure(exposure) {
      const projection = state.weeklyProjections instanceof Map ? state.weeklyProjections.get(String(exposure.playerId || "")) : null;
      if (!projection) return 0;
      const league = (state.leagues || []).find(item => String(item.league_id) === String(exposure.leagueId));
      if (!league) return 0;
      const value = Number(projectedPlayerPoints(projection, league));
      return Number.isFinite(value) ? value : 0;
    }

    function scheduleImpactForPlayer(playerId) {
      const relevantMine = (state.rosterExposures || []).filter(item => String(item.playerId) === String(playerId) && state.selectedLeagueIds.has(item.leagueId) && (item.bucket === "starter" || item.isBestBall));
      const relevantOpp = (state.opponentExposures || []).filter(item => String(item.playerId) === String(playerId) && state.selectedLeagueIds.has(item.leagueId) && (item.bucket === "starter" || item.isBestBall));
      const uniqueNames = items => [...new Set(items.map(item => scheduleBaseLeagueName(item.leagueName)).filter(Boolean))].sort((a,b) => Number(isPriorityLeagueName(b)) - Number(isPriorityLeagueName(a)) || a.localeCompare(b));
      const helps = uniqueNames(relevantMine);
      const hurts = uniqueNames(relevantOpp);
      const values = [...relevantMine, ...relevantOpp].map(scheduleProjectionForExposure).filter(value => value > 0);
      const projection = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return { helps, hurts, projection };
    }

    function scheduleLeagueTagList(names) {
      return names.map(name => `${isPriorityLeagueName(name) ? "★ " : ""}${name}`).join(", ");
    }

    function scheduleImpactPlayerMarkup(player) {
      const impact = scheduleImpactForPlayer(player.playerId);
      return `<div class="impact-player"><div class="impact-player-main"><span>${escapeHtml(player.name)}</span><span class="impact-pos">${escapeHtml(player.position || "")}</span>${impact.projection > 0 ? `<span class="impact-proj">proj ~${impact.projection.toFixed(1)}</span>` : ""}</div><div class="impact-lines">${impact.helps.length ? `<span class="impact-help">↑ Helps: ${escapeHtml(scheduleLeagueTagList(impact.helps))}</span>` : ""}${impact.hurts.length ? `<span class="impact-hurt">↓ Hurts: ${escapeHtml(scheduleLeagueTagList(impact.hurts))}</span>` : ""}</div></div>`;
    }

'''
watch_anchor = '    const WATCH_SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);'
if watch_anchor not in s:
    raise SystemExit('watch helper anchor missing')
s = s.replace(watch_anchor, helpers + '\n' + watch_anchor, 1)

watch_function = r'''    function watchAnalysis(game) {
      const completed = Boolean(game.completed) || String(game.statusState || "").toLowerCase() === "post";
      const myExposures = scheduleGameStarterExposures(game, false);
      const oppExposures = scheduleGameStarterExposures(game, true);
      const mySkillExp = myExposures.filter(item => WATCH_SKILL_POSITIONS.has(String(item.position || "").toUpperCase()));
      const oppSkillExp = oppExposures.filter(item => WATCH_SKILL_POSITIONS.has(String(item.position || "").toUpperCase()));
      const mySpecialExp = myExposures.filter(item => SCHEDULE_SPECIAL_POSITIONS.has(String(item.position || "").toUpperCase()));
      const oppSpecialExp = oppExposures.filter(item => SCHEDULE_SPECIAL_POSITIONS.has(String(item.position || "").toUpperCase()));
      const mySkill = groupPlayerExposures(mySkillExp);
      const oppSkill = groupPlayerExposures(oppSkillExp);
      const myAll = groupPlayerExposures(myExposures);
      const oppAll = groupPlayerExposures(oppExposures);
      const starredMine = myAll.filter(player => [...player.leagues].some(name => isPriorityLeagueName(name)));
      const starredOpp = oppAll.filter(player => [...player.leagues].some(name => isPriorityLeagueName(name)));
      const favorite = [game.away?.abbreviation, game.home?.abbreviation].map(normalizeTeam).includes(SCHEDULE_FAVORITE_TEAM);
      const crunch = completed ? [] : crunchSignalsForGame(game);

      let score = 0;
      for (const exposure of mySkillExp) {
        score += 24 + (isPriorityLeagueName(exposure.leagueName) ? 14 : 0);
        score += Math.min(12, scheduleProjectionForExposure(exposure) * 0.42);
      }
      for (const exposure of oppSkillExp) {
        score += 4 + (isPriorityLeagueName(exposure.leagueName) ? 3 : 0);
        score += Math.min(2.5, scheduleProjectionForExposure(exposure) * 0.08);
      }
      for (const exposure of mySpecialExp) score += 1.2 + (isPriorityLeagueName(exposure.leagueName) ? 0.8 : 0);
      for (const exposure of oppSpecialExp) score += 0.25;
      if (mySkill.length > 1) score += (mySkill.length - 1) * 5;
      if (favorite) score += 70;
      if (crunch.length) {
        const strongest = Math.max(...crunch.map(item => Number(item.weight || 0)));
        score += strongest * 2.25;
        if (crunch.some(item => item.must)) score += 45;
      }
      if (completed) score = -100;

      let tier = "skip", label = "Low Interest";
      if (completed) { tier = "final"; label = "Final"; }
      else if (crunch.some(item => item.must)) { tier = "must"; label = "Must Watch"; }
      else if (favorite) { tier = "must"; label = "Eagles · Always Watch"; }
      else if (mySkill.length && starredMine.length) { tier = "must"; label = "Very High"; }
      else if (mySkill.length) { tier = "watch"; label = "High Interest"; }
      else if (oppSkill.length) { tier = "radar"; label = "Some Interest"; }
      else if (mySpecialExp.length) { tier = "skip"; label = "Low · K/DEF"; }

      return {
        score, tier, label, crunch, favorite,
        mine: mySkill,
        opponents: oppSkill,
        myAll, oppAll,
        myCount: myAll.length,
        starredCount: starredMine.length,
        opponentCount: oppAll.length,
        mySkillCount: mySkill.length,
        mySpecialCount: mySpecialExp.length,
        opponentSkillCount: oppSkill.length,
        starredOpponentCount: starredOpp.length
      };
    }

    function aggregateData()'''
pattern = re.compile(r'    function watchAnalysis\(game\) \{.*?\n    \}\n\n    function aggregateData\(\)', re.S)
if not pattern.search(s):
    raise SystemExit('watchAnalysis block missing')
s = pattern.sub(watch_function, s, count=1)

render_game = r'''    function renderGame(game, kickoffMode = false, kickoffColorMap = new Map()) {
      const analysis = watchAnalysis(game);
      const kickoff = formatKickoffLabel(game.date, game.status || "TBD");
      const isPast = Boolean(game.completed) || String(game.statusState || "").toLowerCase() === "post";
      const matchup = `${game.away.abbreviation} @ ${game.home.abbreviation}`;
      const nameList = players => players.map(player => player.name).join(", ");
      const crunchMarkup = analysis.crunch.length
        ? `<div class="crunch-flags">${analysis.crunch.slice(0,3).map(item => `<div class="crunch-flag ${item.priority ? "priority" : ""}">${escapeHtml(item.text)}</div>`).join("")}</div>`
        : "";
      const mineMarkup = analysis.myAll.length
        ? `<div><div class="impact-section-title">Your players</div><div class="impact-player-list">${analysis.myAll.map(scheduleImpactPlayerMarkup).join("")}</div></div>`
        : `<div><div class="impact-section-title">Your players</div><div class="impact-none">No starters from your teams in this game.</div></div>`;
      const oppMarkup = analysis.oppAll.length
        ? `<div><div class="impact-section-title">Opponent players</div><div class="impact-player-list">${analysis.oppAll.map(scheduleImpactPlayerMarkup).join("")}</div></div>`
        : `<div><div class="impact-section-title">Opponent players</div><div class="impact-none">No opponent starters in this game.</div></div>`;

      return `<article class="game-card watch-card ${analysis.tier === "must" ? "priority-game" : ""} ${isPast ? "past-game final-card" : ""}">
        <div class="watch-card-main">
          <div class="watch-card-top">
            <div class="watch-matchup"><div class="watch-teams">${escapeHtml(matchup)}</div><div class="watch-time">${escapeHtml(kickoff)}</div>${analysis.favorite ? `<div class="favorite-watch">🦅 Eagles game</div>` : ""}</div>
            <div class="watch-tier ${analysis.tier}">${escapeHtml(analysis.label)}</div>
          </div>
          <div class="watch-counts">
            <span class="watch-count"><strong>${analysis.myCount}</strong> your player${analysis.myCount === 1 ? "" : "s"}</span>
            <span class="watch-count starred"><strong>${analysis.starredCount}</strong> ★ player${analysis.starredCount === 1 ? "" : "s"}</span>
            <span class="watch-count"><strong>${analysis.opponentCount}</strong> against</span>
          </div>
          ${crunchMarkup}
          <div class="watch-roots">
            ${analysis.myAll.length ? `<div class="watch-root-line"><strong>For you:</strong>${escapeHtml(nameList(analysis.myAll))}</div>` : `<div class="watch-root-line"><strong>For you:</strong>none</div>`}
            ${analysis.oppAll.length ? `<div class="watch-root-line"><strong>Against:</strong>${escapeHtml(nameList(analysis.oppAll))}</div>` : ""}
          </div>
        </div>
        <details class="watch-details">
          <summary>Players &amp; cross-league impact · ${analysis.myCount} yours / ${analysis.opponentCount} against</summary>
          <div class="impact-details">${mineMarkup}${oppMarkup}</div>
        </details>
      </article>`;
    }

    function renderSidebar'''
render_pattern = re.compile(r'    function renderGame\(game, kickoffMode = false, kickoffColorMap = new Map\(\)\) \{.*?\n    \}\n\n    function renderSidebar', re.S)
if not render_pattern.search(s):
    raise SystemExit('renderGame block missing')
s = render_pattern.sub(render_game, s, count=1)

windows = r'''    function renderWatchWindows(games, kickoffMode, kickoffColorMap) {
      const groups = new Map();
      for (const game of games) {
        const info = watchWindowInfo(game);
        if (!groups.has(info.key)) groups.set(info.key, { info, games: [], minTime: Infinity });
        const group = groups.get(info.key);
        group.games.push(game);
        const time = new Date(game.date).getTime();
        if (Number.isFinite(time)) group.minTime = Math.min(group.minTime, time);
      }
      return [...groups.values()]
        .sort((a,b) => a.minTime - b.minTime || a.info.order - b.info.order)
        .map(group => {
          group.games.sort((a,b) => watchAnalysis(b).score - watchAnalysis(a).score || new Date(a.date) - new Date(b.date));
          const single = group.games.length === 1;
          const note = single ? `Importance: ${watchAnalysis(group.games[0]).label}` : `Ranked for your screens`;
          return `<section class="watch-window">
            <div class="watch-window-head"><div class="watch-window-title">${escapeHtml(group.info.label)}</div><div class="watch-window-note">${escapeHtml(note)}</div></div>
            <div class="watch-window-games">${group.games.map((game,index) => `<div class="window-ranked-game">${single ? "" : `<div class="window-rank">#${index + 1} this window</div>`}${renderGame(game,kickoffMode,kickoffColorMap)}</div>`).join("")}</div>
          </section>`;
        }).join("");
    }

    function renderAll()'''
window_pattern = re.compile(r'    function renderWatchWindows\(games, kickoffMode, kickoffColorMap\) \{.*?\n    \}\n\n    function renderAll\(\)', re.S)
if not window_pattern.search(s):
    raise SystemExit('renderWatchWindows block missing')
s = window_pattern.sub(windows, s, count=1)

old_render_start = '''      els.gamesTitle.textContent = `Best games to watch · Week ${week}`;\n\n      if (!state.user) {\n        return;\n      }'''
new_render_start = '''      els.gamesTitle.textContent = `Best games to watch · Week ${week}`;\n\n      if (!state.user) {\n        renderLineupPulse();\n        return;\n      }\n      renderLineupPulse();'''
if old_render_start not in s:
    raise SystemExit('renderAll start anchor missing')
s = s.replace(old_render_start, new_render_start, 1)

s = s.replace('`Full NFL slate grouped chronologically by kickoff window. Games are ranked within each window; no-exposure and K/DEF-only games remain visible at lower priority unless Crunchtime elevates them.`', '`Full NFL slate by kickoff window. Your starters drive the ranking; starred leagues and projections break ties; opponent players add context; K/DEF stay low unless they become a decider.`', 1)

p.write_text(s)
