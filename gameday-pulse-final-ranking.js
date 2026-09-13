(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  let queued = false;
  const TEAM_ALIASES = {JAC:"JAX",WSH:"WAS",OAK:"LV",SD:"LAC",STL:"LAR"};

  function normalizeTeam(value){
    const team = String(value || "").trim().toUpperCase();
    return TEAM_ALIASES[team] || team;
  }

  function games(){
    try {
      return typeof state !== "undefined" && Array.isArray(state.games) ? state.games : [];
    } catch (_) { return []; }
  }

  function teamFromCard(card){
    const meta = String(card.querySelector(".game-day-pulse-meta")?.textContent || "");
    const parts = meta.split(/[·|]/).map(part=>part.trim()).filter(Boolean);
    if (parts.length > 1) return normalizeTeam(parts[parts.length-1]);
    const match = meta.toUpperCase().match(/\b(ARI|ATL|BAL|BUF|CAR|CHI|CIN|CLE|DAL|DEN|DET|GB|HOU|IND|JAX|JAC|KC|LV|LAC|LAR|MIA|MIN|NE|NO|NYG|NYJ|PHI|PIT|SEA|SF|TB|TEN|WAS|WSH)\b/);
    return normalizeTeam(match?.[1] || "");
  }

  function gameForTeam(team){
    const wanted = normalizeTeam(team);
    if (!wanted) return null;
    return games().find(game=>
      normalizeTeam(game?.away?.abbreviation) === wanted ||
      normalizeTeam(game?.home?.abbreviation) === wanted
    ) || null;
  }

  function isFinal(game){
    if (!game) return false;
    if (Boolean(game?.completed) || Boolean(game?.status?.completed) || Boolean(game?.status?.type?.completed)) return true;
    const stateValue = String(game?.statusState || game?.status?.type?.state || "").toLowerCase();
    const nameValue = String(game?.status?.type?.name || game?.status?.type?.description || game?.status || "").toLowerCase();
    return stateValue === "post" || /\b(final|post|completed)\b/.test(nameValue);
  }

  function numberFrom(card,selector){
    const value = Number(card.querySelector(selector)?.textContent);
    return Number.isFinite(value) ? value : -Infinity;
  }

  function projected(card){
    return numberFrom(card,".game-day-pulse-score > strong");
  }

  function actual(card){
    return numberFrom(card,".game-day-pulse-actual strong");
  }

  function rankingValue(card){
    const game = gameForTeam(teamFromCard(card));
    const finished = isFinal(game);
    const actualValue = actual(card);
    const projectedValue = projected(card);

    if (finished && Number.isFinite(actualValue) && actualValue !== -Infinity){
      card.dataset.pulseRankSource = "actual";
      card.dataset.pulseRankValue = actualValue.toFixed(2);
      return actualValue;
    }

    card.dataset.pulseRankSource = "projection";
    if (Number.isFinite(projectedValue) && projectedValue !== -Infinity) card.dataset.pulseRankValue = projectedValue.toFixed(2);
    return projectedValue;
  }

  function sortLists(){
    queued = false;
    const host = document.getElementById("gameDayPlayerPulse");
    if (!host) return;

    for (const list of host.querySelectorAll(".game-day-pulse-list")){
      const cards = [...list.querySelectorAll(":scope > .game-day-pulse-card")];
      if (!cards.length) continue;

      const sorted = [...cards].sort((a,b)=>{
        const diff = rankingValue(b) - rankingValue(a);
        if (Number.isFinite(diff) && diff !== 0) return diff;
        const aName = a.querySelector(".game-day-pulse-name")?.textContent || "";
        const bName = b.querySelector(".game-day-pulse-name")?.textContent || "";
        return aName.localeCompare(bName);
      });

      if (!cards.every((card,index)=>card === sorted[index])){
        for (const card of sorted) list.appendChild(card);
      }

      sorted.forEach((card,index)=>{
        /* Keep the full candidate pool in the DOM so a finished player's
           Actual can move them into or out of the true top five. */
        card.style.display = index < 5 ? "" : "none";
        card.setAttribute("aria-hidden", index < 5 ? "false" : "true");
        const rank = card.querySelector(".game-day-pulse-rank");
        const next = String(index + 1);
        if (rank && rank.textContent !== next) rank.textContent = next;
      });
    }
  }

  function queueSort(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(sortLists);
  }

  function init(){
    queueSort();

    const observer = new MutationObserver(mutations=>{
      if (mutations.some(mutation=>
        mutation.type === "characterData" ||
        mutation.addedNodes.length ||
        mutation.removedNodes.length
      )) queueSort();
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});

    /* Game status is maintained by the Hub separately from the Pulse DOM, so
       periodically re-check it. This is also a fallback if an upstream status
       update does not cause a DOM mutation. */
    setInterval(queueSort,5000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
