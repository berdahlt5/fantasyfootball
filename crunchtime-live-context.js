(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html") return;

  let queued = false;
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const f = value => n(value).toFixed(1);

  function decoratePlayer(player,row){
    if (!player || !row) return;

    const actual = n(row.actual);
    const projectedLeft = Math.max(0,n(row.expectedRemaining));
    const liveProjectedFinal = actual + projectedLeft;

    const copy = player.querySelector(".ct-plan-player-copy");
    if (copy){
      let metrics = copy.querySelector(".ct-plan-live-metrics");
      if (!metrics){
        metrics = document.createElement("div");
        metrics.className = "ct-plan-live-metrics";
        copy.appendChild(metrics);
      }
      metrics.innerHTML = `<span><b>Actual</b> ${f(actual)}</span><i>·</i><span><b>${row.live?"Live proj":"Projection"}</b> ${f(liveProjectedFinal)}</span>`;
    }

    const valueWrap = player.querySelector(".ct-plan-value-wrap");
    const valueLabel = valueWrap?.querySelector("small");
    if (valueLabel) valueLabel.textContent = "Need +";

    const marker = player.querySelector(".ct-plan-proj-marker b");
    if (marker) marker.textContent = `Proj left +${f(projectedLeft)}`;

    const slider = player.querySelector("[data-ct-plan-slider]");
    if (slider){
      slider.setAttribute("aria-label",`Additional points needed from ${row.name || "player"}`);
      slider.dataset.ctActual = f(actual);
      slider.dataset.ctProjectedFinal = f(liveProjectedFinal);
      slider.dataset.ctProjectedLeft = f(projectedLeft);
    }
  }

  function decorateCard(card){
    const data = card?.__ctPlannerData;
    if (!data || !Array.isArray(data.mine)) return;

    for (const row of data.mine){
      const id = String(row.id || "");
      if (!id) continue;
      let player = null;
      try { player = card.querySelector(`.ct-plan-player[data-player-id="${CSS.escape(id)}"]`); }
      catch (_) { player = card.querySelector(`.ct-plan-player[data-player-id="${id.replace(/"/g,"\\\"")}"]`); }
      decoratePlayer(player,row);
    }
  }

  function apply(){
    queued = false;
    document.querySelectorAll("#crunchTimeCommandCenter .ct-matchup-card").forEach(decorateCard);
  }

  function queue(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  function init(){
    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length || m.type === "characterData")) queue();
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    queue();
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
