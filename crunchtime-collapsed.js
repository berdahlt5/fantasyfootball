(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html") return;

  const expanded = new Set();
  let queued = false;

  function numbers(text){
    return (String(text || "").match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
  }

  function cardKey(card){
    const league = String(card.querySelector(".ct-league-name")?.textContent || "").trim();
    const teams = String(card.querySelector(".ct-team-line")?.textContent || "").trim();
    return `${league}|${teams}`;
  }

  function outlook(card){
    const status = String(card.dataset.ctStatus || "").toLowerCase();
    if (status === "final"){
      const current = numbers(card.querySelector(".ct-score-strip>div:first-child strong")?.textContent);
      const edge = (current[0] || 0) - (current[1] || 0);
      if (Math.abs(edge) < .05) return {key:"final",label:"Final tie",tone:"hot"};
      return edge > 0
        ? {key:"final",label:"Final win",tone:"good"}
        : {key:"final",label:"Final loss",tone:"bad"};
    }

    const projected = numbers(card.querySelector(".ct-score-strip>div:nth-child(2) strong")?.textContent);
    if (projected.length < 2) return null;
    const edge = projected[0] - projected[1];
    const abs = Math.abs(edge);

    if (abs <= 4) return {key:"tossup",label:"Toss-up",tone:"hot"};
    if (edge >= 18) return {key:"runaway",label:"Runaway victory",tone:"good"};
    if (edge >= 8) return {key:"strong-edge",label:"Strong edge",tone:"good"};
    if (edge > 4) return {key:"slight-edge",label:"Slight edge",tone:"watch"};
    if (edge <= -18) return {key:"long-shot",label:"Long shot",tone:"bad"};
    if (edge <= -8) return {key:"underdog",label:"Underdog",tone:"bad"};
    return {key:"slight-underdog",label:"Slight underdog",tone:"watch"};
  }

  function setExpanded(card,isExpanded){
    const top = card.querySelector(".ct-card-top");
    if (!top) return;
    card.classList.toggle("is-expanded",isExpanded);
    card.classList.toggle("is-collapsed",!isExpanded);
    top.setAttribute("aria-expanded",isExpanded ? "true" : "false");
  }

  function decorate(card){
    const top = card.querySelector(".ct-card-top");
    if (!top) return;

    const key = cardKey(card);
    card.dataset.ctCollapseKey = key;
    top.classList.add("ct-collapse-trigger");
    top.setAttribute("role","button");
    top.setAttribute("tabindex","0");
    top.setAttribute("aria-label",`${card.querySelector(".ct-league-name")?.textContent || "Matchup"}. ${expanded.has(key) ? "Collapse" : "Expand"} matchup details.`);

    let chevron = top.querySelector(".ct-collapse-chevron");
    if (!chevron){
      chevron = document.createElement("span");
      chevron.className = "ct-collapse-chevron";
      chevron.setAttribute("aria-hidden","true");
      top.appendChild(chevron);
    }

    const next = outlook(card);
    if (next){
      const pill = top.querySelector(".ct-status-pill");
      if (pill){
        pill.textContent = next.label;
        pill.classList.remove("hot","good","bad","watch");
        pill.classList.add(next.tone);
      }
      card.classList.remove("hot","good","bad","watch");
      card.classList.add(next.tone);
      card.dataset.ctStatus = next.key;
    }

    setExpanded(card,expanded.has(key));
  }

  function apply(){
    queued = false;
    document.querySelectorAll("#crunchTimeCommandCenter .ct-matchup-card").forEach(decorate);
    document.body.classList.add("crunch-collapse-ready");
  }

  function queue(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  function toggle(card){
    const key = card.dataset.ctCollapseKey || cardKey(card);
    const opening = !card.classList.contains("is-expanded");
    if (opening) expanded.add(key);
    else expanded.delete(key);
    setExpanded(card,opening);
    const top = card.querySelector(".ct-card-top");
    if (top) top.setAttribute("aria-label",`${card.querySelector(".ct-league-name")?.textContent || "Matchup"}. ${opening ? "Collapse" : "Expand"} matchup details.`);
  }

  document.addEventListener("click",event=>{
    const top = event.target.closest?.("#crunchTimeCommandCenter .ct-card-top");
    if (!top) return;
    const card = top.closest(".ct-matchup-card");
    if (card) toggle(card);
  });

  document.addEventListener("keydown",event=>{
    const top = event.target.closest?.("#crunchTimeCommandCenter .ct-card-top");
    if (!top || !["Enter"," "].includes(event.key)) return;
    event.preventDefault();
    const card = top.closest(".ct-matchup-card");
    if (card) toggle(card);
  });

  const observer = new MutationObserver(mutations=>{
    if (mutations.some(m=>[...m.addedNodes].some(node=>node.nodeType===1 && (node.matches?.(".ct-matchup-card,.ct-priority-list") || node.querySelector?.(".ct-matchup-card"))))) queue();
  });

  if (document.body){
    observer.observe(document.body,{childList:true,subtree:true});
    queue();
  } else {
    document.addEventListener("DOMContentLoaded",()=>{
      observer.observe(document.body,{childList:true,subtree:true});
      queue();
    },{once:true});
  }
})();