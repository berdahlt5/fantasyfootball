(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const API = "https://api.sleeper.app/v1";
  const PROJECTIONS = "https://api.sleeper.com/projections/nfl";
  let directoryPromise = null;
  let latestKey = "";
  let latestBreakdowns = new Map();
  let refreshing = false;
  let applyQueued = false;

  function valueOf(selectors){
    for (const selector of selectors){
      const node = document.querySelector(selector);
      if (!node) continue;
      const value = "value" in node ? node.value : node.textContent;
      if (String(value || "").trim()) return String(value).trim();
    }
    return "";
  }

  function context(){
    const username = valueOf(["#username","#sleeperUsername","input[name='username']"]);
    const seasonRaw = valueOf(["#season","#seasonSelect","select[name='season']"]);
    const weekRaw = valueOf(["#week","#weekSelect","#week-selector","select[name='week']"]);
    const season = /^\d{4}$/.test(seasonRaw) ? seasonRaw : String(new Date().getFullYear());
    const match = weekRaw.match(/\d+/);
    const week = match ? Math.max(1,Math.min(18,Number(match[0]))) : 1;
    return {username,season,week,key:`${username.toLowerCase()}|${season}|${week}`};
  }

  async function json(url,cache="force-cache"){
    const response = await fetch(url,{cache});
    if (!response.ok) throw new Error(`Sleeper request failed (${response.status})`);
    return response.json();
  }

  function normalizeName(value){
    return String(value || "")
      .toLowerCase()
      .replace(/[’']/g,"")
      .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g,"")
      .replace(/[^a-z0-9]+/g," ")
      .trim()
      .replace(/\s+/g," ");
  }

  function getDirectory(){
    if (directoryPromise) return directoryPromise;
    directoryPromise = json(`${API}/players/nfl`).then(data=>{
      const map = new Map();
      for (const [id,player] of Object.entries(data || {})){
        if (!player) continue;
        for (const name of [player.full_name,[player.first_name,player.last_name].filter(Boolean).join(" ")]){
          const key = normalizeName(name);
          if (key && !map.has(key)) map.set(key,String(id));
        }
      }
      return map;
    }).catch(()=>new Map());
    return directoryPromise;
  }

  function isMine(roster,userId){
    if (!roster) return false;
    const coOwners = Array.isArray(roster.co_owners) ? roster.co_owners.map(String) : [];
    return String(roster.owner_id)===String(userId) || coOwners.includes(String(userId));
  }

  function starters(matchup,roster){
    const ids = Array.isArray(matchup?.starters) && matchup.starters.length ? matchup.starters : roster?.starters;
    return new Set((ids || []).map(String).filter(id=>id && id!=="0" && id!=="null"));
  }

  function projectionMap(rows){
    const map = new Map();
    for (const row of Array.isArray(rows)?rows:[]){
      const id = String(row?.player_id || row?.player?.player_id || "");
      if (id) map.set(id,row);
    }
    return map;
  }

  function projectionPoints(row,league){
    if (!row) return 0;
    const stats = row.stats || row.projection || {};
    const scoring = league?.scoring_settings || {};
    let total = 0;
    let matched = 0;

    for (const [key,multiplierRaw] of Object.entries(scoring)){
      const multiplier = Number(multiplierRaw);
      const stat = Number(stats?.[key]);
      if (!Number.isFinite(multiplier) || multiplier===0 || !Number.isFinite(stat)) continue;
      total += stat*multiplier;
      matched += 1;
    }
    if (matched>0 && Number.isFinite(total) && total!==0) return Math.max(0,total);

    const rec = Number(scoring.rec || 0);
    const fallback = rec>=.75 ? row.pts_ppr : rec>=.25 ? row.pts_half_ppr : row.pts_std;
    if (Number.isFinite(Number(fallback))) return Math.max(0,Number(fallback));
    for (const key of ["pts_ppr","pts_half_ppr","pts_std"]){
      if (Number.isFinite(Number(row?.[key]))) return Math.max(0,Number(row[key]));
    }
    return 0;
  }

  function addLeagueRow(map,id,side,league,projected,actual){
    const key = String(id);
    if (!map.has(key)) map.set(key,{owned:[],against:[]});
    map.get(key)[side].push({
      leagueId:String(league?.league_id || ""),
      leagueName:String(league?.name || "Fantasy League"),
      projected:Number.isFinite(Number(projected)) ? Number(projected) : 0,
      actual:Number.isFinite(Number(actual)) ? Number(actual) : 0
    });
  }

  async function fetchBreakdowns(ctx){
    if (!ctx.username) return new Map();
    const user = await json(`${API}/user/${encodeURIComponent(ctx.username)}`);
    if (!user?.user_id) return new Map();

    const [leagues,projectionRows] = await Promise.all([
      json(`${API}/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${encodeURIComponent(ctx.season)}`),
      json(`${PROJECTIONS}/${encodeURIComponent(ctx.season)}/${ctx.week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&order_by=pts_ppr`)
    ]);
    const projections = projectionMap(projectionRows);
    const breakdowns = new Map();

    await Promise.all((leagues || []).map(async league=>{
      if (!league?.league_id) return;
      try {
        const [rosters,matchups] = await Promise.all([
          json(`${API}/league/${encodeURIComponent(league.league_id)}/rosters`),
          json(`${API}/league/${encodeURIComponent(league.league_id)}/matchups/${ctx.week}`,"no-store")
        ]);
        const mine = (rosters || []).find(roster=>isMine(roster,user.user_id));
        if (!mine) return;
        const myMatchup = (matchups || []).find(matchup=>Number(matchup?.roster_id)===Number(mine.roster_id));
        if (!myMatchup || myMatchup.matchup_id==null) return;
        const opponentMatchup = (matchups || []).find(matchup=>
          Number(matchup?.matchup_id)===Number(myMatchup.matchup_id) &&
          Number(matchup?.roster_id)!==Number(mine.roster_id)
        );
        if (!opponentMatchup) return;
        const opponentRoster = (rosters || []).find(roster=>Number(roster?.roster_id)===Number(opponentMatchup.roster_id));
        const myStarters = starters(myMatchup,mine);
        const oppStarters = starters(opponentMatchup,opponentRoster);
        const myActual = myMatchup?.players_points || {};
        const oppActual = opponentMatchup?.players_points || {};

        for (const id of myStarters){
          addLeagueRow(breakdowns,id,"owned",league,projectionPoints(projections.get(String(id)),league),myActual?.[id] ?? 0);
        }
        for (const id of oppStarters){
          addLeagueRow(breakdowns,id,"against",league,projectionPoints(projections.get(String(id)),league),oppActual?.[id] ?? 0);
        }
      } catch (_) {}
    }));

    return breakdowns;
  }

  function playerIdFromCard(card,directory){
    const image = card.querySelector(".game-day-pulse-photo img");
    const src = image?.getAttribute("src") || "";
    const match = src.match(/\/players\/(?:thumb\/)?([^/?#.]+)\.jpg/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
    const name = card.querySelector(".game-day-pulse-name")?.textContent || "";
    return directory.get(normalizeName(name)) || "";
  }

  function escapeHtml(value){
    return String(value ?? "").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  }

  function rowMarkup(row){
    return `<div class="game-day-pulse-league-row">
      <span class="game-day-pulse-league-name">${escapeHtml(row.leagueName)}</span>
      <span class="game-day-pulse-league-proj"><small>P</small><strong>${row.projected.toFixed(1)}</strong></span>
      <span class="game-day-pulse-league-actual"><small>A</small><strong>${row.actual.toFixed(1)}</strong></span>
    </div>`;
  }

  function renderRows(card,rows){
    const ordered = [...rows].sort((a,b)=>b.projected-a.projected || a.leagueName.localeCompare(b.leagueName));
    const leagueLine = card.querySelector(".game-day-pulse-leagues");
    let details = card.querySelector(".game-day-pulse-league-details");

    if (!ordered.length){
      details?.remove();
      if (leagueLine) leagueLine.hidden = false;
      return;
    }

    if (ordered.length === 1){
      details?.remove();
      if (leagueLine){
        leagueLine.hidden = false;
        leagueLine.textContent = ordered[0].leagueName;
        leagueLine.title = `Proj ${ordered[0].projected.toFixed(1)} · Actual ${ordered[0].actual.toFixed(1)}`;
      }
      return;
    }

    if (leagueLine){
      leagueLine.hidden = true;
      leagueLine.title = ordered.map(row=>row.leagueName).join(" · ");
    }

    const wasOpen = Boolean(details?.open);
    if (!details){
      details = document.createElement("details");
      details.className = "game-day-pulse-league-details";
      card.appendChild(details);
    }

    const html = `<summary>
      <span class="game-day-pulse-league-summary-count">${ordered.length} leagues</span>
      <span class="game-day-pulse-league-summary-label">breakdown</span>
      <span class="game-day-pulse-league-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div class="game-day-pulse-league-breakdown">${ordered.map(rowMarkup).join("")}</div>`;

    if (details.innerHTML !== html){
      details.innerHTML = html;
      details.open = wasOpen;
    }
  }

  async function applyBreakdowns(){
    applyQueued = false;
    const cards = [...document.querySelectorAll("#gameDayPlayerPulse .game-day-pulse-card")];
    if (!cards.length) return;
    const directory = await getDirectory();

    for (const card of cards){
      if (!card.isConnected) continue;
      const id = playerIdFromCard(card,directory);
      if (!id) continue;
      const player = latestBreakdowns.get(String(id));
      const rows = card.classList.contains("villain") ? player?.against : player?.owned;
      renderRows(card,rows || []);
    }
  }

  function queueApply(){
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(applyBreakdowns);
  }

  async function refresh(force=false){
    if (refreshing) return;
    const ctx = context();
    if (!ctx.username) return;
    if (!force && latestKey===ctx.key){
      queueApply();
      return;
    }
    refreshing = true;
    try {
      const result = await fetchBreakdowns(ctx);
      if (context().key!==ctx.key) return;
      latestBreakdowns = result;
      latestKey = ctx.key;
      queueApply();
    } catch (_) {
      queueApply();
    } finally {
      refreshing = false;
    }
  }

  function init(){
    refresh(true);
    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length)) queueApply();
    });
    observer.observe(document.body,{childList:true,subtree:true});

    document.addEventListener("change",event=>{
      if (event.target?.matches?.("#username,#sleeperUsername,#week,#weekSelect,#week-selector,#season,#seasonSelect,input[name='username'],select[name='season'],select[name='week']")){
        latestKey = "";
        refresh(true);
      }
    });
    document.addEventListener("input",event=>{
      if (event.target?.matches?.("#username,#sleeperUsername,input[name='username']")){
        latestKey = "";
        refresh(false);
      }
    });

    setInterval(()=>{
      latestKey = "";
      refresh(true);
    },60000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();