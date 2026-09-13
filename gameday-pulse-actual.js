(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const API = "https://api.sleeper.app/v1";
  let directoryPromise = null;
  let latestKey = "";
  let latestPoints = new Map();
  let lastFetchAt = 0;
  let scheduled = false;
  let refreshing = false;

  const escNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

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
    const weekMatch = weekRaw.match(/\d+/);
    const week = weekMatch ? Math.max(1,Math.min(18,Number(weekMatch[0]))) : 1;
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
      const byName = new Map();
      for (const [id,player] of Object.entries(data || {})){
        if (!player) continue;
        const names = [player.full_name,[player.first_name,player.last_name].filter(Boolean).join(" ")];
        for (const name of names){
          const key = normalizeName(name);
          if (key && !byName.has(key)) byName.set(key,String(id));
        }
      }
      return byName;
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

  function addActual(map,id,side,value){
    if (!map.has(id)) map.set(id,{ownedActual:0,againstActual:0,ownedInstances:0,againstInstances:0});
    const item = map.get(id);
    if (side === "owned"){
      item.ownedActual += escNumber(value);
      item.ownedInstances += 1;
    } else {
      item.againstActual += escNumber(value);
      item.againstInstances += 1;
    }
  }

  async function fetchActualPoints(ctx){
    if (!ctx.username) return new Map();

    const user = await json(`${API}/user/${encodeURIComponent(ctx.username)}`);
    if (!user?.user_id) return new Map();
    const leagues = await json(`${API}/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${encodeURIComponent(ctx.season)}`);
    const points = new Map();

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
        const myPlayerPoints = myMatchup?.players_points || {};
        const oppPlayerPoints = opponentMatchup?.players_points || {};

        for (const id of myStarters) addActual(points,id,"owned",myPlayerPoints?.[id] ?? 0);
        for (const id of oppStarters) addActual(points,id,"against",oppPlayerPoints?.[id] ?? 0);
      } catch (_) {}
    }));

    return points;
  }

  function idFromCard(card,directory){
    const image = card.querySelector(".game-day-pulse-photo img");
    const src = image?.getAttribute("src") || "";
    const match = src.match(/\/players\/(?:thumb\/)?([^/?#.]+)\.jpg/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
    const name = card.querySelector(".game-day-pulse-name")?.textContent || "";
    return directory.get(normalizeName(name)) || "";
  }

  function setActual(card,value,instances){
    const score = card.querySelector(".game-day-pulse-score");
    if (!score) return;
    let row = score.querySelector(".game-day-pulse-actual");
    if (!row){
      row = document.createElement("div");
      row.className = "game-day-pulse-actual";
      row.innerHTML = `<span>Actual</span><strong>0.0</strong>`;
      score.appendChild(row);
    }
    const strong = row.querySelector("strong");
    const text = escNumber(value).toFixed(1);
    if (strong && strong.textContent !== text) strong.textContent = text;
    row.title = instances>1
      ? `Live actual total across ${instances} league instances`
      : "Live actual fantasy points";
    card.classList.add("has-actual-points");
  }

  function projectedPoints(card){
    const strong = card.querySelector(".game-day-pulse-score > strong");
    const value = Number(strong?.textContent);
    return Number.isFinite(value) ? value : -Infinity;
  }

  function sortPulseLists(){
    for (const list of document.querySelectorAll("#gameDayPlayerPulse .game-day-pulse-list")){
      const cards = [...list.querySelectorAll(":scope > .game-day-pulse-card")];
      if (cards.length < 2) {
        cards.forEach((card,index)=>{
          const rank = card.querySelector(".game-day-pulse-rank");
          if (rank && rank.textContent !== String(index+1)) rank.textContent = String(index+1);
        });
        continue;
      }

      const sorted = [...cards].sort((a,b)=>{
        const diff = projectedPoints(b)-projectedPoints(a);
        if (diff !== 0) return diff;
        const aName = a.querySelector(".game-day-pulse-name")?.textContent || "";
        const bName = b.querySelector(".game-day-pulse-name")?.textContent || "";
        return aName.localeCompare(bName);
      });

      const alreadySorted = cards.every((card,index)=>card===sorted[index]);
      if (!alreadySorted) sorted.forEach(card=>list.appendChild(card));

      sorted.forEach((card,index)=>{
        const rank = card.querySelector(".game-day-pulse-rank");
        if (rank && rank.textContent !== String(index+1)) rank.textContent = String(index+1);
      });
    }
  }

  async function applyActualPoints(){
    scheduled = false;
    const cards = [...document.querySelectorAll("#gameDayPlayerPulse .game-day-pulse-card")];
    if (!cards.length) return;

    /* The visible ordering now follows the same projected-points number shown
       on each card for every Player Pulse window. */
    sortPulseLists();

    const directory = await getDirectory();
    for (const card of cards){
      if (!card.isConnected) continue;
      const id = idFromCard(card,directory);
      if (!id) continue;
      const actual = latestPoints.get(String(id)) || {ownedActual:0,againstActual:0,ownedInstances:0,againstInstances:0};
      const villain = card.classList.contains("villain");
      setActual(
        card,
        villain ? actual.againstActual : actual.ownedActual,
        villain ? actual.againstInstances : actual.ownedInstances
      );
    }
  }

  function scheduleApply(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyActualPoints);
  }

  async function refresh(force=false){
    if (refreshing) return;
    const ctx = context();
    if (!ctx.username) return;
    const now = Date.now();
    if (!force && latestKey===ctx.key && now-lastFetchAt<15000){
      scheduleApply();
      return;
    }
    refreshing = true;
    try {
      const points = await fetchActualPoints(ctx);
      if (context().key!==ctx.key) return;
      latestPoints = points;
      latestKey = ctx.key;
      lastFetchAt = Date.now();
      scheduleApply();
    } catch (_) {
      scheduleApply();
    } finally {
      refreshing = false;
    }
  }

  function init(){
    refresh(true);

    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length)) scheduleApply();
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

    setInterval(()=>refresh(true),60000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
