(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html") return;

  let queued = false;
  const snapTimers = new WeakMap();
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const f = value => n(value).toFixed(1);
  const roundTenth = value => Math.round(n(value) * 10) / 10;
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  const clampPct = value => clamp(value,0,100);

  function ensurePolishStyles(){
    if (document.getElementById("crunchTimeSliderSnapStyles")) return;
    const style = document.createElement("style");
    style.id = "crunchTimeSliderSnapStyles";
    style.textContent = `
      .ct-plan-live-metrics{display:flex;align-items:center;gap:4px;margin-top:3px;font-size:.42rem;line-height:1.15;white-space:nowrap;color:#8b98aa}
      .ct-plan-live-metrics span{margin:0!important;color:#8b98aa!important;font-weight:700;overflow:visible!important;text-overflow:clip!important}
      .ct-plan-live-metrics strong{font-weight:950;color:#607896}
      .ct-plan-live-metrics .actual strong{color:#4a927f}
      .ct-plan-live-metrics .projected strong{color:#7283b4}
      .ct-plan-live-metrics i{font-style:normal;color:#a9b3c0}
      .ct-plan-player.is-proj-snapped .ct-plan-proj-marker b{box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 1px rgba(145,131,235,.12),0 0 18px rgba(136,120,232,.34)!important}
      .ct-plan-player.is-proj-snapped .ct-plan-proj-marker i{box-shadow:0 0 0 1px rgba(255,255,255,.4),0 0 15px rgba(132,117,226,.5)!important}
      .ct-plan-player.is-proj-snapped .ct-plan-slider::-webkit-slider-thumb{box-shadow:0 0 0 5px rgba(137,122,232,.12),0 0 20px rgba(131,116,230,.36),0 5px 14px rgba(48,84,133,.18),inset 0 1px 1px rgba(255,255,255,.98)!important}
      .ct-plan-player.is-proj-snapped .ct-plan-slider::-moz-range-thumb{box-shadow:0 0 0 5px rgba(137,122,232,.12),0 0 20px rgba(131,116,230,.36),0 5px 14px rgba(48,84,133,.18),inset 0 1px 1px rgba(255,255,255,.98)!important}
      html[data-theme="dark"] .ct-plan-live-metrics,html[data-theme="dark"] .ct-plan-live-metrics span{color:#8fa0b5!important}
      html[data-theme="dark"] .ct-plan-live-metrics strong{color:#a9bdd6}
      html[data-theme="dark"] .ct-plan-live-metrics .actual strong{color:#7ac3ad}
      html[data-theme="dark"] .ct-plan-live-metrics .projected strong{color:#aaa9de}
      @media(max-width:560px){.ct-plan-live-metrics{font-size:.4rem;gap:3px}}
    `;
    document.head.appendChild(style);
  }

  function rowForPlayer(card, player){
    const data = card?.__ctPlannerData;
    const id = String(player?.dataset?.playerId || "");
    if (!data || !id || !Array.isArray(data.mine)) return null;
    return data.mine.find(item => String(item.id) === id) || null;
  }

  function thumbSize(){
    try {
      return window.CSS?.supports?.("-webkit-touch-callout","none") ? 24 : 22;
    } catch (_) { return 22; }
  }

  function markerLeft(slider,value,min,max){
    const width = slider.getBoundingClientRect().width || slider.clientWidth || 0;
    if (!width) return null;
    const thumb = thumbSize();
    const half = thumb / 2;
    const ratio = clamp((value-min)/Math.max(.1,max-min),0,1);
    return half + ratio * Math.max(0,width-thumb);
  }

  function positionMarkers(player,slider,actual,projectedFinal,min,max){
    const current = player.querySelector(".ct-plan-current-marker");
    const projected = player.querySelector(".ct-plan-proj-marker");
    const currentLeft = markerLeft(slider,actual,min,max);
    const projectedLeft = markerLeft(slider,projectedFinal,min,max);
    if (current && currentLeft != null) current.style.left = `${currentLeft}px`;
    if (projected && projectedLeft != null) projected.style.left = `${projectedLeft}px`;
  }

  function scaleSlider(player,row,card){
    const slider = player?.querySelector?.("[data-ct-plan-slider]");
    const wrap = player?.querySelector?.(".ct-plan-slider-wrap");
    const plan = card?.__ctPlannerState;
    if (!slider || !wrap || !plan) return;

    const actual = Math.max(0,n(row.actual));
    const projectedLeft = Math.max(0,n(row.expectedRemaining));
    const projectedFinal = actual + projectedLeft;
    const allocation = Math.max(0,n(plan.allocations?.get?.(row.id)));
    const scenarioFinal = actual + allocation;

    if (!slider.dataset.ctBaseMax) slider.dataset.ctBaseMax = String(slider.max || 1);

    let min;
    let max;

    if (slider.dataset.ctLockedMin != null && slider.dataset.ctLockedMax != null){
      min = n(slider.dataset.ctLockedMin);
      max = n(slider.dataset.ctLockedMax);
    } else if (row.live){
      /* Zoom the live range once, then keep it fixed while the user drags. */
      const leftBuffer = Math.max(.8,Math.min(2.2,projectedLeft * 1.2));
      min = Math.max(0,actual-leftBuffer);
      const zoomSpan = Math.max(3,projectedLeft*2.6,allocation*1.35);
      max = Math.max(actual+zoomSpan,projectedFinal+.7,scenarioFinal+.6);
      max = Math.ceil(max*10)/10;
      min = Math.floor(min*10)/10;
      slider.dataset.ctLockedMin = String(min);
      slider.dataset.ctLockedMax = String(max);
    } else {
      min = 0;
      max = Math.max(1,n(slider.dataset.ctBaseMax));
      slider.dataset.ctLockedMin = String(min);
      slider.dataset.ctLockedMax = String(max);
    }

    if (max <= min) max = min + 1;
    slider.min = String(roundTenth(min));
    slider.max = String(roundTenth(max));

    const span = Math.max(.1,max-min);
    const pct = value => clampPct(((value-min)/span)*100);
    wrap.style.setProperty("--current",`${pct(actual)}%`);
    wrap.style.setProperty("--proj",`${pct(projectedFinal)}%`);
    slider.style.setProperty("--fill",`${pct(scenarioFinal)}%`);
    slider.dataset.ctScaleMin = String(min);
    slider.dataset.ctScaleMax = String(max);

    /* Native range thumbs travel inside half-thumb insets. Put the fixed
       markers on that exact same path so a snapped thumb centers on the line. */
    positionMarkers(player,slider,actual,projectedFinal,min,max);
  }

  function decoratePlayer(player,row,card){
    if (!player || !row) return;

    const actual = Math.max(0,n(row.actual));
    const projectedLeft = Math.max(0,n(row.expectedRemaining));
    const projectedFinal = actual + projectedLeft;

    const copy = player.querySelector(".ct-plan-player-copy");
    if (copy){
      let metrics = copy.querySelector(".ct-plan-live-metrics");
      if (!metrics){
        metrics = document.createElement("div");
        metrics.className = "ct-plan-live-metrics";
        copy.appendChild(metrics);
      }
      metrics.innerHTML = `<span class="actual"><strong>${f(actual)}</strong> actual</span><i>·</i><span class="projected"><strong>${f(projectedFinal)}</strong> proj</span>`;
    }

    const slider = player.querySelector("[data-ct-plan-slider]");
    if (slider){
      slider.setAttribute("aria-label",`Final point scenario for ${row.name || "player"}. Current ${f(actual)}, projected ${f(projectedFinal)}.`);
      slider.dataset.ctActual = f(actual);
      slider.dataset.ctProjectedFinal = f(projectedFinal);
      slider.dataset.ctProjectedLeft = f(projectedLeft);
    }

    scaleSlider(player,row,card);
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
      decoratePlayer(player,row,card);
    }

    const equation = card.querySelector("[data-ct-plan-equation]");
    if (equation){
      const clean = String(equation.textContent || "").replace(/^\+/u,"").replace(/\s+\+\s+\+/gu," + ");
      if (equation.textContent !== clean) equation.textContent = clean;
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

  function flashSnap(player){
    if (!player) return;
    player.classList.add("is-proj-snapped");
    clearTimeout(snapTimers.get(player));
    const timer = setTimeout(()=>player.classList.remove("is-proj-snapped"),420);
    snapTimers.set(player,timer);
  }

  function init(){
    ensurePolishStyles();

    document.addEventListener("input",event=>{
      const slider = event.target.closest?.("[data-ct-plan-slider]");
      if (!slider) return;
      const player = slider.closest(".ct-plan-player");
      const card = slider.closest(".ct-matchup-card");
      const row = rowForPlayer(card,player);
      if (!player || !card || !row) return;

      const projectedFinal = Math.max(0,n(row.actual)) + Math.max(0,n(row.expectedRemaining));
      const min = n(slider.min);
      const max = Math.max(min+.1,n(slider.max));
      const tolerance = Math.max(.5,(max-min)*.02);
      const raw = n(slider.value);

      if (slider.dataset.ctSnapDispatch !== "1" && Math.abs(raw-projectedFinal) <= tolerance && Math.abs(raw-projectedFinal) > .049){
        slider.value = String(roundTenth(projectedFinal));
        slider.dataset.ctSnapDispatch = "1";
        flashSnap(player);
        slider.dispatchEvent(new Event("input",{bubbles:true}));
        delete slider.dataset.ctSnapDispatch;
        scaleSlider(player,row,card);
        return;
      }

      if (Math.abs(n(slider.value)-projectedFinal) <= .051) flashSnap(player);
      scaleSlider(player,row,card);
    });

    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length || m.type === "characterData")) queue();
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    window.addEventListener("resize",queue,{passive:true});
    queue();
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
