from pathlib import Path

schedule_path = Path('schedule-tool.html')
text = schedule_path.read_text()

# Keep raw league rosters available as a fallback when a matchup payload omits starters.
old = '''            myTaxi: (item.roster.taxi || []).map(String),
            rosterMeta
'''
new = '''            myTaxi: (item.roster.taxi || []).map(String),
            rosters: item.rosters || [],
            rosterMeta
'''
if old not in text:
    raise SystemExit('league roster storage anchor not found')
text = text.replace(old, new, 1)

# Resolve opponent starters from the matchup first, then the league roster snapshot.
old = '''            const myProjection = projectedLineupScore(myMatchup.starters, projectionMap, league);
            const opponentProjection = projectedLineupScore(opponent?.starters, projectionMap, league);
            const hasProjections = myProjection.matchedStarters > 0 && opponentProjection.matchedStarters > 0;

            return {
              leagueId: league.league_id,
              week,
              matchupId: myMatchup.matchup_id,
              myRosterId: myMatchup.roster_id,
              opponentRosterId: opponent?.roster_id ?? null,
              myScore: scoreValue(myMatchup),
              opponentScore: scoreValue(opponent),
              myProjection: hasProjections ? myProjection.total : null,
              opponentProjection: hasProjections ? opponentProjection.total : null,
              opponentPlayerIds: opponent
                ? (league.isBestBall ? (opponent.players || []) : (opponent.starters || []))
                : [],
              opponentStarterIds: opponent?.starters || [],
              error: opponent ? "" : "No opponent is assigned to this matchup."
            };
'''
new = '''            const opponentRoster = opponent
              ? (league.rosters || []).find(roster => String(roster.roster_id) === String(opponent.roster_id)) || null
              : null;
            const matchupOpponentStarters = (opponent?.starters || []).map(String).filter(id => id && id !== "0");
            const rosterOpponentStarters = (opponentRoster?.starters || []).map(String).filter(id => id && id !== "0");
            const resolvedOpponentStarters = matchupOpponentStarters.length ? matchupOpponentStarters : rosterOpponentStarters;
            const matchupOpponentPlayers = (opponent?.players || []).map(String).filter(id => id && id !== "0");
            const rosterOpponentPlayers = (opponentRoster?.players || []).map(String).filter(id => id && id !== "0");
            const resolvedOpponentPlayers = league.isBestBall
              ? (matchupOpponentPlayers.length ? matchupOpponentPlayers : rosterOpponentPlayers)
              : resolvedOpponentStarters;

            const myProjection = projectedLineupScore(myMatchup.starters, projectionMap, league);
            const opponentProjection = projectedLineupScore(resolvedOpponentStarters, projectionMap, league);
            const hasProjections = myProjection.matchedStarters > 0 && opponentProjection.matchedStarters > 0;

            return {
              leagueId: league.league_id,
              week,
              matchupId: myMatchup.matchup_id,
              myRosterId: myMatchup.roster_id,
              opponentRosterId: opponent?.roster_id ?? null,
              myScore: scoreValue(myMatchup),
              opponentScore: scoreValue(opponent),
              myProjection: hasProjections ? myProjection.total : null,
              opponentProjection: hasProjections ? opponentProjection.total : null,
              opponentPlayerIds: resolvedOpponentPlayers,
              opponentStarterIds: resolvedOpponentStarters,
              error: opponent ? "" : "No opponent is assigned to this matchup."
            };
'''
if old not in text:
    raise SystemExit('opponent matchup block not found')
text = text.replace(old, new, 1)

old = '          if (!league || !live.opponentRosterId) continue;'
new = '          if (!league || live.opponentRosterId === null || live.opponentRosterId === undefined) continue;'
if old not in text:
    raise SystemExit('opponent roster guard not found')
text = text.replace(old, new, 1)

old = '''            const player = getPlayer(playerId);
            state.opponentExposures.push({
              leagueId: league.league_id,
              leagueName: `${league.name}: ${opponentMeta.name || "Opponent"}`,
              opponentName: opponentMeta.name || "Opponent",
              playerId,
              name: playerName(player),
              position: player.position || "—",
              team: normalizeTeam(player.team),
              bucket: starterIds.has(playerId) ? "starter" : "bench",
              isBestBall: league.isBestBall
            });
'''
new = '''            const player = getPlayer(playerId);
            const projectionRow = state.weeklyProjections instanceof Map ? state.weeklyProjections.get(playerId) : null;
            state.opponentExposures.push({
              leagueId: league.league_id,
              leagueName: `${league.name}: ${opponentMeta.name || "Opponent"}`,
              opponentName: opponentMeta.name || "Opponent",
              playerId,
              name: playerName(player),
              position: player.position || projectionRow?.player?.position || "—",
              team: normalizeTeam(player.team || projectionRow?.team || projectionRow?.player?.team),
              bucket: starterIds.has(playerId) ? "starter" : "bench",
              isBestBall: league.isBestBall
            });
'''
if old not in text:
    raise SystemExit('opponent exposure construction block not found')
