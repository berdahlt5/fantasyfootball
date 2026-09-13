(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const API = "https://api.sleeper.app/v1";
  let directoryPromise = null;
  let scheduled = false;

  function normalizeName(value){
    return String(value || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  async function json(url){
    const response = await fetch(url, {cache:"force-cache"});
    if (!response.ok) throw new Error(`Sleeper request failed (${response.status})`);
    return response.json();
  }

  function getDirectory(){
    if (directoryPromise) return directoryPromise;
    directoryPromise = json(`${API}/players/nfl`).then(data => {
      const byName = new Map();
      for (const [id, player] of Object.entries(data || {})){
        if (!player) continue;
        const record = {...player, player_id:String(id)};
        const names = [player.full_name, [player.first_name,player.last_name].filter(Boolean).join(" ")];
        for (const name of names){
          const key = normalizeName(name);
          if (key && !byName.has(key)) byName.set(key,record);
        }
      }
      return byName;
    }).catch(()=>new Map());
    return directoryPromise;
  }

  function initials(name){
    return String(name || "")
      .trim()
      .split(/\s+/)
      .slice(0,2)
      .map(part=>part[0] || "")
      .join("")
      .toUpperCase() || "NFL";
  }

  function playerName(card){
    const direct = card.querySelector(".impact-player-main > span:first-child, .impact-player-name, .player-name, strong");
    if (direct?.textContent?.trim()) return direct.textContent.trim();
    const text = String(card.textContent || "").split(/\n|·|•|\|| — | – | - /)[0]?.trim();
    return text || "NFL Player";
  }

  function photoUrl(id, variant="thumb"){
    return variant === "thumb"
      ? `https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(id)}.jpg`
      : `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(id)}.jpg`;
  }

  function ensureHeadshot(card, record, name){
    if (!record?.player_id) return;
    let photo = card.querySelector(":scope > .gameday-player-photo");
    if (!photo){
      photo = document.createElement("div");
      photo.className = "gameday-player-photo";
      const fallback = document.createElement("span");
      fallback.textContent = initials(name);
      photo.appendChild(fallback);
      card.prepend(photo);
    }

    let img = photo.querySelector("img");
    if (img && img.dataset.playerId === record.player_id) return;
    if (img) img.remove();

    img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.dataset.playerId = record.player_id;
    img.dataset.fallbackTried = "0";
    img.src = photoUrl(record.player_id,"thumb");
    img.addEventListener("load",()=>{
      card.classList.add("has-player-headshot");
      photo.classList.add("has-image");
    });
    img.addEventListener("error",()=>{
      if (img.dataset.fallbackTried === "0"){
        img.dataset.fallbackTried = "1";
        img.src = photoUrl(record.player_id,"full");
      } else {
        img.remove();
        card.classList.remove("has-player-headshot");
        photo.classList.remove("has-image");
      }
    });
    photo.appendChild(img);
  }

  async function enhancePlayerRows(){
    const cards = [...document.querySelectorAll(".impact-player")];
    if (!cards.length) return;
    const directory = await getDirectory();
    for (const card of cards){
      if (!card.isConnected) continue;
      const name = playerName(card);
      const record = directory.get(normalizeName(name));
      if (!record) continue;
      card.dataset.playerId = record.player_id;
      ensureHeadshot(card,record,name);
    }
  }

  function enhanceScoreboard(){
    for (const card of document.querySelectorAll(".live-score-card")){
      const rows = [...card.querySelectorAll(":scope > .live-team-row")];
      rows.forEach((row,index)=>{
        row.classList.toggle("is-user-team",index===0);
        row.classList.toggle("is-opponent-team",index===1);
      });
      if (card.classList.contains("leading")) card.dataset.scoreState = "leading";
      else if (card.classList.contains("trailing")) card.dataset.scoreState = "trailing";
      else if (card.classList.contains("tied")) card.dataset.scoreState = "tied";
      else card.dataset.scoreState = "neutral";
    }
  }

  async function enhance(){
    scheduled = false;
    enhanceScoreboard();
    await enhancePlayerRows();
  }

  function schedule(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init(){
    schedule();
    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length)) schedule();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
