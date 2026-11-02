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
      (wasUsedByRecipient ? "" : " (later traded)");
    asset.draftedName = drafted;
    asset.draftedPlayerId = String(p.player_id);
    asset.draftedYear = year;
    asset.draftOverall = slotNumber > 0 ? slotNumber : null;
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
        let localFailures=0;
        const results = await mapWithConcurrency(weekNumbers,5,async week => {
          const records = await fetchJson(SLEEPER_API + "/league/" + encodeURIComponent(leagueId) +
            "/matchups/" + week,"Trade grades matchups");
          return {week,records:Array.isArray(records)?records:[]};
        });
        const map=new Map();
        results.forEach(r=>{
          if (r.status==="fulfilled") map.set(r.value.week,r.value.records);
          else { failedWeeks++;localFailures++; }
        });
        ctx.matchupErrors=localFailures;
        return map;
      })();
      matchupCache.set(leagueId,pending);
    }
    return matchupCache.get(leagueId);
  }


  function pointValue(match, id) {
    if (!match) return null;
    const key=String(id);
    if (match.players_points && Number.isFinite(Number(match.players_points[key])) &&
        match.players_points[key] != null) return Number(match.players_points[key]);
    const slot=(match.starters || []).map(String).indexOf(key);
    if (slot >= 0 && Array.isArray(match.starters_points)) {
      const n=Number(match.starters_points[slot]);
      if (match.starters_points[slot] != null && Number.isFinite(n)) return n;
    }
    return null;
  }

  function median(numbers) {
    const sorted=numbers.filter(Number.isFinite).sort((a,b)=>a-b);
    if (!sorted.length) return null;
    const middle=Math.floor(sorted.length/2);
    return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
  }

  function weekPositionBaselines(rows) {
    const buckets=new Map();
    for (const team of rows || []) {
      for (const id of team.starters || []) {
        if (!id || String(id)==="0") continue;
        const pos=String(getPlayer(String(id))?.position || "OTHER").toUpperCase();
        const points=pointValue(team,id);
        if (pos==="OTHER" || points==null) continue;
        if (!buckets.has(pos)) buckets.set(pos,[]);
        buckets.get(pos).push(points);
      }
    }
    const baselines=new Map();
    for(const [position,values] of buckets) baselines.set(position,median(values));
    return baselines;
  }

  function isDynasty(trade) {
    const league=state.leagues.find(v=>String(v.leagueId)===String(trade.currentLeagueId));
    return Number(league?.rawLeague?.settings?.type)===2;
  }

  function seasonRowsFor(trade) {
    return seasonContextsFor(trade).filter(ctx => {
      const year=Number(ctx.row.season);
      return year >= Number(trade.season) && (isDynasty(trade)||year===Number(trade.season));
    });
  }

  function postseasonStartWeek(ctx) {
    const start=Number(ctx.league?.settings?.playoff_week_start ||
      ctx.view?.rawLeague?.settings?.playoff_week_start || 15);
    return Math.max(1,Math.min(19,Number.isFinite(start)?start:15));
  }

  async function getPostseason(ctx) {
    if (ctx.winnersBracket !== undefined) return ctx.winnersBracket;
    const data=await optionalJson(SLEEPER_API+"/league/"+encodeURIComponent(ctx.row.leagueId)+"/winners_bracket");
    ctx.winnersBracket=Array.isArray(data) ? data : null;
    return ctx.winnersBracket;
  }

  function playoffFinish(ctx, ownerId) {
    const roster=rosterForOwner(ctx,ownerId);
    if (!roster) return null;
    const bracket=ctx.winnersBracket;
    if (!Array.isArray(bracket) || !bracket.length) return null;
    const id=String(roster.roster_id);
    const involved=bracket.some(m=>String(m.t1)===id || String(m.t2)===id ||
      String(m.w)===id || String(m.l)===id);
    if (!involved) return "Missed playoffs";
    const placed=[];
    for(const m of bracket){
      const p=Number(m.p);
      if (!(p>=1)) continue;
      if(String(m.w)===id) placed.push(p);
      if(String(m.l)===id) placed.push(p+1);
    }
    const place=placed.length?Math.min(...placed):null;
    if(place===1)return "Champion";
    if(place===2)return "Runner-up";
    if(place===3)return "Third place";
    if(place!=null)return "Finished "+place+"th";
    return "Made playoffs";
  }

  function assetImpact(assets,ownerId,trade,contexts) {
    const aggregate={points:0,starts:0,above:0,weighted:0,playoffStarts:0,playoffPoints:0,
      seasons:[],missingPoints:false};
    for (const asset of assets) {
      const stats={points:0,starts:0,above:0,playoffStarts:0,bySeason:[]};
      asset.performance=stats;
      if (!asset.playerId) continue;
      for(const ctx of contexts){
        const year=Number(ctx.row.season);
        if (asset.type==="pick" && year<Number(asset.draftedYear)) continue;
        const roster=rosterForOwner(ctx,ownerId);
        if (!roster) continue;
        let starts=0,points=0,above=0,playoffStarts=0;
        for(const [week,rows] of ctx.weeklyMatchups || []){
          if (year===Number(trade.season) && week<Math.max(1,Number(trade.week||1))) continue;
          const m=rows.find(x=>String(x.roster_id)===String(roster.roster_id));
          if (!m || !(m.starters || []).map(String).includes(String(asset.playerId))) continue;
          const value=pointValue(m,asset.playerId);
          if (value==null){aggregate.missingPoints=true;continue;}
          const playerPos=String(getPlayer(asset.playerId)?.position || "OTHER").toUpperCase();
          const baseline=ctx.weeklyBaselines?.get(week)?.get(playerPos);
          if(baseline==null){aggregate.missingPoints=true;continue;}
          const playoff=week>=postseasonStartWeek(ctx);
          const excess=value-baseline;
          // Playoff starts matter more; more recent seasons carry slightly more weight.
          const recency=year===Number(state.nflState?.season)?1.12:1;
          const weight=(playoff?1.5:1)*recency;
          stats.points+=value;stats.starts++;stats.above+=excess;
          aggregate.points+=value;aggregate.starts++;aggregate.above+=excess;
          aggregate.weighted+=excess*weight;
          if(playoff){stats.playoffStarts++;aggregate.playoffStarts++;aggregate.playoffPoints+=value;}
          starts++;points+=value;above+=excess;
        }
        stats.bySeason.push({year:String(year),starts,points,above});
      }
    }
    aggregate.ppg=aggregate.starts ? aggregate.points/aggregate.starts : null;
    const years=[...new Set(contexts.map(ctx=>String(ctx.row.season)))].sort();
    aggregate.seasons=years.map(year=>{
      const yearStats={year,points:0,starts:0,above:0};
      assets.forEach(asset => (asset.performance?.bySeason || []).filter(s=>s.year===year).forEach(s=>{
        yearStats.points+=s.points;yearStats.starts+=s.starts;yearStats.above+=s.above;
      }));
      return yearStats;
    }).filter(v=>v.starts>0);
    return aggregate;
  }

  function letterForAdvantage(advantage) {
    if(advantage >= 1.35)return "A";
    if(advantage >= .8)return "A−";
    if(advantage >= .34)return "B+";
    if(advantage > -.34)return "B";
    if(advantage > -.8)return "C+";
    if(advantage > -1.35)return "C";
    return "D";
  }

  function gradeSummary(me,them,picks,contexts,trade) {
    const count=me.starts+them.starts;
    const unresolved=picks.some(item=>
      ["pending","unresolved","ambiguous","moved"].includes(item.asset.resolution));
    const futurePicks=picks.some(item=>Number(item.asset.pick.season)>Number(state.nflState?.season));
    const matchupMissing=contexts.some(ctx=>ctx.matchupErrors>0 || !ctx.weeklyMatchups);
    const currentSeasonOngoing=contexts.some(ctx=>
      String(ctx.row.season)===String(state.nflState?.season) &&
      String(state.nflState?.season_type||"regular")!=="post" &&
      String(state.nflState?.season_type||"regular")!=="off");
    const provisional=unresolved || futurePicks || matchupMissing || currentSeasonOngoing || me.missingPoints || them.missingPoints || count<10;
    if(count===0)return {status:"pending",note:"No completed fantasy starts for these players yet.",
      my:me,them,unresolved,confidence:"Pending"};
    const difference=me.weighted-them.weighted;
    // Relative to typical position-specific starters, with a neutral B for similar outcomes.
    const scale=Math.max(16,5*Math.sqrt(count));
    const advantage=difference/scale;
    const wins=Math.abs(difference)<Math.max(8,0.32*count) ? "Close" :
      difference>0?"Your side":"Their side";
    const myGrade=letterForAdvantage(advantage);
    const theirGrade=letterForAdvantage(-advantage);
    const finishedYear=Math.max(...contexts.map(c=>Number(c.row.season)||0));
    const haveBothSeasons=isDynasty(trade) && finishedYear>Number(trade.season);
    return {
      status:provisional || !haveBothSeasons && isDynasty(trade) ? "provisional":"graded",
      my:me,them,myGrade,theirGrade,wins,unresolved,confidence:provisional?"Early result":"Based on games played",
      difference,scale,advantage,
      postseason:contexts.map(ctx=>({
        year:String(ctx.row.season),
        yours:playoffFinish(ctx,trade.myOwnerId),
        theirs:playoffFinish(ctx,trade.opponentOwnerId)
      })).filter(p=>p.yours || p.theirs)
    };
  }

  async function calculateGrades(version) {
    grading=true;
    setNote("Checking game results and matching traded draft picks…");
    const contexts=[...seasonContexts.values()].filter(ctx=>{
      const related=trades.filter(t=>t.currentLeagueId===String(ctx.view.leagueId));
      return related.some(t=>{
        const year=Number(ctx.row.season);
        return year>=Number(t.season) && (isDynasty(t)||year===Number(t.season));
      });
    });
    await mapWithConcurrency(contexts,3,async ctx=>{
      if(version!==requestVersion)return;
      const league=await optionalJson(SLEEPER_API+"/league/"+encodeURIComponent(ctx.row.leagueId));
      ctx.league=league || ctx.view.rawLeague;
      await Promise.all([getPostseason(ctx),matchupWeeksFor(ctx).then(weeks=>{
        ctx.weeklyMatchups=weeks;
        ctx.weeklyBaselines=new Map();
        for(const [week,rows] of weeks)ctx.weeklyBaselines.set(week,weekPositionBaselines(rows));
      })]);
    });
    if(version!==requestVersion)return;
    await mapWithConcurrency(trades,4,async trade=>{
      if(!trade.gradeable){trade.grade={status:"unavailable"};return;}
      const picks=[...trade.received.map(asset=>({asset,owner:trade.myOwnerId})),
        ...trade.opponentReturn.map(asset=>({asset,owner:trade.opponentOwnerId}))].filter(item=>item.asset.type==="pick");
      await Promise.all(picks.map(item=>resolvePick(item.asset,trade,item.owner)));
      if(version!==requestVersion)return;
      const rows=seasonRowsFor(trade);
      const my=assetImpact(trade.received,trade.myOwnerId,trade,rows);
      const them=assetImpact(trade.opponentReturn,trade.opponentOwnerId,trade,rows);
      trade.grade=gradeSummary(my,them,picks,rows,trade);
    });
    grading=false;
  }

  function fmt(n,decimals=1) {return Number(n||0).toFixed(decimals);}
  function signed(n) {return (n>0?"+":"") + fmt(n);}
  function seasonPerformanceHtml(stats) {
    if(!stats?.seasons?.length)return "";
    return '<div class="trade-season-lines">' + stats.seasons.map(s=>
      '<div class="trade-season-line"><span>'+safe(s.year)+'</span>'+
      '<strong>'+s.starts+' starts · '+fmt(s.points/s.starts)+' PPG</strong>'+
      '<small>'+signed(s.above)+' vs league starters</small></div>'
    ).join("")+'</div>';
  }
  function sideMetricHtml(stats,label) {
    return '<div class="trade-impact-side"><div class="trade-impact-side-title">'+safe(label)+'</div>'+
      '<div class="trade-impact-main"><strong>'+signed(stats.above)+'</strong><span>points vs similar starters</span></div>'+
      '<div class="trade-impact-numbers">'+stats.starts+' fantasy starts · '+(stats.ppg==null?"—":fmt(stats.ppg))+' PPG</div>'+
      seasonPerformanceHtml(stats)+'</div>';
  }
  function gradeHtml(trade) {
    const g=trade.grade;
    if(!g)return '<p class="trade-grade-empty">Checking performance…</p>';
    if(g.status==="unavailable")return '<p class="trade-grade-empty">A two-team trade is required for a side-by-side grade.</p>';
    if(g.status==="pending")return '<p class="trade-grade-empty">Grade pending: No tracked lineup starts yet. Draft picks remain visible above.</p>';
    const verdict=g.wins==="Close"?"Close trade":g.wins==="Your side"?"Your side leads":"Other side leads";
    const postseason=g.postseason?.length?'<div class="trade-playoff-line"><strong>Playoff context</strong>'+
      g.postseason.map(p=>'<span>'+safe(p.year)+': You — '+safe(p.yours || "Not yet available")+
        ' · They — '+safe(p.theirs || "Not yet available")+'</span>').join("")+'</div>':"";
    const pending=g.unresolved?'<p class="trade-grade-disclaimer">Some draft picks are still unresolved or were traded again. Their future value is not included.</p>':"";
    const caveat=g.status==="provisional"?' <span class="trade-verdict-soft">Provisional</span>':"";
    return '<div class="trade-grade-block"><div class="trade-verdict"><div><span class="trade-verdict-label">Trade review</span>'+
      '<h4>'+safe(verdict)+caveat+'</h4></div><div class="trade-verdict-grades"><span>You <strong>'+safe(g.myGrade)+'</strong></span>'+
      '<span>Other side <strong>'+safe(g.theirGrade)+'</strong></span></div></div>'+
      '<div class="trade-impact-grid">'+sideMetricHtml(g.my,"Your players")+sideMetricHtml(g.them,"Their players")+'</div>'+
      postseason+pending+
      '<p class="trade-grade-disclaimer">Grades use points above the league median starter at each position. Playoff starts count 1.5×, and the current season 1.12×. Team finishes are context, not extra grade points.</p></div>';
  }

  function playerPicture(asset) {
    if(!asset.playerId && !asset.draftedName)return '<span class="trade-pick-art">'+safe(asset.type==="faab"?"FAAB":"PICK")+'</span>';
    const id=String(asset.playerId||asset.draftedPlayerId||"");
    const name=asset.draftedName || playerName(getPlayer(id),id);
    const position=String(getPlayer(id)?.position||"");
    const fallback=safe((position && position!=="OTHER" ? position : (name.split(/\s+/).map(p=>p[0]).slice(0,2).join("")))||"NFL");
    const src=/^[A-Za-z0-9_-]+$/.test(id) && id
      ? 'https://sleepercdn.com/content/nfl/players/thumb/'+encodeURIComponent(id)+'.jpg'
      : '';
    if(!src)return '<span class="trade-pick-art">'+fallback+'</span>';
    return '<span class="trade-player-photo"><span class="trade-avatar-fallback">'+fallback+'</span>'+
      '<img src="'+src+'" alt="" loading="lazy" decoding="async" onerror="this.hidden=true" /></span>';
  }

  function assetHtml(assets) {
    if (!assets.length)return '<p class="trade-history-no-assets">No assets recorded</p>';
    return '<ul class="trade-history-assets">'+assets.map(asset=>{
      const name=asset.type==="player"?playerName(getPlayer(asset.playerId),asset.playerId):
        asset.type==="pick"?(asset.pick.season+' Round '+asset.pick.round+' pick'):
        asset.text;
      const picked=asset.draftedName ? "Drafted: "+asset.draftedName+
        (asset.draftOverall?' (#'+asset.draftOverall+')':'')+
        (asset.resolution==="moved"?" · pick later traded":"") : "";
      const info=asset.type==="player"?String(getPlayer(asset.playerId)?.position || "NFL"):
        asset.type==="pick"?(picked || (asset.resolution==="pending"?"Not drafted yet":"Draft result unavailable")):
        "Waiver budget";
      const years=(asset.performance?.bySeason||[]);
      const metric=years.length?years.map(y=>y.year+': '+y.starts+
        ' fantasy starts'+(y.starts?' · '+fmt(y.points/y.starts)+' PPG':'')).join('  |  '):"";
      return '<li class="trade-asset">'+playerPicture(asset)+
        '<span class="trade-asset-copy"><span class="trade-asset-name">'+safe(name)+'</span>'+
        '<span class="trade-asset-detail">'+safe(info)+'</span>'+
        (metric?'<span class="trade-asset-metric">'+safe(metric)+'</span>':"")+
        '</span></li>';
    }).join("")+'</ul>';
  }

  function tradeHtml(trade) {
    const date=trade.timestamp>0?new Date(trade.timestamp).toLocaleDateString(undefined,
      {month:"short",day:"numeric",year:"numeric"}):"Date unknown";
    const when=date+(trade.week>0?" · Week "+trade.week:"");
    const grade=trade.grade;
    const gradeBadge=grade && grade.myGrade?
      '<span class="trade-result-pill">'+safe(grade.status==="provisional"?"Early grade ":"Grade ")+safe(grade.myGrade)+'</span>':"";
    return '<article class="trade-history-item"><div class="trade-history-item-head">'+
      '<div><div class="trade-history-matchup">Trade with '+safe(trade.counterpart)+'</div>'+
      '<div class="trade-history-date">'+safe(when)+'</div></div>'+gradeBadge+'</div>'+
      '<div class="trade-history-sides">'+
      '<section class="trade-history-side"><h4>You received</h4>'+assetHtml(trade.received)+'</section>'+
      '<section class="trade-history-side"><h4>They received</h4>'+assetHtml(trade.sent)+'</section>'+
      '</div>'+gradeHtml(trade)+'</article>';
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
          '<span class="trade-history-chevron" aria-hidden="true"></span></summary>' +
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
    setNote("See who got what and how each side performed after the trade.");
    setMessage("Load the dashboard, then open Trade History to view your trades.");
  }

  panel.addEventListener("toggle", () => { if (panel.open) loadTrades(); });
  leagueFilter.addEventListener("change", render);
  seasonFilter.addEventListener("change", render);
  search.addEventListener("input", render);
  window.addEventListener("fantasy-dashboard-reset", reset);
  window.addEventListener("fantasy-owner-history-ready", () => { if (panel.open) loadTrades(); });
})();
