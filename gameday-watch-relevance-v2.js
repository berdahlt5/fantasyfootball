(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  let patched = false;
  let decorateQueued = false;

  function safeProjection(exposure){
    try {
      const value = Number(scheduleProjectionForExposure(exposure));
      return Number.isFinite(value) ? Math.max(0,value) : 0;
    } catch (_) { return 0; }
  }

  function isSkill(exposure){
    const position = String(exposure?.position || "").toUpperCase();
    try { return WATCH_SKILL_POSITIONS.has(position); }
    catch (_) { return ["QB","RB","WR","TE"].includes(position); }
  }

  function isSpecial(exposure){
    const position = String(exposure?.position || "").toUpperCase();
    try { return SCHEDULE_SPECIAL_POSITIONS.has(position); }
    catch (_) { return ["K","DEF","DST"].includes(position); }
  }

  function isPriority(exposure){
    try { return Boolean(isPriorityLeagueName(exposure?.leagueName)); }
    catch (_) { return false; }
  }

  function footprint(game){
    const mine = scheduleGameStarterExposures(game,false) || [];
    const opponents = scheduleGameStarterExposures(game,true) || [];
    const all = [...mine,...opponents];
    const skillMine = mine.filter(isSkill);
    const skillOpp = opponents.filter(isSkill);
    const skillAll = [...skillMine,...skillOpp];
    const ids = items => new Set(items.map(item=>String(item?.playerId || "")).filter(Boolean));

    return {
      mine,opponents,all,skillMine,skillOpp,skillAll,
      uniquePlayers:ids(all).size,
      uniqueSkillPlayers:ids(skillAll).size,
      instances:all.length,
      skillInstances:skillAll.length,
      projectedPoints:all.reduce((sum,item)=>sum+safeProjection(item),0),
      projectedSkillPoints:skillAll.reduce((sum,item)=>sum+safeProjection(item),0)
    };
  }

  function relevanceScore(game,base,fp){
    let score = 0;

    for (const exposure of fp.skillMine){
      const factor = exposure?.isBestBall ? .35 : 1;
      score += (7 + safeProjection(exposure)*1.05 + (isPriority(exposure)?5:0))*factor;
    }
    for (const exposure of fp.skillOpp){
      const factor = exposure?.isBestBall ? .25 : .72;
      score += (2.5 + safeProjection(exposure)*.38 + (isPriority(exposure)?2.5:0))*factor;
    }
    for (const exposure of fp.mine.filter(isSpecial)){
      const factor = exposure?.isBestBall ? .3 : 1;
      score += (1 + safeProjection(exposure)*.12 + (isPriority(exposure) ? .5 : 0))*factor;
    }
    for (const exposure of fp.opponents.filter(isSpecial)){
      const factor = exposure?.isBestBall ? .3 : 1;
      score += (.2 + safeProjection(exposure)*.04)*factor;
    }

    /* Reward both variety and repeat exposure. A repeated player still counts
       again because the per-instance loops above score every league occurrence. */
    score += Math.max(0,fp.uniqueSkillPlayers-1)*1.4;
    score += Math.max(0,fp.skillInstances-fp.uniqueSkillPlayers)*2.0;

    if (base?.favorite) score += 100;
    if (Array.isArray(base?.crunch) && base.crunch.length){
      const strongest = Math.max(...base.crunch.map(item=>Number(item?.weight || 0)));
      if (Number.isFinite(strongest)) score += strongest*2.25;
      if (base.crunch.some(item=>item?.must)) score += 45;
    }

    const completed = Boolean(game?.completed) || String(game?.statusState || "").toLowerCase() === "post";
    return completed ? -100 : score;
  }

  function installPatch(){
    if (patched) return true;
    if (typeof watchAnalysis !== "function" || typeof scheduleGameStarterExposures !== "function") return false;

    const baseWatchAnalysis = watchAnalysis;
    watchAnalysis = function(game){
      const base = baseWatchAnalysis(game);
      const fp = footprint(game);
      return {
        ...base,
        score:relevanceScore(game,base,fp),
        uniquePlayerCount:fp.uniquePlayers,
        instanceCount:fp.instances,
        projectedInstancePoints:fp.projectedPoints,
        uniqueSkillPlayerCount:fp.uniqueSkillPlayers,
        skillInstanceCount:fp.skillInstances,
        projectedSkillInstancePoints:fp.projectedSkillPoints
      };
    };
    watchAnalysis.__instanceProjectionPatch = true;
    patched = true;

    setTimeout(()=>{
      try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
      queueDecorate();
    },0);
    return true;
  }

  function gameFromCard(card){
    const text = String(card.querySelector(".watch-teams")?.textContent || "").trim();
    const match = text.match(/^([A-Z]{2,3})\s*@\s*([A-Z]{2,3})$/i);
    if (!match) return null;
    try {
      return (state.games || []).find(game=>
        String(game?.away?.abbreviation || "").toUpperCase()===match[1].toUpperCase() &&
        String(game?.home?.abbreviation || "").toUpperCase()===match[2].toUpperCase()
      ) || null;
    } catch (_) { return null; }
  }

  function decorateCards(){
    decorateQueued = false;
    if (!patched && !installPatch()) return;

    for (const card of document.querySelectorAll(".game-card.watch-card")){
      const game = gameFromCard(card);
      if (!game) continue;
      const analysis = watchAnalysis(game);
      const unique = Number(analysis.uniquePlayerCount || 0);
      const instances = Number(analysis.instanceCount || 0);
      const projected = Number(analysis.projectedInstancePoints || 0);

      let row = card.querySelector(".game-fantasy-footprint");
      if (!row){
        row = document.createElement("div");
        row.className = "game-fantasy-footprint";
        const counts = card.querySelector(".watch-counts");
        if (counts) counts.insertAdjacentElement("afterend",row);
        else card.querySelector(".watch-card-main")?.appendChild(row);
      }

      const html = `<span><strong>${unique}</strong> unique</span><span><strong>${instances}</strong> instance${instances===1?"":"s"}</span><span class="projected"><strong>${projected.toFixed(1)}</strong> proj pts</span>`;
      if (row.innerHTML !== html) row.innerHTML = html;
      row.title = "Distinct starters in this NFL game · total starter occurrences across selected leagues · summed league-specific projected fantasy points";
    }
  }

  function queueDecorate(){
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(decorateCards);
  }

  function init(){
    if (!installPatch()){
      let attempts = 0;
      const timer = setInterval(()=>{
        attempts += 1;
        if (installPatch() || attempts>30) clearInterval(timer);
      },100);
    }
    queueDecorate();
    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length)) queueDecorate();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
