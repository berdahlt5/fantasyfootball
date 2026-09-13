(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const HUB_NAME = "Game Day Hub";
  const SLEEPER_API = "https://api.sleeper.app/v1";
  const SLEEPER_PROJECTIONS = "https://api.sleeper.com/projections/nfl";
  const SKILL_POSITIONS = new Set(["QB","RB","WR","TE"]);

  function renamePage(){
    const heading = document.querySelector(".brand h1, .topbar h1, h1");
    if (heading && /watch planner|schedule tool|game day hub/i.test(heading.textContent || "")) heading.textContent = HUB_NAME;
    document.title = `Fantasy Assistant · ${HUB_NAME}`;
  }

  function normalizeName(value){
    return String(value || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function initials(name){
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0,2).map(part=>part[0] || "").join("").toUpperCase() || "NFL";
  }

  function directPlayerId(card){
    const attrs = [
      card.dataset.playerId,
      card.dataset.playerid,
      card.getAttribute("data-player-id"),
      card.querySelector("[data-player-id]")?.getAttribute("data-player-id")
    ];
    return attrs.find(Boolean) || "";
  }

  function candidateTexts(card){
    const nodes = [
      card.querySelector(".impact-player-main"),
      card.querySelector(".impact-player-name"),
      card.querySelector(".player-name"),
      card.querySelector("strong")
    ].filter(Boolean);
    const raw = nodes.map(n=>n.textContent || "");
    raw.push(card.getAttribute("aria-label") || "", card.getAttribute("title") || "");
    const parts = [];
    for (const value of raw){
      for (const bit of String(value).split(/\n|·|•|\|| — | – | - /)){
        const clean = bit
          .replace(/\b(QB|RB|WR|TE|K|DEF|DST)\b.*$/i, "")
          .replace(/\b\d+(?:\.\d+)?\s*(?:pts?|points?)\b.*$/i, "")
          .trim();
        if (clean && clean.split(/\s+/).length >= 2 && clean.length <= 45) parts.push(clean);
      }
    }
    return [...new Set(parts)];
  }

  async function sleeperJSON(url){
    const response = await fetch(url, {cache:"force-cache"});
    if (!response.ok) throw new Error(`Sleeper request ${response.status}`);
    return response.json();
  }

  let directoryPromise = null;
  function getDirectory(){
    if (directoryPromise) return directoryPromise;
    directoryPromise = sleeperJSON(`${SLEEPER_API}/players/nfl`)
      .then(data=>{
        const byName = new Map();
        const byId = new Map();
        for (const [id,p] of Object.entries(data || {})){
          if (!p) continue;
          const record = {...p, player_id:String(id)};
          byId.set(String(id), record);
          const names = [p.full_name, [p.first_name,p.last_name].filter(Boolean).join(" ")];
          for (const name of names){
            const key = normalizeName(name);
            if (key && !byName.has(key)) byName.set(key, record);
          }
        }
        return {byName,byId};
      })
      .catch(()=>({byName:new Map(),byId:new Map()}));
    return directoryPromise;
  }

  function findRecord(card, directory){
    const id = directPlayerId(card);
    if (id && directory.byId.has(String(id))) return directory.byId.get(String(id));
    for (const candidate of candidateTexts(card)){
      const key = normalizeName(candidate);
      if (directory.byName.has(key)) return directory.byName.get(key);
    }
    return null;
  }

  function fieldValue(selectors){
    for (const selector of selectors){
      const node = document.querySelector(selector);
      if (!node) continue;
      const value = "value" in node ? node.value : node.textContent;
      if (String(value || "").trim()) return String(value).trim();
    }
    return "";
  }

  function currentContext(){
    const username = fieldValue(["#username","#sleeperUsername","input[name='username']"]);
    const seasonRaw = fieldValue(["#season","#seasonSelect","select[name='season']"]);
    const weekRaw = fieldValue(["#week","#weekSelect","#week-selector","select[name='week']"]);
    const season = /^\d{4}$/.test(seasonRaw) ? seasonRaw : String(new Date().getFullYear());
    const weekMatch = weekRaw.match(/\d+/);
    const week = weekMatch ? Math.max(1, Math.min(18, Number(weekMatch[0]))) : 1;
    return {username,season,week};
  }

  function isMyRoster(roster,userId){
    if (!roster) return false;
    const coOwners = Array.isArray(roster.co_owners) ? roster.co_owners.map(String) : [];
    return String(roster.owner_id) === String(userId) || coOwners.includes(String(userId));
  }

  const opponentLeagueCache = new Map();
  async function getOpponentLeagueContext(){
    const ctx = currentContext();
    if (!ctx.username) return {playerLeagues:new Map(), leagueNames:[]};
    const key = `${ctx.username.toLowerCase()}|${ctx.season}|${ctx.week}`;
    if (opponentLeagueCache.has(key)) return opponentLeagueCache.get(key);

    const promise = (async()=>{
      try {
        const user = await sleeperJSON(`${SLEEPER_API}/user/${encodeURIComponent(ctx.username)}`);
        if (!user?.user_id) return {playerLeagues:new Map(), leagueNames:[]};
        const leagues = await sleeperJSON(`${SLEEPER_API}/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${encodeURIComponent(ctx.season)}`);
        const playerLeagues = new Map();
        const leagueNames = (leagues || []).map(l=>String(l?.name || "").trim()).filter(Boolean);

        await Promise.all((leagues || []).map(async league=>{
          if (!league?.league_id) return;
          try {
            const [rosters,matchups] = await Promise.all([
              sleeperJSON(`${SLEEPER_API}/league/${encodeURIComponent(league.league_id)}/rosters`),
              sleeperJSON(`${SLEEPER_API}/league/${encodeURIComponent(league.league_id)}/matchups/${ctx.week}`)
            ]);
            const mine = (rosters || []).find(r=>isMyRoster(r,user.user_id));
            if (!mine) return;
            const myMatchup = (matchups || []).find(m=>Number(m?.roster_id) === Number(mine.roster_id));
            if (!myMatchup || myMatchup.matchup_id == null) return;
            const opponent = (matchups || []).find(m=>
              Number(m?.matchup_id) === Number(myMatchup.matchup_id) &&
              Number(m?.roster_id) !== Number(mine.roster_id)
            );
            if (!opponent) return;
            const leagueName = String(league.name || "Fantasy League").trim();
            const ids = new Set([...(opponent.players || []), ...(opponent.starters || [])].map(String));
            for (const id of ids){
              if (!playerLeagues.has(id)) playerLeagues.set(id, []);
              const names = playerLeagues.get(id);
              if (!names.includes(leagueName)) names.push(leagueName);
            }
          } catch (_) {}
        }));

        return {playerLeagues,leagueNames};
      } catch (_) {
        return {playerLeagues:new Map(),leagueNames:[]};
      }
    })();

    opponentLeagueCache.set(key,promise);
    return promise;
  }

  function leagueNamesFromDom(card, knownNames){
    const found = [];
    const add = value=>{
      const clean = String(value || "").trim();
      if (clean && !found.includes(clean)) found.push(clean);
    };

    const direct = [
      card.getAttribute("data-league-name"),
      card.dataset.leagueName,
      card.closest("[data-league-name]")?.getAttribute("data-league-name")
    ];
    direct.forEach(add);

    const scope = card.closest(".league-card,.watch-card,.game-card,.window-ranked-game,.watch-window") || card.parentElement;
    if (scope){
      for (const node of scope.querySelectorAll(".league-title,.league-name,.live-league-name,[data-league-name]")){
        add(node.getAttribute("data-league-name") || node.textContent);
      }
      const text = String(scope.textContent || "").toLowerCase();
      for (const name of knownNames || []){
        if (name && text.includes(String(name).toLowerCase())) add(name);
      }
    }
    return found.slice(0,3);
  }

  function ensurePhoto(card, record, displayName){
    if (card.querySelector(":scope > .gameday-player-photo")) return;
    const wrap = document.createElement("div");
    wrap.className = "gameday-player-photo";
    wrap.setAttribute("aria-hidden", "true");
    const fallback = document.createElement("span");
    fallback.textContent = initials(displayName || record?.full_name);
    wrap.appendChild(fallback);
    if (record?.player_id){
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(record.player_id)}.jpg`;
      img.addEventListener("error", ()=>img.remove(), {once:true});
      wrap.appendChild(img);
    }
    card.prepend(wrap);
  }

  function ensureLeagueLine(card, leagueNames){
    card.querySelectorAll(".gameday-player-team,.gameday-player-leagues").forEach(node=>node.remove());
    if (!leagueNames?.length) return;
    const line = document.createElement("div");
    line.className = "gameday-player-leagues";

    const label = document.createElement("span");
    label.className = "gameday-league-label";
    label.textContent = leagueNames.length > 1 ? "Fantasy leagues" : "Fantasy league";
    line.appendChild(label);

    const names = document.createElement("span");
    names.className = "gameday-league-name";
    names.textContent = leagueNames.join(" · ");
    line.appendChild(names);
    card.appendChild(line);
  }

  async function enhancePlayers(){
    const cards = [...document.querySelectorAll(".impact-player:not([data-gameday-enhanced])")];
    if (!cards.length) return;
    cards.forEach(card=>card.dataset.gamedayEnhanced = "processing");

    const [directory,leagueContext] = await Promise.all([getDirectory(),getOpponentLeagueContext()]);
    for (const card of cards){
      if (!card.isConnected) continue;
      const record = findRecord(card,directory);
      const displayName = candidateTexts(card)[0] || record?.full_name || "NFL Player";
      const playerId = String(record?.player_id || directPlayerId(card) || "");
      let leagueNames = playerId ? [...(leagueContext.playerLeagues.get(playerId) || [])] : [];
      if (!leagueNames.length) leagueNames = leagueNamesFromDom(card,leagueContext.leagueNames);

      if (record || leagueNames.length){
        card.classList.add("gameday-enhanced-player");
        ensurePhoto(card,record,displayName);
        ensureLeagueLine(card,leagueNames);
        card.dataset.gamedayEnhanced = "1";
      } else {
        card.dataset.gamedayEnhanced = "unmatched";
      }
    }
  }

  function projectionMap(rows){
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []){
      const id = String(row?.player_id || row?.player?.player_id || "");
      if (id) map.set(id,row);
    }
    return map;
  }

  function projectionPoints(row, league){
    if (!row) return 0;
    const stats = row.stats || row.projection || {};
    const scoring = league?.scoring_settings || {};
    let total = 0;
    let matched = 0;

    for (const [key,multiplierRaw] of Object.entries(scoring)){
      const multiplier = Number(multiplierRaw);
      const stat = Number(stats?.[key]);
      if (!Number.isFinite(multiplier) || multiplier === 0 || !Number.isFinite(stat)) continue;
      total += stat * multiplier;
      matched += 1;
    }

    if (matched > 0 && Number.isFinite(total) && total !== 0) return Math.max(0,total);

    const rec = Number(scoring.rec || 0);
    const fallback = rec >= .75 ? row.pts_ppr : rec >= .25 ? row.pts_half_ppr : row.pts_std;
    const n = Number(fallback);
    if (Number.isFinite(n)) return Math.max(0,n);

    for (const key of ["pts_ppr","pts_half_ppr","pts_std"]){
      const value = Number(row?.[key]);
      if (Number.isFinite(value)) return Math.max(0,value);
    }
    return 0;
  }

  function starterIds(matchup,roster){
    const ids = Array.isArray(matchup?.starters) && matchup.starters.length ? matchup.starters : roster?.starters;
    return [...new Set((ids || []).map(String).filter(id=>id && id !== "0" && id !== "null"))];
  }

  function leagueLeverage(league,mine,myProjection,opponentProjection,week){
    let weight = 1;
    if (myProjection > 0 && opponentProjection > 0){
      const margin = Math.abs(myProjection-opponentProjection);
      weight += Math.max(0,1-Math.min(35,margin)/35) * .18;
    }

    const playoffStart = Number(league?.settings?.playoff_week_start || 0);
    if (playoffStart > 0){
      if (week >= playoffStart) weight += .32;
      else if (week >= playoffStart-2) weight += .10;
    } else if (week >= 12){
      weight += .08;
    }

    const settings = mine?.settings || {};
    const wins = Number(settings.wins || 0), losses = Number(settings.losses || 0), ties = Number(settings.ties || 0);
    const games = wins+losses+ties;
    if (week >= 8 && games > 0){
      const pct = (wins + ties*.5) / games;
      if (pct <= .5) weight += .06;
      else if (pct < .65) weight += .03;
    }
    return Math.min(1.5,weight);
  }

  function addExposure(map,id,side,entry,record){
    if (!map.has(id)){
      map.set(id,{
        id,
        record,
        owned:[],
        against:[],
        ownedRaw:0,
        againstRaw:0,
        ownedWeighted:0,
        againstWeighted:0
      });
    }
    const item = map.get(id);
    if (!item.record && record) item.record = record;
    item[side].push(entry);
    if (side === "owned"){
      item.ownedRaw += entry.points;
      item.ownedWeighted += entry.weightedPoints;
    } else {
      item.againstRaw += entry.points;
      item.againstWeighted += entry.weightedPoints;
    }
  }

  const weeklyPulseCache = new Map();
  async function getWeeklyPulseData(){
    const ctx = currentContext();
    if (!ctx.username) return {ctx,important:[],villains:[],message:"Load your Sleeper username to see this week’s player leverage."};
    const key = `${ctx.username.toLowerCase()}|${ctx.season}|${ctx.week}`;
    if (weeklyPulseCache.has(key)) return weeklyPulseCache.get(key);

    const promise = (async()=>{
      try {
        const [user,directory,projectionRows] = await Promise.all([
          sleeperJSON(`${SLEEPER_API}/user/${encodeURIComponent(ctx.username)}`),
          getDirectory(),
          sleeperJSON(`${SLEEPER_PROJECTIONS}/${encodeURIComponent(ctx.season)}/${ctx.week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&order_by=pts_ppr`)
        ]);
        if (!user?.user_id) return {ctx,important:[],villains:[],message:"Sleeper user not found."};

        const leagues = await sleeperJSON(`${SLEEPER_API}/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${encodeURIComponent(ctx.season)}`);
        const projections = projectionMap(projectionRows);
        const exposures = new Map();

        const leagueResults = await Promise.all((leagues || []).map(async league=>{
          if (!league?.league_id) return null;
          try {
            const [rosters,matchups] = await Promise.all([
              sleeperJSON(`${SLEEPER_API}/league/${encodeURIComponent(league.league_id)}/rosters`),
              sleeperJSON(`${SLEEPER_API}/league/${encodeURIComponent(league.league_id)}/matchups/${ctx.week}`)
            ]);
            const mine = (rosters || []).find(r=>isMyRoster(r,user.user_id));
            if (!mine) return null;
            const myMatchup = (matchups || []).find(m=>Number(m?.roster_id) === Number(mine.roster_id));
            if (!myMatchup || myMatchup.matchup_id == null) return null;
            const opponentMatchup = (matchups || []).find(m=>
              Number(m?.matchup_id) === Number(myMatchup.matchup_id) &&
              Number(m?.roster_id) !== Number(mine.roster_id)
            );
            if (!opponentMatchup) return null;
            const opponentRoster = (rosters || []).find(r=>Number(r?.roster_id) === Number(opponentMatchup.roster_id));
            const mineIds = starterIds(myMatchup,mine);
            const opponentIds = starterIds(opponentMatchup,opponentRoster);
            const validMine = mineIds.filter(id=>SKILL_POSITIONS.has(String(directory.byId.get(id)?.position || "").toUpperCase()));
            const validOpponent = opponentIds.filter(id=>SKILL_POSITIONS.has(String(directory.byId.get(id)?.position || "").toUpperCase()));
            const myProjection = validMine.reduce((sum,id)=>sum+projectionPoints(projections.get(id),league),0);
            const opponentProjection = validOpponent.reduce((sum,id)=>sum+projectionPoints(projections.get(id),league),0);
            const leverage = leagueLeverage(league,mine,myProjection,opponentProjection,ctx.week);
            return {league,mine,opponentRoster,validMine,validOpponent,myProjection,opponentProjection,leverage};
          } catch (_) {
            return null;
          }
        }));

        for (const result of leagueResults.filter(Boolean)){
          const {league,validMine,validOpponent,leverage} = result;
          const leagueName = String(league.name || "Fantasy League").trim();
          for (const id of validMine){
            const points = projectionPoints(projections.get(id),league);
            if (points <= 0) continue;
            addExposure(exposures,id,"owned",{
              leagueId:String(league.league_id),leagueName,points,leverage,weightedPoints:points*leverage
            },directory.byId.get(id));
          }
          for (const id of validOpponent){
            const points = projectionPoints(projections.get(id),league);
            if (points <= 0) continue;
            addExposure(exposures,id,"against",{
              leagueId:String(league.league_id),leagueName,points,leverage,weightedPoints:points*leverage
            },directory.byId.get(id));
          }
        }

        const all = [...exposures.values()].map(item=>{
          const netFor = item.ownedWeighted - item.againstWeighted;
          const netAgainst = item.againstWeighted - item.ownedWeighted;
          return {...item,netFor,netAgainst};
        });

        const important = all
          .filter(item=>item.owned.length)
          .sort((a,b)=>b.netFor-a.netFor || b.ownedWeighted-a.ownedWeighted || b.ownedRaw-a.ownedRaw)
          .slice(0,5);

        const villains = all
          .filter(item=>item.against.length && item.netAgainst > .05)
          .sort((a,b)=>b.netAgainst-a.netAgainst || b.againstWeighted-a.againstWeighted || b.againstRaw-a.againstRaw)
          .slice(0,5);

        return {ctx,important,villains,message:""};
      } catch (error){
        return {ctx,important:[],villains:[],message:"Weekly player projections are temporarily unavailable."};
      }
    })();

    weeklyPulseCache.set(key,promise);
    return promise;
  }

  function findImpactSection(){
    const card = document.querySelector(".impact-player");
    if (card){
      const section = card.closest("section,.section,.panel,.card,[class*='impact']");
      if (section && section !== card) return section;
      return card.parentElement;
    }
    const headings = [...document.querySelectorAll("h2,h3,h4,.section-title,.card-title,strong")];
    const heading = headings.find(node=>/impact|player.*watch|watch.*player/i.test(String(node.textContent || "")));
    return heading?.closest("section,.section,.panel,.card") || null;
  }

  function photoMarkup(item){
    const player = item.record || {};
    const name = player.full_name || [player.first_name,player.last_name].filter(Boolean).join(" ") || "NFL Player";
    const img = item.id ? `<img src="https://sleepercdn.com/content/nfl/players/${encodeURIComponent(item.id)}.jpg" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : "";
    return `<div class="weekly-pulse-photo" aria-hidden="true"><span>${escapeHtml(initials(name))}</span>${img}</div>`;
  }

  function compactLeagueNames(entries,lead){
    return entries.slice(0,3).map(entry=>`<span class="weekly-pulse-chip ${lead === "against" ? "danger" : "good"}">${lead === "against" ? "vs " : ""}${escapeHtml(entry.leagueName)}</span>`).join("");
  }

  function playerPulseCard(item,type,index){
    const player = item.record || {};
    const name = player.full_name || [player.first_name,player.last_name].filter(Boolean).join(" ") || "NFL Player";
    const meta = [player.position,player.team].filter(Boolean).join(" · ");
    const isVillain = type === "villain";
    const score = isVillain ? item.netAgainst : item.netFor;
    const offset = isVillain ? item.ownedRaw : item.againstRaw;
    const primaryEntries = isVillain ? item.against : item.owned;
    const offsetEntries = isVillain ? item.owned : item.against;
    const title = isVillain ? "Net threat" : "Importance";
    const detail = isVillain
      ? `Against you ${item.againstRaw.toFixed(1)}${item.ownedRaw > 0 ? ` · For you ${item.ownedRaw.toFixed(1)}` : ""}`
      : `For you ${item.ownedRaw.toFixed(1)}${item.againstRaw > 0 ? ` · Against you ${item.againstRaw.toFixed(1)}` : ""}`;
    const note = offset > 0
      ? `<div class="weekly-pulse-offset">${isVillain ? "Also on your side" : "Hedged against you"}: ${compactLeagueNames(offsetEntries,isVillain ? "owned" : "against")}</div>`
      : "";

    return `<article class="weekly-pulse-player ${isVillain ? "villain" : "important"}" data-player-id="${escapeHtml(item.id)}">
      <div class="weekly-pulse-rank">${index+1}</div>
      ${photoMarkup(item)}
      <div class="weekly-pulse-copy">
        <div class="weekly-pulse-name">${escapeHtml(name)}</div>
        <div class="weekly-pulse-meta">${escapeHtml(meta || "NFL")}</div>
        <div class="weekly-pulse-leagues">${compactLeagueNames(primaryEntries,isVillain ? "against" : "owned")}</div>
        ${note}
      </div>
      <div class="weekly-pulse-score" title="League-scoring projection adjusted for matchup leverage, minus exposure on the opposite side.">
        <span>${title}</span>
        <strong>${Math.max(0,score).toFixed(1)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
    </article>`;
  }

  function ensurePulseStyles(){
    if (document.getElementById("weekly-player-pulse-styles")) return;
    const style = document.createElement("style");
    style.id = "weekly-player-pulse-styles";
    style.textContent = `
      #weeklyPlayerPulse{margin:0 0 16px;padding:15px;border:1px solid rgba(132,186,215,.28);border-radius:17px;background:rgba(46,40,35,.9);color:var(--mint,#DBFFD6);box-shadow:0 16px 36px rgba(46,40,35,.18)}
      .weekly-pulse-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:11px}
      .weekly-pulse-title{font-size:1rem;font-weight:1000;color:var(--mint,#DBFFD6)}
      .weekly-pulse-sub{margin-top:3px;color:var(--muted,rgba(219,255,214,.76));font-size:.7rem;line-height:1.35}
      .weekly-pulse-badge{flex:0 0 auto;padding:5px 8px;border-radius:999px;border:1px solid rgba(216,169,74,.38);background:rgba(216,169,74,.09);color:var(--gold,#D8A94A);font-size:.61rem;font-weight:1000;text-transform:uppercase;letter-spacing:.055em}
      .weekly-pulse-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:12px}
      .weekly-pulse-col{min-width:0;padding:10px;border:1px solid rgba(132,186,215,.17);border-radius:13px;background:rgba(52,45,39,.55)}
      .weekly-pulse-col.villains{border-color:rgba(231,128,128,.22);background:rgba(126,49,53,.08)}
      .weekly-pulse-col-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:.73rem;font-weight:1000;text-transform:uppercase;letter-spacing:.055em;color:var(--sky,#84BAD7)}
      .weekly-pulse-col.villains .weekly-pulse-col-title{color:#F0A0A0}
      .weekly-pulse-col-title small{font-size:.56rem;color:var(--muted,rgba(219,255,214,.68));letter-spacing:0;text-transform:none;font-weight:800}
      .weekly-pulse-list{display:grid;gap:7px}
      .weekly-pulse-player{display:grid;grid-template-columns:20px 42px minmax(0,1fr) auto;gap:8px;align-items:center;min-width:0;padding:8px;border:1px solid rgba(132,186,215,.14);border-radius:11px;background:rgba(46,40,35,.72)}
      .weekly-pulse-player.villain{border-color:rgba(231,128,128,.16)}
      .weekly-pulse-rank{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(132,186,215,.12);color:var(--sky,#84BAD7);font-size:.58rem;font-weight:1000}
      .weekly-pulse-player.villain .weekly-pulse-rank{background:rgba(231,128,128,.12);color:#F0A0A0}
      .weekly-pulse-photo{position:relative;display:grid;place-items:center;width:42px;height:42px;border-radius:10px;overflow:hidden;background:rgba(219,255,214,.11);border:1px solid rgba(219,255,214,.18);color:var(--mint,#DBFFD6);font-size:.64rem;font-weight:1000}
      .weekly-pulse-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;background:#fff}
      .weekly-pulse-copy{min-width:0}
      .weekly-pulse-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mint,#DBFFD6);font-size:.75rem;font-weight:1000}
      .weekly-pulse-meta{margin-top:1px;color:var(--muted,rgba(219,255,214,.7));font-size:.57rem;font-weight:800}
      .weekly-pulse-leagues,.weekly-pulse-offset{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:4px}
      .weekly-pulse-offset{color:var(--muted,rgba(219,255,214,.68));font-size:.54rem}
      .weekly-pulse-chip{display:inline-flex;align-items:center;max-width:155px;padding:2px 5px;border-radius:999px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.5rem;font-weight:900;border:1px solid rgba(169,230,165,.24);background:rgba(169,230,165,.08);color:#B9F0B5}
      .weekly-pulse-chip.danger{border-color:rgba(231,128,128,.25);background:rgba(231,128,128,.08);color:#F0A0A0}
      .weekly-pulse-score{min-width:86px;text-align:right}
      .weekly-pulse-score span{display:block;color:var(--muted,rgba(219,255,214,.68));font-size:.49rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
      .weekly-pulse-score strong{display:block;margin-top:1px;color:var(--gold,#D8A94A);font-size:1.05rem;line-height:1;font-weight:1000}
      .weekly-pulse-player.villain .weekly-pulse-score strong{color:#F0A0A0}
      .weekly-pulse-score small{display:block;margin-top:3px;max-width:116px;color:var(--muted,rgba(219,255,214,.68));font-size:.49rem;line-height:1.25}
      .weekly-pulse-empty{padding:12px 8px;text-align:center;color:var(--muted,rgba(219,255,214,.68));font-size:.66rem;line-height:1.4}
      @media(max-width:900px){.weekly-pulse-grid{grid-template-columns:1fr}.weekly-pulse-player{grid-template-columns:20px 42px minmax(0,1fr) auto}}
      @media(max-width:520px){#weeklyPlayerPulse{padding:12px}.weekly-pulse-player{grid-template-columns:18px 38px minmax(0,1fr)}.weekly-pulse-photo{width:38px;height:38px}.weekly-pulse-score{grid-column:3;text-align:left;display:flex;align-items:baseline;gap:6px;min-width:0}.weekly-pulse-score span{display:inline}.weekly-pulse-score strong{display:inline}.weekly-pulse-score small{display:inline;max-width:none}}
    `;
    document.head.appendChild(style);
  }

  let lastPulseKey = "";
  let pulseRendering = false;
  async function renderWeeklyPulse(){
    const ctx = currentContext();
    if (!ctx.username) return;
    const key = `${ctx.username.toLowerCase()}|${ctx.season}|${ctx.week}`;
    const existing = document.getElementById("weeklyPlayerPulse");
    const impactSection = findImpactSection();
    if (existing && impactSection && existing.nextElementSibling !== impactSection){
      impactSection.parentNode?.insertBefore(existing,impactSection);
    }
    if (existing && lastPulseKey === key) return;
    if (pulseRendering) return;
    pulseRendering = true;
    try {
      ensurePulseStyles();
      const data = await getWeeklyPulseData();
      const host = existing || document.createElement("section");
      host.id = "weeklyPlayerPulse";
      host.setAttribute("aria-label",`Week ${data.ctx.week} player importance`);

      const importantMarkup = data.important.length
        ? data.important.map((item,index)=>playerPulseCard(item,"important",index)).join("")
        : `<div class="weekly-pulse-empty">${escapeHtml(data.message || "No projected starters found yet for your teams.")}</div>`;
      const villainMarkup = data.villains.length
        ? data.villains.map((item,index)=>playerPulseCard(item,"villain",index)).join("")
        : `<div class="weekly-pulse-empty">${escapeHtml(data.message || "No net villains found yet — your overlap offsets the opposing exposure.")}</div>`;

      host.innerHTML = `<div class="weekly-pulse-head">
        <div><div class="weekly-pulse-title">Your Week ${data.ctx.week} Player Pulse</div><div class="weekly-pulse-sub">Top starters across all your leagues, using each league’s scoring. Close / high-stakes matchups get a small leverage boost, and players you face elsewhere offset their value.</div></div>
        <div class="weekly-pulse-badge">Cross-league</div>
      </div>
      <div class="weekly-pulse-grid">
        <div class="weekly-pulse-col">
          <div class="weekly-pulse-col-title"><span>Most important players</span><small>Top 5</small></div>
          <div class="weekly-pulse-list">${importantMarkup}</div>
        </div>
        <div class="weekly-pulse-col villains">
          <div class="weekly-pulse-col-title"><span>Villains of the week</span><small>Net threats</small></div>
          <div class="weekly-pulse-list">${villainMarkup}</div>
        </div>
      </div>`;

      if (!existing){
        const target = impactSection;
        if (target?.parentNode) target.parentNode.insertBefore(host,target);
        else {
          const fallback = document.querySelector("main .dashboard, main, .shell") || document.body;
          fallback.appendChild(host);
        }
      }
      lastPulseKey = key;
    } finally {
      pulseRendering = false;
    }
  }

  let timer = 0;
  function scheduleEnhance(){
    clearTimeout(timer);
    timer = setTimeout(()=>{
      renamePage();
      document.querySelectorAll(".impact-player[data-gameday-enhanced='unmatched']").forEach(card=>card.removeAttribute("data-gameday-enhanced"));
      enhancePlayers();
      renderWeeklyPulse();
    },100);
  }

  function resetForContextChange(){
    document.querySelectorAll(".impact-player").forEach(card=>card.removeAttribute("data-gameday-enhanced"));
    lastPulseKey = "";
    const pulse = document.getElementById("weeklyPlayerPulse");
    if (pulse) pulse.remove();
    scheduleEnhance();
  }

  function init(){
    renamePage();
    ensurePulseStyles();
    enhancePlayers();
    renderWeeklyPulse();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("change", event=>{
      if (event.target?.matches?.("#week,#weekSelect,#week-selector,#season,#seasonSelect,#username,#sleeperUsername,input[name='username'],select[name='season'],select[name='week']")) resetForContextChange();
    });
    document.addEventListener("input", event=>{
      if (event.target?.matches?.("#username,#sleeperUsername,input[name='username']")){
        clearTimeout(timer);
        timer = setTimeout(resetForContextChange,350);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();