text = text.replace(old, new, 1)

old = '''    function scheduleGameStarterExposures(game, opponent = false) {
      const teams = new Set([game.away?.abbreviation, game.home?.abbreviation].map(normalizeTeam).filter(Boolean));
      const source = opponent ? (state.opponentExposures || []) : (state.rosterExposures || []);
      return source.filter(item => state.selectedLeagueIds.has(item.leagueId) && (item.bucket === "starter" || item.isBestBall) && teams.has(normalizeTeam(item.team)));
    }
'''
new = '''    function scheduleGameStarterExposures(game, opponent = false) {
      const teams = new Set([game.away?.abbreviation, game.home?.abbreviation].map(normalizeTeam).filter(Boolean));
      const source = opponent ? (state.opponentExposures || []) : (state.rosterExposures || []);
      const selectedLeagueIds = new Set([...state.selectedLeagueIds].map(String));
      return source.filter(item => selectedLeagueIds.has(String(item.leagueId)) && (item.bucket === "starter" || item.isBestBall) && teams.has(normalizeTeam(item.team)));
    }
'''
if old not in text:
    raise SystemExit('starter exposure function not found')
text = text.replace(old, new, 1)

old = '''    function scheduleImpactForPlayer(playerId) {
      const relevantMine = (state.rosterExposures || []).filter(item => String(item.playerId) === String(playerId) && state.selectedLeagueIds.has(item.leagueId) && (item.bucket === "starter" || item.isBestBall));
      const relevantOpp = (state.opponentExposures || []).filter(item => String(item.playerId) === String(playerId) && state.selectedLeagueIds.has(item.leagueId) && (item.bucket === "starter" || item.isBestBall));
'''
new = '''    function scheduleImpactForPlayer(playerId) {
      const selectedLeagueIds = new Set([...state.selectedLeagueIds].map(String));
      const relevantMine = (state.rosterExposures || []).filter(item => String(item.playerId) === String(playerId) && selectedLeagueIds.has(String(item.leagueId)) && (item.bucket === "starter" || item.isBestBall));
      const relevantOpp = (state.opponentExposures || []).filter(item => String(item.playerId) === String(playerId) && selectedLeagueIds.has(String(item.leagueId)) && (item.bucket === "starter" || item.isBestBall));
'''
if old not in text:
    raise SystemExit('impact function anchor not found')
text = text.replace(old, new, 1)

old = '''      const opponentExposures = (state.opponentExposures || []).filter(
        exposure => state.selectedLeagueIds.has(exposure.leagueId)
      );
'''
new = '''      const selectedLeagueIds = new Set([...state.selectedLeagueIds].map(String));
      const opponentExposures = (state.opponentExposures || []).filter(
        exposure => selectedLeagueIds.has(String(exposure.leagueId))
      );
'''
if old not in text:
    raise SystemExit('aggregate opponent filter not found')
text = text.replace(old, new, 1)

schedule_path.write_text(text)

css_path = Path('app-shell.css')
css = css_path.read_text()
marker = '/* glass-polish-v3 */'
if marker in css:
    raise SystemExit('glass polish v3 already applied')
