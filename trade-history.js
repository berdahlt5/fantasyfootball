/* Owner Dashboard · completed Sleeper trade history
   Loaded on demand; it follows the franchise lineage already found by Team History. */
(function () {
  "use strict";

  const panel = document.getElementById("tradeHistoryPanel");
  if (!panel) return;

  const list = document.getElementById("tradeHistoryList");
  const note = document.getElementById("tradeHistoryNote");
  const meta = document.getElementById("tradeHistoryMeta");
  const leagueFilter = document.getElementById("tradeLeagueFilter");
  const seasonFilter = document.getElementById("tradeSeasonFilter");
  const search = document.getElementById("tradeSearch");

  let trades = [];
  let loading = false;
  let loaded = false;
  let requestVersion = 0;
  let failedWeeks = 0;
  let seasonsChecked = 0;
  let seasonCount = 0;
  const seasonContexts = new Map();
  const draftBoardCache = new Map();
  const matchupCache = new Map();
  let grading = false;

  function safe(value) { return escapeHtml(String(value == null ? "" : value)); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function setMessage(message) { list.innerHTML = '<div class="trade-history-empty">' + safe(message) + "</div>"; }
  function setNote(message) { note.textContent = message; }

  function teamName(rosterId, names) {
    return names.get(String(rosterId)) || "Roster " + rosterId;
  }

  function pickDescription(pick, names) {
    const season = String(pick.season || "Future");
    const roundNumber = Number(pick.round || 0);
    const round = roundNumber > 0 ? "Round " + roundNumber : "Draft";
    const original = pick.roster_id == null ? "" : " · originally " + teamName(pick.roster_id, names);
    return season + " " + round + " pick" + original;
  }

  function normalPick(value) {
    if (value && typeof value === "object") return value;
    if (typeof value === "string") {
      const parts = value.split(",");
      if (parts.length >= 5) return {
        roster_id: parts[0], season: parts[1], round: parts[2],
        owner_id: parts[3], previous_owner_id: parts[4]
      };
    }
    return null;
  }

  function assetsFor(transaction, myId, names) {
    const incoming = [], outgoing = [];
    const adds = transaction.adds || {};
    const drops = transaction.drops || {};

    Object.keys(adds).forEach(id => {
      if (String(adds[id]) !== myId) return;
      const player = getPlayer(id);
      incoming.push({type:"player", playerId:String(id), text:playerName(player, id) + (player.position && player.position !== "OTHER" ? " · " + player.position : "")});
    });

    Object.keys(drops).forEach(id => {
      if (String(drops[id]) !== myId) return;
      const player = getPlayer(id);
      outgoing.push({type:"player", playerId:String(id), text:playerName(player, id) + (player.position && player.position !== "OTHER" ? " · " + player.position : "")});
    });

    (Array.isArray(transaction.draft_picks) ? transaction.draft_picks : []).forEach(value => {
      const pick = normalPick(value);
      if (!pick) return;
      const from = String(pick.previous_owner_id);
      const to = String(pick.owner_id);
      if (to === myId && from !== myId) incoming.push({type:"pick",pick:{...pick},text:pickDescription(pick,names)});
      if (from === myId && to !== myId) outgoing.push({type:"pick",pick:{...pick},text:pickDescription(pick,names)});
    });

    (Array.isArray(transaction.waiver_budget) ? transaction.waiver_budget : []).forEach(item => {
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const label = amount + " FAAB";
      if (String(item.receiver) === myId && String(item.sender) !== myId) incoming.push({type:"faab",text:label});
      if (String(item.sender) === myId && String(item.receiver) !== myId) outgoing.push({type:"faab",text:label});
    });

    return {incoming, outgoing};
  }

  function namesFor(rosters, users) {
    const byUser = new Map((Array.isArray(users) ? users : []).map(user => [String(user.user_id), user]));
    const result = new Map();
    (Array.isArray(rosters) ? rosters : []).forEach(roster => {
      const user = byUser.get(String(roster.owner_id));
      const name = (user && ((user.metadata && user.metadata.team_name) || user.display_name || user.username)) || "Roster " + roster.roster_id;
      result.set(String(roster.roster_id), String(name));
    });
    return result;
  }

  function parseTrade(tx, row, view, names, rosters) {
    if (!tx || tx.type !== "trade" || tx.status !== "complete") return null;
    const mine = String(row.rosterId);
    const participants = (Array.isArray(tx.roster_ids) ? tx.roster_ids : []).map(String);
    const draftPicks = (Array.isArray(tx.draft_picks) ? tx.draft_picks : []).map(normalPick).filter(Boolean);
    const involved = participants.includes(mine)
      || Object.values(tx.adds || {}).some(id => String(id) === mine)
      || Object.values(tx.drops || {}).some(id => String(id) === mine)
      || draftPicks.some(p => String(p.owner_id) === mine || String(p.previous_owner_id) === mine)
      || (tx.waiver_budget || []).some(b => String(b.sender) === mine || String(b.receiver) === mine);
    if (!involved) return null;

    const assets = assetsFor(tx, mine, names);
    const otherIds = participants.filter(id => id !== mine);
    const otherId = otherIds.length === 1 ? otherIds[0] : null;
    const opponentReturn = otherId ? assetsFor(tx,otherId,names) : null;
    const ownerIdFor = id => String((rosters || []).find(r => String(r.roster_id) === String(id))?.owner_id || "");

    const otherNames = [...new Set(otherIds.map(id => teamName(id,names)))];
    const counterpart = otherNames.length ? otherNames.join(" + ") : "League trade";
    const timestamp = Number(tx.status_updated || tx.created || 0);
    return {
      id: String(tx.transaction_id || row.leagueId + ":" + timestamp),
      currentLeagueId: String(view.leagueId),
      leagueId: String(row.leagueId),
      franchise: String(view.myMeta && view.myMeta.name || "My team"),
      league: String(view.name),
      season: String(row.season),
      week: Number(tx.leg || 0),
      timestamp: timestamp,
      counterpart: counterpart,
      received: assets.incoming,
      sent: assets.outgoing,
      myOwnerId: ownerIdFor(mine),
      opponentOwnerId: otherId ? ownerIdFor(otherId) : "",
      opponentReturn: opponentReturn ? opponentReturn.incoming : [],
      gradeable: Boolean(otherId && ownerIdFor(mine) && ownerIdFor(otherId)),
      grade: null
    };
  }

  function getLineages() {
    const entries = [];
    (state.leagues || []).forEach(view => {
      const current = {
        leagueId: String(view.leagueId),
        season: String(state.season),
        rosterId: String(view.myRoster.roster_id),
        current: true
      };
      const historic = (state.teamHistory.get(String(view.leagueId)) || []).map(row => ({
        leagueId: String(row.leagueId),
        season: String(row.season),
        rosterId: String(row.rosterId),
        current: String(row.leagueId) === String(view.leagueId)
      }));
      const seen = new Set();
      [current].concat(historic).forEach(row => {
        if (!row.leagueId || seen.has(row.leagueId)) return;
        seen.add(row.leagueId);
        entries.push({row, view});
      });
    });
    return entries;
  }

  async function fetchTransactions(leagueId, week) {
    const response = await fetch(SLEEPER_API + "/league/" + encodeURIComponent(leagueId) + "/transactions/" + week);
    if (!response.ok) {
      if (week === 0 && response.status === 404) return [];
      throw new Error("Sleeper transactions request failed (" + response.status + ")");
    }
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function loadSeason(item) {
    const row = item.row, view = item.view;
    const [rosters, users] = row.current
      ? [view._rosters, view._users]
      : await Promise.all([
          fetchJson(SLEEPER_API + "/league/" + encodeURIComponent(row.leagueId) + "/rosters", "Historical rosters"),
          fetchJson(SLEEPER_API + "/league/" + encodeURIComponent(row.leagueId) + "/users", "Historical managers")
        ]);

    const names = namesFor(rosters, users);
    seasonContexts.set(String(row.leagueId),{row,view,rosters,users,names});
    const isPresentSeason = String(row.season) === String(state.nflState && state.nflState.season);
    const currentWeek = Number(state.nflState && (state.nflState.week || state.nflState.display_week));
    const lastWeek = isPresentSeason && Number.isFinite(currentWeek) && currentWeek >= 1
      ? Math.min(18, currentWeek)
      : 18;
    const weeks = Array.from({length:lastWeek + 1}, (_, i) => i);
    const results = await mapWithConcurrency(weeks, 5, week => fetchTransactions(row.leagueId, week));
    const seen = new Set(), seasonTrades = [];
    let failed = 0;

    results.forEach(result => {
      if (result.status !== "fulfilled") { failed++; return; }
      result.value.forEach(tx => {
        const parsed = parseTrade(tx, row, view, names, rosters);
        if (!parsed) return;
        const key = String(row.leagueId) + ":" + parsed.id;
        if (seen.has(key)) return;
        seen.add(key);
        seasonTrades.push(parsed);
      });
    });
    return {trades: seasonTrades, failed};
  }


  function seasonContextsFor(trade) {
    const all = [...seasonContexts.values()].filter(ctx =>
      String(ctx.view.leagueId) === String(trade.currentLeagueId));
    return all.sort((a,b) => Number(a.row.season) - Number(b.row.season));
  }

  function rosterForOwner(ctx, ownerId) {
    return (ctx.rosters || []).find(roster =>
      String(roster.owner_id) === String(ownerId) ||
      (Array.isArray(roster.co_owners) && roster.co_owners.map(String).includes(String(ownerId))));
  }

  async function draftBoardsFor(ctx) {
    const leagueId = String(ctx.row.leagueId);
    if (!draftBoardCache.has(leagueId)) {
      const pending = (async () => {
        const drafts = await optionalJson(SLEEPER_API + "/league/" + encodeURIComponent(leagueId) + "/drafts");
        if (!Array.isArray(drafts)) return [];
        const results = await mapWithConcurrency(drafts,3,async draft => {
          const picks = await optionalJson(SLEEPER_API + "/draft/" + encodeURIComponent(draft.draft_id) + "/picks");
          return {draft, picks:Array.isArray(picks)?picks:[]};
        });
        return results.filter(r=>r.status==="fulfilled").map(r=>r.value);
      })();
      draftBoardCache.set(leagueId,pending);
    }
    return draftBoardCache.get(leagueId);
  }

  function matchingDraftSlot(draft, originalRosterId, ctx) {
    const rosterId = String(originalRosterId);
    const direct = Object.entries(draft.slot_to_roster_id || {}).find(([,rid]) => String(rid) === rosterId);
    if (direct) return String(direct[0]);
    // Some historical drafts include only draft_order, keyed by Sleeper user ID.
    const originalRoster = (ctx.rosters || []).find(r=>String(r.roster_id)===rosterId);
    if (!originalRoster) return null;
    const slot = (draft.draft_order || {})[String(originalRoster.owner_id)];
    return slot == null ? null : String(slot);
  }

  async function resolvePick(asset, trade, ownerId) {
    if (asset.type !== "pick" || !asset.pick) return;
    const year = String(asset.pick.season);
    const ctx = seasonContextsFor(trade).find(item => String(item.row.season) === year);
    asset.resolution = "pending";
    asset.text = pickDescription(asset.pick,
      seasonContexts.get(String(trade.leagueId))?.names || new Map());
    if (!ctx) return; // Draft year not in the available franchise lineage yet.
    const boards = await draftBoardsFor(ctx);
    const matches = [];
    boards.forEach(({draft,picks}) => {
      const slot = matchingDraftSlot(draft,asset.pick.roster_id,ctx);
      if (!slot) return; // Do not guess which player an unidentifiable pick became.
      picks.filter(p => String(p.round) === String(asset.pick.round) &&
        String(p.draft_slot) === slot && p.player_id).forEach(p =>
          matches.push({draft,pick:p}));
    });
    if (matches.length !== 1) {
      asset.resolution = matches.length > 1 ? "ambiguous" : "unresolved";
      return;
    }
    const match = matches[0], p = match.pick, player = getPlayer(p.player_id);
    const drafted = [p.metadata?.first_name,p.metadata?.last_name].filter(Boolean).join(" ").trim()
      || playerName(player,p.player_id);
    const receivingRoster = rosterForOwner(ctx,ownerId);
    const wasUsedByRecipient = Boolean(receivingRoster && String(p.roster_id) === String(receivingRoster.roster_id));
    const slotNumber = Number(p.pick_no), overall = slotNumber > 0 ? " · #" + slotNumber + " overall" : "";
    asset.text = pickDescription(asset.pick,
      seasonContexts.get(String(trade.leagueId))?.names || new Map()) +
      " → " + drafted + overall +
      (wasUsedByRecipient ? "" : " (subsequently moved)");
    asset.draftedName = drafted;
    asset.draftedYear = year;
    asset.resolution = wasUsedByRecipient ? "drafted" : "moved";
    asset.playerId = wasUsedByRecipient ? String(p.player_id) : null;
  }

  async function matchupWeeksFor(ctx) {
    const leagueId=String(ctx.row.leagueId);
    if (!matchupCache.has(leagueId)) {
      const pending=(async()=>{
        const thisSeason = String(ctx.row.season) === String(state.nflState?.season);
        const currentWeek = Number(state.nflState?.week || state.nflState?.display_week || 1);
        // Never count games underway this week or future projected lineups as fantasy starts.
        const lastWeek = thisSeason ? Math.min(18,Math.max(0,currentWeek-1)) : 18;
        const weekNumbers = Array.from({length:lastWeek},(_,i)=>i+1);
        const results = await mapWithConcurrency(weekNumbers,5,async week => {
          const records = await fetchJson(SLEEPER_API + "/league/" + encodeURIComponent(leagueId) +
            "/matchups/" + week,"Trade grades matchups");
          return {week,records:Array.isArray(records)?records:[]};
        });
        const map=new Map();
        results.forEach(r=>{
          if (r.status==="fulfilled") map.set(r.value.week,r.value.records);
          else failedWeeks++;
        });
        return map;
      })();
      matchupCache.set(leagueId,pending);
    }
    return matchupCache.get(leagueId);
  }

  function statsFor(assets, ownerId, trade, contexts) {
    let points=0,starts=0;
    for (const asset of assets) {
      asset.performance = {points:0, starts:0};
      if (!asset.playerId) continue;
      for (const ctx of contexts) {
        const year=Number(ctx.row.season), tradeYear=Number(trade.season);
        const dynasty=String(ctx.view.rawLeague?.settings?.type) === "2";
        if (year < tradeYear || (!dynasty && year !== tradeYear && year !== Number(asset.draftedYear))) continue;
        if (asset.type === "pick" && year < Number(asset.draftedYear)) continue;
        if (asset.type === "pick" && !dynasty && year !== Number(asset.draftedYear)) continue;
        const roster=rosterForOwner(ctx,ownerId);
        if (!roster) continue;
        const matchupWeeks=ctx.weeklyMatchups||new Map();
        for (const [week,rows] of matchupWeeks) {
          if (year === tradeYear && week < Math.max(1,trade.week||1)) continue;
          const match=(rows||[]).find(m=>String(m.roster_id)===String(roster.roster_id));
          if (!match || !(match.starters||[]).map(String).includes(asset.playerId)) continue;
          const playerPoints=match.players_points || match.starters_points || {};
          if (playerPoints[asset.playerId] == null || !Number.isFinite(Number(playerPoints[asset.playerId]))) continue;
          asset.performance.starts++;
          asset.performance.points += Number(playerPoints[asset.playerId]);
        }
      }
      points += asset.performance.points;
      starts += asset.performance.starts;
    }
    return {points,starts,ppg:starts ? points/starts : null};
  }

  function gradeLetter(share) {
    if (share >= .76) return "A";
    if (share >= .65) return "A-";
    if (share >= .56) return "B+";
    if (share >= .46) return "B";
    if (share >= .37) return "C+";
    if (share >= .24) return "C";
    return "D";
  }

  async function calculateGrades(version) {
    grading = true;
    setNote(plural(trades.length,"completed trade") + " found. Linking draft picks and calculating lineup impact…");
    // Collect relevant franchise seasons once; both sides use the exact same league scoring.
    const contexts = [...seasonContexts.values()].filter(ctx => trades.some(t => t.currentLeagueId === String(ctx.view.leagueId)));
    await mapWithConcurrency(contexts,3,async ctx => {
      if (version !== requestVersion) return;
      ctx.weeklyMatchups = await matchupWeeksFor(ctx);
    });
    if (version !== requestVersion) return;
    await mapWithConcurrency(trades,4,async trade => {
      if (!trade.gradeable) {trade.grade = {status:"unavailable"};return;}
      const picks = [...trade.received.map(asset=>({asset,owner:trade.myOwnerId})),
        ...trade.opponentReturn.map(asset=>({asset,owner:trade.opponentOwnerId}))]
        .filter(item=>item.asset.type==="pick");
      await Promise.all(picks.map(item=>resolvePick(item.asset,trade,item.owner)));
      if (version !== requestVersion) return;
      const seasons=seasonContextsFor(trade);
      const my = statsFor(trade.received,trade.myOwnerId,trade,seasons);
      const theirs = statsFor(trade.opponentReturn,trade.opponentOwnerId,trade,seasons);
      const total=my.points+theirs.points;
      const starts=my.starts+theirs.starts;
      const pending = picks.some(x=>x.asset.resolution==="pending" || x.asset.resolution==="ambiguous" || x.asset.resolution==="unresolved");
      trade.grade = {my,theirs,
        status:starts === 0 ? "pending" : starts < 8 || pending ? "provisional" : "graded",
        mine:total > 0 ? gradeLetter(my.points/total) : "—",
        theirs:total > 0 ? gradeLetter(theirs.points/total) : "—",
        winner:Math.abs(my.points-theirs.points) < Math.max(5,total*.05) ? "Even" :
          my.points > theirs.points ? "Your side" : "Their side",
        pending
      };
    });
    grading=false;
  }

  function performanceHtml(stats) {
    if (!stats) return '<span>Starts unavailable</span>';
    const ppg=stats.ppg==null?"—":stats.ppg.toFixed(1);
    return '<div class="trade-grade-metrics"><span><strong>'+stats.starts+'</strong> fantasy starts</span>' +
      '<span><strong>'+ppg+'</strong> PPG</span>' +
      '<span><strong>'+stats.points.toFixed(1)+'</strong> lineup FP</span></div>';
  }

  function gradeHtml(trade) {
    const g=trade.grade;
    if (!g || g.status==="unavailable") return '<div class="trade-grade-empty">' +
      (grading ? "Analyzing trade performance…" : "Grade unavailable for multi-team or unlinked trades.") + '</div>';
    if (g.status==="pending") return '<div class="trade-grade-empty">Grade pending · no recorded fantasy starts for these assets yet.</div>';
    const status = g.status === "provisional" ? "Early grade · may change" : "Performance grade";
    const winner = g.winner==="Even" ? "Even result" : g.winner+" ahead";
    return '<div class="trade-grade-block"><div class="trade-grade-heading">'+safe(status)+' <span>'+safe(winner)+'</span></div>'+
      '<div class="trade-grade-grid">'+
      '<div class="trade-grade-team"><div class="trade-grade-top"><span>Your return</span><strong class="trade-grade-letter">'+safe(g.mine)+'</strong></div>'+performanceHtml(g.my)+'</div>'+
      '<div class="trade-grade-team"><div class="trade-grade-top"><span>Their return</span><strong class="trade-grade-letter">'+safe(g.theirs)+'</strong></div>'+performanceHtml(g.theirs)+'</div></div>'+
      (g.pending?'<div class="trade-grade-caveat">Some draft picks are still pending or could not be linked. Their future value is not graded.</div>':'')+
      '</div>';
  }

  function assetHtml(assets) {
    if (!assets.length) return '<div class="trade-history-no-assets">No assets listed by Sleeper</div>';
    const icons = {player:"🏈",pick:"🎟",faab:"💰"};
    return '<ul class="trade-history-assets">' + assets.map(asset =>
      '<li><span class="trade-history-asset-icon" aria-hidden="true">' + (icons[asset.type] || "•") +
      '</span><span>' + safe(asset.text) + '</span>' + (asset.performance?.starts ? '<small class="trade-asset-stats">' + asset.performance.starts + ' starts · ' + (asset.performance.points/asset.performance.starts).toFixed(1) + ' PPG</small>' : '') + '</li>'
    ).join("") + '</ul>';
  }

  function tradeHtml(trade) {
    let date = "Date unavailable";
    if (trade.timestamp > 0) {
      date = new Date(trade.timestamp).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
    }
    const week = trade.week > 0 ? " · Week " + trade.week : "";
    return '<article class="trade-history-item">' +
      '<div class="trade-history-item-head"><div>' +
      '<div class="trade-history-matchup">Trade with ' + safe(trade.counterpart) + '</div>' +
      '<div class="trade-history-date">' + safe(date + week) + '</div></div>' +
      '<span class="trade-history-year">' + safe(trade.season) + '</span></div>' +
      '<div class="trade-history-sides">' +
      '<div class="trade-history-side"><h4>Received</h4>' + assetHtml(trade.received) + '</div>' +
      '<div class="trade-history-side sent"><h4>Sent away</h4>' + assetHtml(trade.sent) + '</div>' +
      '</div>' + gradeHtml(trade) + '</article>';
  }

  function populateFilters() {
    const previousLeague = leagueFilter.value || "all";
    const previousSeason = seasonFilter.value || "all";
    const seasonOptions = [...new Set(trades.map(t => t.season))].sort((a,b) => Number(b) - Number(a));
    leagueFilter.innerHTML = '<option value="all">All leagues</option>' + (state.leagues || []).map(view =>
      '<option value="' + safe(view.leagueId) + '">' + safe(view.name) + '</option>'
    ).join("");
    seasonFilter.innerHTML = '<option value="all">All seasons</option>' + seasonOptions.map(year =>
      '<option value="' + safe(year) + '">' + safe(year) + '</option>'
    ).join("");
    if ([...leagueFilter.options].some(o => o.value === previousLeague)) leagueFilter.value = previousLeague;
    if ([...seasonFilter.options].some(o => o.value === previousSeason)) seasonFilter.value = previousSeason;
  }

  function render() {
    const selectedLeague = leagueFilter.value, selectedSeason = seasonFilter.value;
    const term = search.value.trim().toLowerCase();
    const matches = trades.filter(t => {
      if (selectedLeague !== "all" && t.currentLeagueId !== selectedLeague) return false;
      if (selectedSeason !== "all" && t.season !== selectedSeason) return false;
      if (!term) return true;
      const keywords = [t.franchise,t.league,t.counterpart,t.season,
        ...t.received.map(a=>a.text),...t.sent.map(a=>a.text)].join(" ").toLowerCase();
      return keywords.includes(term);
    });

    const sections = (state.leagues || []).filter(view => selectedLeague === "all" || String(view.leagueId) === selectedLeague)
      .map(view => {
        const mine = matches.filter(t => t.currentLeagueId === String(view.leagueId));
        if (!mine.length) return "";
        mine.sort((a,b) => b.timestamp - a.timestamp);
        return '<details class="trade-history-group" open><summary>' +
          '<div><div class="trade-history-team-name">' + safe(view.myMeta && view.myMeta.name || "My team") + '</div>' +
          '<div class="trade-history-team-sub">' + safe(view.name) + '</div></div>' +
          '<div class="trade-history-count">' + plural(mine.length,"trade") + '</div>' +
          '<div class="trade-history-chevron">▶</div></summary>' +
          '<div class="trade-history-items">' + mine.map(tradeHtml).join("") + '</div></details>';
      }).filter(Boolean);

    list.innerHTML = sections.length ? sections.join("") :
      '<div class="trade-history-empty">' + (loading ? "Searching franchise trade records…" : "No completed trades match these filters.") + '</div>';
    const qualifier = loaded ? " completed" : "";
    meta.innerHTML = '<strong>' + matches.length + '</strong>' + qualifier + ' trade' + (matches.length === 1 ? "" : "s") +
      ' shown' + (loading ? ' · scanning ' + seasonsChecked + ' of ' + seasonCount + ' franchise seasons…' : '') +
      (failedWeeks ? ' · ' + plural(failedWeeks,"week") + ' could not be checked' : '');
  }

  async function loadTrades() {
    if (loading || loaded || !panel.open || !state.user || !state.leagues.length) return;
    if (!state.historyLoaded) {
      setMessage("Waiting for franchise history to finish loading…");
      setNote("Trade History will scan current and previous Sleeper league seasons.");
      return;
    }
    const version = ++requestVersion;
    const lineages = getLineages();
    loading = true;
    trades = [];
    failedWeeks = 0;
    seasonCount = lineages.length;
    seasonsChecked = 0;
    setNote("Searching completed trades in " + plural(seasonCount,"franchise season") + "…");
    populateFilters();
    render();

    const results = await mapWithConcurrency(lineages, 3, async item => {
      const data = await loadSeason(item);
      if (version !== requestVersion) return;
      trades.push(...data.trades);
      failedWeeks += data.failed;
      seasonsChecked++;
      trades.sort((a,b) => b.timestamp - a.timestamp);
      populateFilters();
      render();
      return data;
    });
    if (version !== requestVersion) return;
    const outrightFailures = results.filter(result => result.status !== "fulfilled").length;
    failedWeeks += outrightFailures;
    if (trades.length) {
      await calculateGrades(version);
      if (version !== requestVersion) return;
    }
    loaded = true;
    loading = false;
    populateFilters();
    setNote(plural(trades.length,"completed trade") + " found across " + plural(seasonCount,"franchise season") +
      (failedWeeks ? ". Some league data was unavailable; totals may be incomplete." : "."));
    render();
  }

  function reset() {
    requestVersion++;
    trades = [];
    loading = false;
    loaded = false;
    failedWeeks = 0;
    seasonsChecked = 0;
    seasonCount = 0;
    grading = false;
    seasonContexts.clear(); draftBoardCache.clear(); matchupCache.clear();
    leagueFilter.innerHTML = '<option value="all">All leagues</option>';
    seasonFilter.innerHTML = '<option value="all">All seasons</option>';
    search.value = "";
    meta.textContent = "";
    setNote("Players, draft picks, and FAAB exchanged in completed Sleeper trades.");
    setMessage("Load the dashboard, then open Trade History to view your trades.");
  }

  panel.addEventListener("toggle", () => { if (panel.open) loadTrades(); });
  leagueFilter.addEventListener("change", render);
  seasonFilter.addEventListener("change", render);
  search.addEventListener("input", render);
  window.addEventListener("fantasy-dashboard-reset", reset);
  window.addEventListener("fantasy-owner-history-ready", () => { if (panel.open) loadTrades(); });
})();
