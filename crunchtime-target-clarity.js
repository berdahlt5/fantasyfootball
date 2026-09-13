(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html") return;

  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const f = value => n(value).toFixed(1);

  function updateCard(card){
    const data = card?.__ctPlannerData;
    const head = card?.querySelector?.(".ct-plan-head-simple > div");
    if (!data || !head || n(data.target) <= 0) return;

    const label = head.querySelector("span");
    const title = head.querySelector("strong");
    const detail = head.querySelector("small");
    if (!label || !title || !detail) return;

    const opponentActive = Array.isArray(data.theirs) && data.theirs.length > 0;
    if (opponentActive){
      const projectedFinal = n(data.oppScore) + n(data.oppProjectedLeft);
      label.textContent = "Projected target";
      title.textContent = `Need ${f(data.target)} pts to beat projected final`;
      detail.textContent = `Opponent: ${f(data.oppScore)} now + ${f(data.oppProjectedLeft)} projected = ${f(projectedFinal)} projected final`;
      head.closest(".ct-points-planner")?.setAttribute("data-target-basis","projected");
    } else {
      label.textContent = "Win target";
      title.textContent = `Need ${f(data.target)} pts to win`;
      detail.textContent = `Opponent is finished at ${f(data.oppScore)}.`;
      head.closest(".ct-points-planner")?.setAttribute("data-target-basis","final");
    }
  }

  function apply(){
    document.querySelectorAll("#crunchTimeCommandCenter .ct-matchup-card").forEach(updateCard);
  }

  let queued = false;
  function queue(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(()=>{ queued=false; apply(); });
  }

  const observer = new MutationObserver(mutations=>{
    if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length)) queue();
  });

  function init(){
    observer.observe(document.body,{childList:true,subtree:true});
    queue();
    setInterval(queue,5000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
