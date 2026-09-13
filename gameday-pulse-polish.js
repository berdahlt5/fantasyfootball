(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const STORAGE_KEY = "fantasyGameDayPulseCollapsed";
  let scheduled = false;

  function readCollapsed(){
    try { return localStorage.getItem(STORAGE_KEY) === "1"; }
    catch (_) { return false; }
  }

  function writeCollapsed(value){
    try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); }
    catch (_) {}
  }

  function setText(node,value){
    if (node && node.textContent !== value) node.textContent = value;
  }

  function weekFromHost(host){
    const title = host.querySelector(".game-day-pulse-title")?.textContent || "";
    const match = title.match(/week\s+(\d+)/i);
    return match ? match[1] : "";
  }

  function applyCollapsedState(host,button){
    const collapsed = readCollapsed();
    host.classList.toggle("is-collapsed",collapsed);
    const expanded = collapsed ? "false" : "true";
    const label = collapsed ? "Expand player pulse" : "Minimize player pulse";
    if (button.getAttribute("aria-expanded") !== expanded) button.setAttribute("aria-expanded",expanded);
    if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label",label);
    const html = collapsed
      ? `<span class="pulse-collapse-icon" aria-hidden="true">＋</span><span>Expand</span>`
      : `<span class="pulse-collapse-icon" aria-hidden="true">−</span><span>Minimize</span>`;
    if (button.innerHTML !== html) button.innerHTML = html;
  }

  function ensureHeader(host){
    const head = host.querySelector(".game-day-pulse-head");
    if (!head) return;

    const week = weekFromHost(host);
    if (week) setText(head.querySelector(".game-day-pulse-title"),`Week ${week} Player Pulse`);
    setText(head.querySelector(".game-day-pulse-eyebrow"),"Your cross-league gameday edge");

    let actions = head.querySelector(".game-day-pulse-head-actions");
    if (!actions){
      actions = document.createElement("div");
      actions.className = "game-day-pulse-head-actions";
      const badge = head.querySelector(".game-day-pulse-badge");
      if (badge) actions.appendChild(badge);
      head.appendChild(actions);
    }

    let button = actions.querySelector(".game-day-pulse-collapse");
    if (!button){
      button = document.createElement("button");
      button.type = "button";
      button.className = "game-day-pulse-collapse";
      button.addEventListener("click",()=>{
        writeCollapsed(!host.classList.contains("is-collapsed"));
        applyCollapsedState(host,button);
      });
      actions.appendChild(button);
    }
    applyCollapsedState(host,button);
  }

  function leagueCount(card){
    const line = String(card.querySelector(".game-day-pulse-leagues")?.textContent || "").trim();
    if (!line || /^cross-league$/i.test(line)) return 1;
    return line.split("·").map(value=>value.trim()).filter(Boolean).length || 1;
  }

  function convertScores(host){
    for (const card of host.querySelectorAll(".game-day-pulse-card")){
      const score = card.querySelector(".game-day-pulse-score");
      const strong = score?.querySelector("strong");
      const label = score?.querySelector("span");
      const small = score?.querySelector("small");
      if (!score || !strong || !label || !small || score.dataset.display === "projection") continue;

      const match = String(small.textContent || "").match(/(?:For|Against)\s+([0-9]+(?:\.[0-9]+)?)/i);
      if (!match) continue;
      const projection = Number(match[1]);
      if (!Number.isFinite(projection)) continue;

      setText(strong,projection.toFixed(1));
      setText(label,"Proj. pts");
      const count = leagueCount(card);
      setText(small,count>1?`Across ${count} leagues`:"Projected this week");
      score.dataset.display = "projection";
    }
  }

  function enhance(){
    scheduled = false;
    const host = document.getElementById("gameDayPlayerPulse");
    if (!host) return;
    ensureHeader(host);
    convertScores(host);
  }

  function scheduleEnhance(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function init(){
    scheduleEnhance();
    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length)) scheduleEnhance();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
