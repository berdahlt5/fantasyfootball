(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const HUB_NAME = "Game Day Hub";
  const TEAM_NAMES = {
    ARI:"Arizona Cardinals",ATL:"Atlanta Falcons",BAL:"Baltimore Ravens",BUF:"Buffalo Bills",
    CAR:"Carolina Panthers",CHI:"Chicago Bears",CIN:"Cincinnati Bengals",CLE:"Cleveland Browns",
    DAL:"Dallas Cowboys",DEN:"Denver Broncos",DET:"Detroit Lions",GB:"Green Bay Packers",
    HOU:"Houston Texans",IND:"Indianapolis Colts",JAX:"Jacksonville Jaguars",JAC:"Jacksonville Jaguars",
    KC:"Kansas City Chiefs",LV:"Las Vegas Raiders",LAC:"Los Angeles Chargers",LAR:"Los Angeles Rams",
    MIA:"Miami Dolphins",MIN:"Minnesota Vikings",NE:"New England Patriots",NO:"New Orleans Saints",
    NYG:"New York Giants",NYJ:"New York Jets",PHI:"Philadelphia Eagles",PIT:"Pittsburgh Steelers",
    SEA:"Seattle Seahawks",SF:"San Francisco 49ers",TB:"Tampa Bay Buccaneers",TEN:"Tennessee Titans",
    WAS:"Washington Commanders",WSH:"Washington Commanders"
  };
  const TEAM_CODES = Object.keys(TEAM_NAMES).sort((a,b)=>b.length-a.length);

  function renamePage(){
    const heading = document.querySelector(".brand h1, .topbar h1, h1");
    if (heading && /watch planner|schedule tool/i.test(heading.textContent || "")) heading.textContent = HUB_NAME;
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

  function extractTeamCode(card){
    const direct = card.dataset.team || card.getAttribute("data-team") || card.querySelector("[data-team]")?.getAttribute("data-team");
    if (direct && TEAM_NAMES[String(direct).toUpperCase()]) return String(direct).toUpperCase();
    const text = ` ${card.textContent || ""} `;
    for (const code of TEAM_CODES){
      const re = new RegExp(`(?:^|[^A-Z])${code}(?:$|[^A-Z])`, "i");
      if (re.test(text)) return code;
    }
    return "";
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
        const clean = bit.replace(/\b(QB|RB|WR|TE|K|DEF|DST)\b.*$/i, "").replace(/\b\d+(?:\.\d+)?\s*(?:pts?|points?)\b.*$/i, "").trim();
        if (clean && clean.split(/\s+/).length >= 2 && clean.length <= 45) parts.push(clean);
      }
    }
    return [...new Set(parts)];
  }

  let directoryPromise = null;
  function getDirectory(){
    if (directoryPromise) return directoryPromise;
    directoryPromise = fetch("https://api.sleeper.app/v1/players/nfl", {cache:"force-cache"})
      .then(r=>{ if(!r.ok) throw new Error(`Sleeper players ${r.status}`); return r.json(); })
      .then(data=>{
        const byName = new Map();
        const byId = new Map();
        for (const [id,p] of Object.entries(data || {})){
          if (!p) continue;
          byId.set(String(id), p);
          const names = [p.full_name, [p.first_name,p.last_name].filter(Boolean).join(" ")];
          for (const name of names){
            const key = normalizeName(name);
            if (key && !byName.has(key)) byName.set(key, {...p,player_id:String(id)});
          }
        }
        return {byName,byId};
      })
      .catch(()=>({byName:new Map(),byId:new Map()}));
    return directoryPromise;
  }

  function findRecord(card, directory){
    const id = directPlayerId(card);
    if (id && directory.byId.has(String(id))) return {...directory.byId.get(String(id)),player_id:String(id)};
    for (const candidate of candidateTexts(card)){
      const key = normalizeName(candidate);
      if (directory.byName.has(key)) return directory.byName.get(key);
    }
    return null;
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

  function ensureTeamLine(card, record, fallbackTeam){
    if (card.querySelector(".gameday-player-team")) return;
    const teamCode = String(record?.team || fallbackTeam || "").toUpperCase();
    const teamName = TEAM_NAMES[teamCode] || (teamCode ? teamCode : "NFL");
    const pos = String(record?.position || "").toUpperCase();
    const line = document.createElement("div");
    line.className = "gameday-player-team";
    const team = document.createElement("span");
    team.className = "gameday-team-name";
    team.textContent = teamName;
    line.appendChild(team);
    if (pos){
      const position = document.createElement("span");
      position.className = "gameday-player-position";
      position.textContent = pos;
      line.appendChild(position);
    }
    card.appendChild(line);
  }

  async function enhancePlayers(){
    const cards = [...document.querySelectorAll(".impact-player:not([data-gameday-enhanced])")];
    if (!cards.length) return;
    cards.forEach(card=>card.dataset.gamedayEnhanced = "processing");
    const directory = await getDirectory();
    for (const card of cards){
      if (!card.isConnected) continue;
      const record = findRecord(card,directory);
      const displayName = candidateTexts(card)[0] || record?.full_name || "NFL Player";
      const fallbackTeam = extractTeamCode(card);
      if (record || fallbackTeam){
        card.classList.add("gameday-enhanced-player");
        ensurePhoto(card,record,displayName);
        ensureTeamLine(card,record,fallbackTeam);
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
      enhancePlayers();
    },80);
  }

  function init(){
    renamePage();
    enhancePlayers();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