css += r'''

/* glass-polish-v3 */
:root{
  /* Let more of the cyan/indigo background glow through the glass. */
  --app-glass:rgba(255,255,255,.62);
  --app-glass-strong:rgba(255,255,255,.77);
  --app-glass-subtle:rgba(247,250,255,.52);
  --app-glass-border:rgba(255,255,255,.72);
  --app-glass-shadow:0 26px 64px rgba(57,77,148,.15),0 9px 26px rgba(45,61,116,.09),0 2px 7px rgba(42,54,100,.055),inset 0 1px 0 rgba(255,255,255,.86);
  --app-button-shadow:0 13px 30px rgba(72,95,222,.29),0 4px 12px rgba(48,62,139,.14),inset 0 1px 0 rgba(255,255,255,.58),inset 0 -1px 0 rgba(43,55,164,.18);
}
html[data-theme="dark"]{
  --app-glass:rgba(23,30,43,.68);
  --app-glass-strong:rgba(26,34,49,.82);
  --app-glass-subtle:rgba(30,39,56,.62);
  --app-glass-border:rgba(255,255,255,.13);
  --app-glass-shadow:0 28px 66px rgba(0,0,0,.40),0 9px 26px rgba(0,0,0,.28),0 2px 7px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.08);
  --app-button-shadow:0 13px 30px rgba(65,90,210,.30),0 4px 12px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(0,0,0,.20);
}

body{
  background:
    radial-gradient(circle at 8% -3%,rgba(35,214,231,.22),transparent 28rem),
    radial-gradient(circle at 94% 1%,rgba(99,93,243,.20),transparent 31rem),
    radial-gradient(circle at 52% 62%,rgba(74,150,246,.055),transparent 34rem),
    var(--app-bg)!important;
}

.topbar,.panel,.app-settings-dialog{box-shadow:var(--app-glass-shadow)!important}
.panel,.topbar{
  background:var(--app-glass)!important;
  border-color:var(--app-glass-border)!important;
}
.app-nav{
  background:var(--app-glass-subtle)!important;
  box-shadow:0 14px 34px rgba(55,72,132,.12),0 3px 10px rgba(46,61,112,.06),inset 0 1px 0 rgba(255,255,255,.82)!important;
}
html[data-theme="dark"] .app-nav{box-shadow:0 14px 34px rgba(0,0,0,.29),0 3px 10px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.08)!important}

/* Slightly translucent secondary controls, while fields stay more opaque for legibility. */
html:not([data-theme="dark"]) .app-settings-button,
html:not([data-theme="dark"]) .secondary,
html:not([data-theme="dark"]) .secondary-btn,
html:not([data-theme="dark"]) .app-settings-cancel{
  background:rgba(255,255,255,.70)!important;
  box-shadow:0 9px 22px rgba(53,70,130,.10),0 2px 7px rgba(45,59,108,.05),inset 0 1px 0 rgba(255,255,255,.88)!important;
}
html:not([data-theme="dark"]) input,
html:not([data-theme="dark"]) select,
html:not([data-theme="dark"]) textarea{
  background:rgba(255,255,255,.88)!important;
}

.app-nav-link.active,.app-more>summary.active,.primary,.app-settings-save{
  box-shadow:var(--app-button-shadow)!important;
  border-color:rgba(255,255,255,.48)!important;
  background-clip:padding-box!important;
  -webkit-background-clip:padding-box!important;
}
.app-nav-link,.app-nav-button,.app-more>summary,.primary,.secondary,.secondary-btn,.app-settings-save,.app-settings-cancel{
  border-radius:999px!important;
}
.primary,.app-settings-save{border-radius:15px!important}

.metric,.watch-card,.league-card,.live-score-card,.remaining-box,.lineup-row,.sidebar-row,.impact-player,.team-history-team,.draft-team,.draft-season{
  background:var(--app-glass-strong)!important;
  box-shadow:0 16px 38px rgba(55,72,132,.105),0 4px 13px rgba(47,63,119,.065),inset 0 1px 0 rgba(255,255,255,.80)!important;
}
html[data-theme="dark"] .metric,html[data-theme="dark"] .watch-card,html[data-theme="dark"] .league-card,html[data-theme="dark"] .live-score-card,html[data-theme="dark"] .remaining-box,html[data-theme="dark"] .lineup-row,html[data-theme="dark"] .sidebar-row,html[data-theme="dark"] .impact-player,html[data-theme="dark"] .team-history-team,html[data-theme="dark"] .draft-team,html[data-theme="dark"] .draft-season{
  box-shadow:0 16px 38px rgba(0,0,0,.27),0 4px 13px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.07)!important;
}

.window-ranked-game.recommended>.watch-card{
  box-shadow:0 20px 46px rgba(71,101,230,.19),0 5px 16px rgba(54,75,157,.10),inset 0 1px 0 rgba(255,255,255,.78)!important;
}
.window-ranked-game.must-watch>.watch-card{
  box-shadow:0 24px 54px rgba(71,101,230,.25),0 6px 18px rgba(54,75,157,.12),inset 0 1px 0 rgba(255,255,255,.80)!important;
}

@media(max-width:600px){
  .panel,.topbar{background:color-mix(in srgb,var(--app-glass) 94%, transparent)!important}
}
'''
css_path.write_text(css)

print('opponent exposure and glass v3 patch applied')
