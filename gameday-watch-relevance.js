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
    } catch (_) {
      return 0;
    }
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

  function priorityLeague(exposure){
    try { return Boolean(isPriorityLeagueName(exposure?.leagueName)); }
    catch (_) { return false; }
  }

  function exposureFactor(exposure, side){
    if (exposure?.isBestBall) return side === "mine" ? .35 : .25;
    return side === "mine" ? 1 : .72;
  }

  function footprint(game){
    const mine = scheduleGameStarterExposures(game,false) || [];
    const opponents = scheduleGameStarterExposures(game,true) || [];
    const all = [...mine,...opponents];
    const skillMine = mine.filter(isSkill);
    const skillOpp = opponents.filter(isSkill);
    const skillAll = [...skillMine,...skillOpp];

    const uniquePlayers = new Set(all.map(item=>String(item?.playerId || "")).filter(Boolean)).size;
    const uniqueSkillPlayers = new Set(skillAll.map(item=>String(item?.playerId || "")).filter(Boolean)).size;
    const instances = all.length;
    const skillInstances = skillAll.length;
    const repeatedSkillInstances = Math.max(0,skillInstances-uniqueSkillPlayers);
    const projectedPoints = all.reduce((sum,item)=>sum+safeProjection(item),0);
    const projectedSkillPoints = skillAll.reduce((sum,item)=>sum+safeProjection(item),0);

    return {
      mine,opponents,skillMine,skillOpp,
      uniquePlayers,uniqueSkillPlayers,instances,skillInstances,repeatedSkillInstances,
      projectedPoints,projectedSkillPoints
    };
  }

  function relevanceScore(game,base){
    const fp = footprint(game);
    let score = 0;

    /* Every lineup instance contributes separately. Projection is deliberately
       a major part of the score, so a player used in several leagues matters
       several times instead of being collapsed to one name. */
    for (const exposure of fp.skillMine){
      const factor = exposureFactor(exposure,"mine");
      const projection = safeProjection(exposure);
      score += (7 + projection*1.05 + (priorityLeague(exposure)?5:0))*factor;
    }
    for (const exposure of fp.skillOpp){
      const factor = exposureFactor(exposure,"opponent");
      const projection = safeProjection(exposure);
      score += (2.5 + projection*.38 + (priorityLeague(exposure)?2.5:0))*factor;
    }

    for (const exposure of fp.mine.filter(isSpecial)){
      score += (1 + safeProjection(exposure)*.12 + (priorityLeague(exposure)?.5:0))*(exposure?.isBestBall?.3:1);
    }
    for (const exposure of fp.opponents.filter(isSpecial)){
      score += (.2 + safeProjection(exposure)*.04)*(exposure?.isBestBall?.3:1);
    }

    /* Breadth and repeat exposure both matter, but are smaller than the actual
       projected-points contribution above. */
    score += Math.max(0,fp.uniqueSkillPlayers-1)*1.4;
    score += fp.repeatedSkillInstances*2.0;

    if (base?.favorite) score += 100;
    if (Array.isArray(base?.crunch) && base.crunch.length){
      const strongest = Math.max(...base.crunch.map(item=>Number(item?.weight || 0)));
      if (Number.isFinite(strongest)) score += strongest*2.25;
      if (base.crunch.some(item=>item?.must)) score += 45;
    }

    const completed = Boolean(game?.completed) || String(game?.statusState || "").toLowerCase() === "post";
    if (completed) score = -100;

    return {score,...fp};
  }

  function installPatch(){
    if (patched) return true;
    if (typeof watchAnalysis !== "function" || typeof scheduleGameStarterExposures !== "function") return false;

    const baseWatchAnalysis = watchAnalysis;
    watchAnalysis = function(game){
      const base = baseWatchAnalysis(game);
      const rel = relevanceScore(game,base);
      return {
        ...base,
        score:rel.score,
        uniquePlayerCount:rel.uniquePlayers,
        instanceCount:rel.instances,
        projectedInstancePoints:rel.projectedPoints,
        uniqueSkillPlayerCount:rel.uniqueSkillPlayers,
        skillInstanceCount:rel.skillInstances,
        projectedSkillInstancePoints:rel.projectedSkillPoints
      };
    };
    watchAnalysis.__instanceProjectionPatch = true;
    patched = true;

    /* Re-render once so existing watch-window ordering uses the new score. */
    setTimeout(()=>{
      try { if (typeof renderAll === "function") renderAll(); }
      catch (_) {}
      queueDecorate();
    },0);
    return true;
  }

  function gameFromCard(card){
    const text = String(card.querySelector(".watch-teams")?.textContent || "").trim();
    const match = text.match(/^([A-Z]{2,3})\s*@\s*([A-Z]{2,3})$/i);
    if (!match) return null;
    const away = match[1].toUpperCase();
    const home = match[2].toUpperCase();
    try {
      return (state.games || []).find(game=>
        String(game?.away?.abbreviation || "").toUpperCase()===away &&
        String(game?.home?.abbreviation || "").toUpperCase()===home
      ) || null;
    } catch (_) {
      return null;
    }
  }

  function decorateCards(){
    decorateQueued = false;
    if (!patched) installPatch();
    if (!patched) return;

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
        if (counts?.parentNode) counts.insertAdjacentElement("afterend",row);
        else card.querySelector(".watch-card-main")?.appendChild(row);
      }

      const html = `<span><strong>${unique}</strong> unique</span><span><strong>${instances}</strong> instance${instances===1?"":"s"}</span><span class="projected"><strong>${projected.toFixed(1)}</strong> proj pts</span>`;
      if (row.innerHTML !== html) row.innerHTML = html;
      row.title = "Unique starters in this NFL game · total lineup occurrences across your selected leagues · summed league-specific projected fantasy points";
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
