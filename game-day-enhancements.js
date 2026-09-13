(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const HUB_NAME = "Game Day Hub";

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
    directoryPromise = sleeperJSON("https://api.sleeper.app/v1/players/nfl")
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

  const opponentLeagueCache = new Map();
  async function getOpponentLeagueContext(){
    const ctx = currentContext();
    if (!ctx.username) return {playerLeagues:new Map(), leagueNames:[]};
    const key = `${ctx.username.toLowerCase()}|${ctx.season}|${ctx.week}`;
    if (opponentLeagueCache.has(key)) return opponentLeagueCache.get(key);

    const promise = (async()=>{
      try {
        const user = await sleeperJSON(`https://api.sleeper.app/v1/user/${encodeURIComponent(ctx.username)}`);
        if (!user?.user_id) return {playerLeagues:new Map(), leagueNames:[]};
        const leagues = await sleeperJSON(`https://api.sleeper.app/v1/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${encodeURIComponent(ctx.season)}`);
        const playerLeagues = new Map();
        const leagueNames = (leagues || []).map(l=>String(l?.name || "").trim()).filter(Boolean);

        await Promise.all((leagues || []).map(async league=>{
          if (!league?.league_id) return;
          try {
            const [rosters,matchups] = await Promise.all([
              sleeperJSON(`https://api.sleeper.app/v1/league/${encodeURIComponent(league.league_id)}/rosters`),
              sleeperJSON(`https://api.sleeper.app/v1/league/${encodeURIComponent(league.league_id)}/matchups/${ctx.week}`)
            ]);
            const mine = (rosters || []).find(r=>String(r?.owner_id) === String(user.user_id));
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
    const cards = [...document.querySelectorAll(".impact-player:not([data-gameday-enhanced='processing'])")];
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

  let timer = 0;
  function scheduleEnhance(){
    clearTimeout(timer);
    timer = setTimeout(()=>{
      renamePage();
      document.querySelectorAll(".impact-player[data-gameday-enhanced='unmatched']").forEach(card=>card.removeAttribute("data-gameday-enhanced"));
      enhancePlayers();
    },100);
  }

  function init(){
    renamePage();
    enhancePlayers();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("change", event=>{
      if (event.target?.matches?.("#week,#weekSelect,#week-selector,#season,#seasonSelect,#username,#sleeperUsername")){
        document.querySelectorAll(".impact-player").forEach(card=>card.removeAttribute("data-gameday-enhanced"));
        scheduleEnhance();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();