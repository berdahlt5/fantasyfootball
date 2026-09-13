(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  const USER_SELECTORS = ["#username","#sleeperUsername","input[name='username']"];
  const WEEK_SELECTORS = ["#week","#weekSelect","#week-selector","select[name='week']"];

  function fieldValue(selectors){
    for (const selector of selectors){
      const node = document.querySelector(selector);
      if (!node) continue;
      const value = "value" in node ? node.value : node.textContent;
      if (String(value || "").trim()) return String(value).trim();
    }
    return "";
  }

  function currentWeek(){
    const match = fieldValue(WEEK_SELECTORS).match(/\d+/);
    return match ? Math.max(1, Math.min(18, Number(match[0]))) : 1;
  }

  function findImpactSection(){
    const card = document.querySelector(".impact-player");
    if (card){
      const section = card.closest("section,.section,.panel,.card,[class*='impact']");
      if (section && section !== card) return section;
      return card.parentElement;
    }
    const headings = [...document.querySelectorAll("h2,h3,h4,.section-title,.card-title,strong")];
    const heading = headings.find(node=>/impact|player.*watch|watch.*player/i.test(String(node.textContent || "")));
    return heading?.closest("section,.section,.panel,.card") || null;
  }

  function placeholderMarkup(week){
    return `<div class="weekly-pulse-head">
      <div><div class="weekly-pulse-title">Your Week ${week} Player Pulse</div><div class="weekly-pulse-sub">Top starters across all your leagues, using each league’s scoring. Account data can finish loading in the background.</div></div>
      <div class="weekly-pulse-badge">Cross-league</div>
    </div>
    <div class="weekly-pulse-grid">
      <div class="weekly-pulse-col">
        <div class="weekly-pulse-col-title"><span>Most important players</span><small>Top 5</small></div>
        <div class="weekly-pulse-list"><div class="weekly-pulse-empty">Load your Sleeper username to see this week’s player leverage.</div></div>
      </div>
      <div class="weekly-pulse-col villains">
        <div class="weekly-pulse-col-title"><span>Villains of the week</span><small>Net threats</small></div>
        <div class="weekly-pulse-list"><div class="weekly-pulse-empty">Waiting for your league matchups.</div></div>
      </div>
    </div>`;
  }

  function mountPulse(){
    const existing = document.getElementById("weeklyPlayerPulse");
    const impactSection = findImpactSection();

    if (existing){
      if (impactSection && existing.nextElementSibling !== impactSection){
        impactSection.parentNode?.insertBefore(existing, impactSection);
      }
      return existing;
    }

    const host = document.createElement("section");
    host.id = "weeklyPlayerPulse";
    host.dataset.pulseBootstrap = "1";
    host.setAttribute("aria-label", `Week ${currentWeek()} player importance`);
    host.innerHTML = placeholderMarkup(currentWeek());

    if (impactSection?.parentNode) impactSection.parentNode.insertBefore(host, impactSection);
    else {
      const fallback = document.querySelector("main .dashboard, main, .shell") || document.body;
      fallback.appendChild(host);
    }
    return host;
  }

  let lastUsername = "";
  function wakeEnhancementWhenContextArrives(){
    const usernameNode = USER_SELECTORS.map(selector=>document.querySelector(selector)).find(Boolean);
    const username = String(usernameNode?.value || usernameNode?.textContent || "").trim();
    if (!username || username === lastUsername) return;
    lastUsername = username;

    // The main enhancement script listens for these events and will replace the
    // placeholder with the real cross-league pulse once account context exists.
    usernameNode.dispatchEvent(new Event("input", {bubbles:true}));
    usernameNode.dispatchEvent(new Event("change", {bubbles:true}));
  }

  function init(){
    mountPulse();
    wakeEnhancementWhenContextArrives();

    const observer = new MutationObserver(()=>{
      mountPulse();
      wakeEnhancementWhenContextArrives();
    });
    observer.observe(document.body, {childList:true, subtree:true});

    // Programmatic .value assignments do not fire DOM events, so do a light
    // poll while account settings are hydrating.
    setInterval(wakeEnhancementWhenContextArrives, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
