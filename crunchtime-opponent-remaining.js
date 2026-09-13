(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html" || window.__crunchOpponentRemaining) return;
  window.__crunchOpponentRemaining = true;

  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const f = value => n(value).toFixed(1);
  const esc = value => String(value ?? "").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function avatar(row){
    const initials = esc(String(row.name || "").split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase());
    return `<span class="ct-opp-photo"><img src="https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(row.id)}.jpg" alt="" loading="lazy" onerror="this.remove()"><span>${initials}</span></span>`;
  }

  function rowMarkup(row){
    const actual = Math.max(0,n(row.actual));
    const left = Math.max(0,n(row.expectedRemaining));
    const projectedFinal = actual + left;
    const status = row.live ? "Live" : "Upcoming";
    return `<div class="ct-opp-player${row.live?" is-live":""}" data-ct-opp-player="${esc(row.id)}">
      ${avatar(row)}
      <div class="ct-opp-copy">
        <strong>${esc(row.name)}</strong>
        <span>${esc(row.position)} · ${esc(row.team)} · ${status}</span>
      </div>
      <div class="ct-opp-metrics" aria-label="${esc(row.name)} opponent scoring">
        <span><small>Actual</small><strong>${f(actual)}</strong></span>
        <span class="projected"><small>Live proj</small><strong>${f(projectedFinal)}</strong></span>
        <span class="left"><small>Left</small><strong>+${f(left)}</strong></span>
      </div>
    </div>`;
  }

  function signature(data){
    return (data?.theirs || []).map(row=>[
      row.id,
      f(row.actual),
      f(row.expectedRemaining),
      row.live?"1":"0"
    ].join(":" )).join("|");
  }

  function decorateCard(card){
    const data = card?.__ctPlannerData;
    const planner = card?.querySelector(".ct-points-planner");
    if (!data || !planner) return;

    const theirs = Array.isArray(data.theirs) ? data.theirs : [];
    let section = planner.querySelector(".ct-opponent-remaining");

    if (!theirs.length){
      section?.remove();
      return;
    }

    const sig = signature(data);
    if (section?.dataset.signature === sig) return;

    const projectedLeft = theirs.reduce((sum,row)=>sum+Math.max(0,n(row.expectedRemaining)),0);
    const liveCount = theirs.filter(row=>row.live).length;
    const statusCopy = liveCount
      ? `${liveCount} live · ${theirs.length-liveCount} upcoming`
      : `${theirs.length} upcoming`;

    const html = `<section class="ct-opponent-remaining" data-signature="${esc(sig)}">
      <div class="ct-opp-head">
        <div>
          <span>Opponent remaining</span>
          <strong>${esc(data.view?.oppName || "Opponent")}</strong>
        </div>
        <div class="ct-opp-total">
          <small>${esc(statusCopy)}</small>
          <strong>+${f(projectedLeft)} projected left</strong>
        </div>
      </div>
      <div class="ct-opp-list">${theirs.map(rowMarkup).join("")}</div>
    </section>`;

    const holder = document.createElement("div");
    holder.innerHTML = html;
    const next = holder.firstElementChild;
    const ownPlayers = planner.querySelector(".ct-plan-players");

    if (section) section.replaceWith(next);
    else if (ownPlayers) planner.insertBefore(next,ownPlayers);
    else planner.appendChild(next);
  }

  function decorateAll(){
    document.querySelectorAll("#crunchTimeCommandCenter .ct-matchup-card").forEach(decorateCard);
  }

  let queued = false;
  function queue(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(()=>{
      queued = false;
      decorateAll();
    });
  }

  const observer = new MutationObserver(queue);
  function init(){
    observer.observe(document.body,{childList:true,subtree:true});
    queue();
    setInterval(queue,5000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
