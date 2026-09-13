(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const API = "https://api.sleeper.app/v1";
  const PROJECTIONS = "https://api.sleeper.com/projections/nfl";
  const SKILL = new Set(["QB","RB","WR","TE"]);
  const WINDOW_KEY = "fantasyGameDayPulseWindow";
  const WINDOWS = [
    {id:"all", label:"Entire Week", short:"Entire Week"},
    {id:"1pm", label:"1:00 PM Window", short:"1 PM"},
    {id:"4pm", label:"4:00 PM Window", short:"4 PM"}
  ];

  const cache = new Map();
  let directoryPromise = null;
  let lastContextKey = "";
  let lastGameSignature = "";
  let renderTimer = null;

  const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  async function json(url){
    const response = await fetch(url,{cache:"force-cache"});
    if (!response.ok) throw new Error(`Sleeper request failed (${response.status})`);
    return response.json();
  }

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

  function readWindow(){
    try {
      const value = localStorage.getItem(WINDOW_KEY) || "all";
      return WINDOWS.some(item=>item.id===value) ? value : "all";
    } catch (_) { return "all"; }
  }

  function writeWindow(value){
    try { localStorage.setItem(WINDOW_KEY,value); }
    catch (_) {}
  }

  function windowInfo(id=readWindow()){
    return WINDOWS.find(item=>item.id===id) || WINDOWS[0];
  }

  function normalizeTeam(team){
    const value = String(team || "").toUpperCase();
    return ({JAC:"JAX",WSH:"WAS",OAK:"LV",SD:"LAC",STL:"LAR"})[value] || value;
  }

  function games(){
    try {
      if (typeof state !== "undefined" && Array.isArray(state.games)) return state.games;
    } catch (_) {}
    return [];
  }

  function gameSignature(){
    return games().map(game=>`${game?.id || ""}:${game?.date || ""}:${game?.away?.abbreviation || ""}:${game?.home?.abbreviation || ""}`).join("|");
  }

  function gameForTeam(team){
    const wanted = normalizeTeam(team);
    if (!wanted) return null;
    return games().find(game=>
      normalizeTeam(game?.away?.abbreviation)===wanted || normalizeTeam(game?.home?.abbreviation)===wanted
    ) || null;
  }

  function easternKickoff(game){
    if (!game?.date) return null;
    const date = new Date(game.date);
    if (Number.isNaN(date.getTime())) return null;
    try {
      const parts = new Intl.DateTimeFormat("en-US",{
        timeZone:"America/New_York",
        weekday:"short",
        hour:"numeric",
        minute:"2-digit",
        hourCycle:"h23"
      }).formatToParts(date);
      const part = type => parts.find(item=>item.type===type)?.value || "";
      return {weekday:part("weekday"),hour:Number(part("hour")),minute:Number(part("minute"))};
    } catch (_) { return null; }
  }

  function teamMatchesWindow(team,windowId){
    if (windowId === "all") return true;
    const kickoff = easternKickoff(gameForTeam(team));
    if (!kickoff || kickoff.weekday !== "Sun") return false;
    if (windowId === "1pm") return kickoff.hour === 13;
    if (windowId === "4pm") return kickoff.hour === 16;
    return true;
  }

  function mount(){
    let host = document.getElementById("gameDayPlayerPulse");
    if (!host){
      host = document.createElement("section");
      host.id = "gameDayPlayerPulse";
      host.className = "game-day-player-pulse";
      host.setAttribute("aria-live","polite");
    }

    const grid = document.querySelector(".content-grid");
    const lineup = document.querySelector("#lineupPulse,.lineup-pulse,.lineup-pulse-panel");
    const parent = grid?.parentNode || lineup?.parentNode || document.querySelector("main.shell,main,.shell") || document.body;
    if (grid && parent === grid.parentNode){
      if (host.parentNode !== parent || host.nextElementSibling !== grid) parent.insertBefore(host,grid);
    } else if (!host.isConnected) {
      parent.appendChild(host);
    }
    return host;
  }

  function tabsMarkup(active){
    return `<div class="game-day-pulse-window-tabs" role="group" aria-label="Player Pulse time window">
      ${WINDOWS.map(item=>`<button type="button" class="game-day-pulse-window${item.id===active?" active":""}" data-pulse-window="${item.id}" aria-pressed="${item.id===active?"true":"false"}">${esc(item.label)}</button>`).join("")}
    </div>`;
  }

  function headerMarkup(ctx,active){
    const info = windowInfo(active);
    const scope = active === "all" ? "the full NFL week" : `the Sunday ${info.short} window`;
    return `<div class="game-day-pulse-head">
      <div>
        <div class="game-day-pulse-eyebrow">Your cross-league gameday edge</div>
        <div class="game-day-pulse-title">Week ${ctx.week} Player Pulse</div>
        <div class="game-day-pulse-sub">Top starters across your Sleeper leagues for ${scope}, adjusted for league scoring and matchup leverage.</div>
      </div>
      <div class="game-day-pulse-badge">Week ${ctx.week}</div>
    </div>${tabsMarkup(active)}`;
  }

  function shellMarkup(ctx,active,message){
    const info = windowInfo(active);
    return `${headerMarkup(ctx,active)}<div class="game-day-pulse-grid">
      <div class="game-day-pulse-column">
        <div class="game-day-pulse-column-head"><span>Most Important Players</span><small>Top 5 · ${esc(info.short)}</small></div>
        <div class="game-day-pulse-list"><div class="game-day-pulse-empty">${esc(message || "Loading your most important players…")}</div></div>
      </div>
      <div class="game-day-pulse-column villains">
        <div class="game-day-pulse-column-head"><span>Villains of the Week</span><small>Top 5 · ${esc(info.short)}</small></div>
        <div class="game-day-pulse-list"><div class="game-day-pulse-empty">${esc(message || "Loading your biggest opponent threats…")}</div></div>
      </div>
    </div>`;
  }

  function isMine(roster,userId){
    if (!roster) return false;
    const coOwners = Array.isArray(roster.co_owners) ? roster.co_owners.map(String) : [];
    return String(roster.owner_id)===String(userId) || coOwners.includes(String(userId));
  }

  function starters(matchup,roster){
    const ids = Array.isArray(matchup?.starters) && matchup.starters.length ? matchup.starters : roster?.starters;
    return [...new Set((ids || []).map(String).filter(id=>id && id!=="0" && id!=="null"))];
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

  function leverage(league,roster,mine,theirs,week){
    let weight = 1;
    if (mine>0 && theirs>0){
      const margin = Math.abs(mine-theirs);
      weight += Math.max(0,1-Math.min(35,margin)/35)*.18;
    }
    const playoffStart = Number(league?.settings?.playoff_week_start || 0);
    if (playoffStart>0){
      if (week>=playoffStart) weight += .32;
      else if (week>=playoffStart-2) weight += .10;
    } else if (week>=12) weight += .08;

    const settings = roster?.settings || {};
    const wins = Number(settings.wins || 0), losses = Number(settings.losses || 0), ties = Number(settings.ties || 0);
    const played = wins+losses+ties;
    if (week>=8 && played>0){
      const pct = (wins+ties*.5)/played;
      if (pct<=.5) weight += .06;
      else if (pct<.65) weight += .03;
    }
    return Math.min(1.5,weight);
  }

  function addExposure(map,id,side,entry,record){
    if (!map.has(id)) map.set(id,{id,record,owned:[],against:[],ownedRaw:0,againstRaw:0,ownedWeighted:0,againstWeighted:0});
    const item = map.get(id);
    if (!item.record && record) item.record = record;
    const points = Number(entry.points || 0);
    const weighted = Number(entry.weighted || 0);
    if (side === "owned"){
      item.owned.push(entry);
      item.ownedRaw += points;
      item.ownedWeighted += weighted;
    } else {
      item.against.push(entry);
      item.againstRaw += points;
      item.againstWeighted += weighted;
    }
  }

  function getDirectory(){
    if (directoryPromise) return directoryPromise;
    directoryPromise = json(`${API}/players/nfl`).then(data=>{
      const map = new Map();
      for (const [id,p] of Object.entries(data || {})) map.set(String(id),{...p,player_id:String(id)});
      return map;
    });
    return directoryPromise;
  }

  async function loadRawPulse(ctx){
    if (cache.has(ctx.key)) return cache.get(ctx.key);
    const promise = (async()=>{
      const [user,directory,projectionRows] = await Promise.all([
        json(`${API}/user/${encodeURIComponent(ctx.username)}`),
        getDirectory(),
        json(`${PROJECTIONS}/${encodeURIComponent(ctx.season)}/${ctx.week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&order_by=pts_ppr`)
      ]);
      if (!user?.user_id) throw new Error("Sleeper user not found.");

      const leagues = await json(`${API}/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${encodeURIComponent(ctx.season)}`);
      const projections = projectionMap(projectionRows);
      const exposures = new Map();

      await Promise.all((leagues || []).map(async league=>{
        if (!league?.league_id) return;
        try {
          const [rosters,matchups] = await Promise.all([
            json(`${API}/league/${encodeURIComponent(league.league_id)}/rosters`),
            json(`${API}/league/${encodeURIComponent(league.league_id)}/matchups/${ctx.week}`)
          ]);
          const mine = (rosters || []).find(r=>isMine(r,user.user_id));
          if (!mine) return;
          const myMatchup = (matchups || []).find(m=>Number(m?.roster_id)===Number(mine.roster_id));
          if (!myMatchup || myMatchup.matchup_id==null) return;
          const opponentMatchup = (matchups || []).find(m=>Number(m?.matchup_id)===Number(myMatchup.matchup_id) && Number(m?.roster_id)!==Number(mine.roster_id));
          if (!opponentMatchup) return;
          const opponentRoster = (rosters || []).find(r=>Number(r?.roster_id)===Number(opponentMatchup.roster_id));

          const myIds = starters(myMatchup,mine).filter(id=>SKILL.has(String(directory.get(id)?.position || "").toUpperCase()));
          const oppIds = starters(opponentMatchup,opponentRoster).filter(id=>SKILL.has(String(directory.get(id)?.position || "").toUpperCase()));
          const myProj = myIds.reduce((sum,id)=>sum+projectionPoints(projections.get(id),league),0);
          const oppProj = oppIds.reduce((sum,id)=>sum+projectionPoints(projections.get(id),league),0);
          const weight = leverage(league,mine,myProj,oppProj,ctx.week);
          const leagueName = String(league.name || "Fantasy League");

          for (const id of myIds){
            const points = projectionPoints(projections.get(id),league);
            addExposure(exposures,id,"owned",{leagueName,points,weighted:points*weight,weight},directory.get(id));
          }
          for (const id of oppIds){
            const points = projectionPoints(projections.get(id),league);
            addExposure(exposures,id,"against",{leagueName,points,weighted:points*weight,weight},directory.get(id));
          }
        } catch (_) {}
      }));

      return [...exposures.values()].map(item=>({
        ...item,
        netFor:item.ownedWeighted-item.againstWeighted,
        netAgainst:item.againstWeighted-item.ownedWeighted
      }));
    })();
    cache.set(ctx.key,promise);
    return promise;
  }

  function rankedForWindow(all,windowId){
    const eligible = windowId === "all" ? all : all.filter(item=>teamMatchesWindow(item.record?.team,windowId));
    return {
      /* Keep the complete candidate pool. The final-ranking layer chooses the
         visible five using projection before final and Actual after final. */
      important:eligible.filter(item=>item.owned.length).sort((a,b)=>b.ownedRaw-a.ownedRaw || b.ownedWeighted-a.ownedWeighted || b.netFor-a.netFor),
      villains:eligible.filter(item=>item.against.length && item.netAgainst>.05).sort((a,b)=>b.againstRaw-a.againstRaw || b.againstWeighted-a.againstWeighted || b.netAgainst-a.netAgainst),
      eligibleCount:eligible.length
    };
  }

  function leagues(entries){
    const names = [];
    for (const entry of entries || []) if (entry.leagueName && !names.includes(entry.leagueName)) names.push(entry.leagueName);
    return names;
  }

  function card(item,type,index){
    const player = item.record || {};
    const name = player.full_name || [player.first_name,player.last_name].filter(Boolean).join(" ") || "NFL Player";
    const meta = [player.position,player.team].filter(Boolean).join(" · ");
    const villain = type === "villain";
    const projected = villain ? item.againstRaw : item.ownedRaw;
    const leagueNames = leagues(villain?item.against:item.owned);
    const image = player.player_id ? `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(player.player_id)}.jpg` : "";
    const leagueNote = leagueNames.length>1 ? `Across ${leagueNames.length} leagues` : "Projected this week";
    return `<article class="game-day-pulse-card ${villain?"villain":"important"}">
      <div class="game-day-pulse-rank">${index+1}</div>
      <div class="game-day-pulse-photo">${image?`<img src="${image}" alt="" loading="lazy" onerror="this.remove()">`:""}<span>${esc(name.split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase())}</span></div>
      <div class="game-day-pulse-copy">
        <div class="game-day-pulse-name">${esc(name)}</div>
        <div class="game-day-pulse-meta">${esc(meta || "NFL player")}</div>
        <div class="game-day-pulse-leagues">${esc(leagueNames.join(" · ") || "Cross-league")}</div>
      </div>
      <div class="game-day-pulse-score" data-display="projection">
        <strong>${projected.toFixed(1)}</strong><span>Proj. pts</span><small>${esc(leagueNote)}</small>
      </div>
    </article>`;
  }

  function resultsMarkup(ctx,active,data){
    const info = windowInfo(active);
    const scheduleReady = games().length>0;
    let important = data.important.length ? data.important.map((item,i)=>card(item,"important",i)).join("") : "";
    let villains = data.villains.length ? data.villains.map((item,i)=>card(item,"villain",i)).join("") : "";

    if (!important){
      const message = active!=="all" && !scheduleReady ? "Waiting for the NFL schedule to finish loading…" : `No qualifying starters found in the ${info.label.toLowerCase()}.`;
      important = `<div class="game-day-pulse-empty">${esc(message)}</div>`;
    }
    if (!villains){
      const message = active!=="all" && !scheduleReady ? "Waiting for the NFL schedule to finish loading…" : `No net opponent threats found in the ${info.label.toLowerCase()}.`;
      villains = `<div class="game-day-pulse-empty">${esc(message)}</div>`;
    }

    return `${headerMarkup(ctx,active)}<div class="game-day-pulse-grid">
      <div class="game-day-pulse-column"><div class="game-day-pulse-column-head"><span>Most Important Players</span><small>Top 5 · ${esc(info.short)}</small></div><div class="game-day-pulse-list">${important}</div></div>
      <div class="game-day-pulse-column villains"><div class="game-day-pulse-column-head"><span>Villains of the Week</span><small>Top 5 · ${esc(info.short)}</small></div><div class="game-day-pulse-list">${villains}</div></div>
    </div>`;
  }

  async function render(force=false){
    const ctx = context();
    const active = readWindow();
    const host = mount();
    const renderKey = `${ctx.key}|${active}|${active==="all"?"all":gameSignature()}`;

    if (!ctx.username){
      host.innerHTML = shellMarkup(ctx,active,"Enter your Sleeper username to build the player pulse.");
      host.dataset.loadedKey = renderKey;
      return;
    }
    if (!force && host.dataset.loadedKey===renderKey) return;

    lastContextKey = ctx.key;
    host.innerHTML = shellMarkup(ctx,active);
    try {
      const all = await loadRawPulse(ctx);
      if (context().key!==ctx.key || readWindow()!==active) return;
      const data = rankedForWindow(all,active);
      host.innerHTML = resultsMarkup(ctx,active,data);
      host.dataset.loadedKey = renderKey;
      lastGameSignature = gameSignature();
    } catch (error){
      host.innerHTML = shellMarkup(ctx,active,error?.message || "Player Pulse could not be loaded.");
    }
  }

  function schedule(force=false){
    clearTimeout(renderTimer);
    renderTimer = setTimeout(()=>render(force),100);
  }

  function init(){
    const host = mount();
    host.addEventListener("click",event=>{
      const button = event.target.closest("[data-pulse-window]");
      if (!button) return;
      const next = button.getAttribute("data-pulse-window");
      if (!WINDOWS.some(item=>item.id===next) || next===readWindow()) return;
      writeWindow(next);
      render(true);
    });

    render(true);
    document.addEventListener("input",event=>{
      if (event.target?.matches?.("#username,#sleeperUsername,input[name='username']")) schedule(true);
    });
    document.addEventListener("change",event=>{
      if (event.target?.matches?.("#username,#sleeperUsername,#week,#weekSelect,#week-selector,#season,#seasonSelect,input[name='username'],select[name='season'],select[name='week']")) schedule(true);
    });
    window.addEventListener("fantasy-settings-changed",()=>schedule(true));

    setInterval(()=>{
      mount();
      const ctx = context();
      const signature = gameSignature();
      if (ctx.key!==lastContextKey) schedule(true);
      else if (readWindow()!=="all" && signature!==lastGameSignature) schedule(true);
    },800);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
