(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html") return;

  const API = "https://api.sleeper.app/v1";
  const PROJECTIONS = "https://api.sleeper.com/projections/nfl";
  const TEAM_ALIASES = {JAC:"JAX",WSH:"WAS",OAK:"LV",SD:"LAC",STL:"LAR"};
  const leagueCache = new Map();
  const projectionCache = new Map();
  const planState = new Map();
  let queued = false;
  let renderVersion = 0;

  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const f = value => n(value).toFixed(1);
  const esc = value => String(value ?? "").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const normalizeTeam = value => {
    const team = String(value || "").toUpperCase();
    return TEAM_ALIASES[team] || team;
  };
  const roundTenth = value => Math.round(n(value)*10)/10;
  const targetTenth = value => Math.max(0,Math.ceil(n(value)*10)/10);

  async function json(url,cache="force-cache"){
    const response = await fetch(url,{cache});
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  function projectionMap(rows){
    const map = new Map();
    for (const row of Array.isArray(rows)?rows:[]){
      const id = String(row?.player_id || row?.player?.player_id || "");
      if (id) map.set(id,row);
    }
    return map;
  }

  function projectionPoints(row,league){
    if (!row) return 0;
    const stats = row.stats || row.projection || {};
    const scoring = league?.scoring_settings || {};
    let total = 0;
    let matched = 0;
    for (const [key,multiplierRaw] of Object.entries(scoring)){
      const multiplier = Number(multiplierRaw);
      const stat = Number(stats?.[key]);
      if (!Number.isFinite(multiplier) || multiplier===0 || !Number.isFinite(stat)) continue;
      total += stat*multiplier;
      matched += 1;
    }
    if (matched>0 && Number.isFinite(total) && total!==0) return Math.max(0,total);
    const rec = Number(scoring.rec || 0);
    const fallback = rec>=.75 ? row.pts_ppr : rec>=.25 ? row.pts_half_ppr : row.pts_std;
    if (Number.isFinite(Number(fallback))) return Math.max(0,Number(fallback));
    for (const key of ["pts_ppr","pts_half_ppr","pts_std"]){
      if (Number.isFinite(Number(row?.[key]))) return Math.max(0,Number(row[key]));
    }
    return 0;
  }

  function getLeague(id){
    const key = String(id || "");
    if (!leagueCache.has(key)) leagueCache.set(key,json(`${API}/league/${encodeURIComponent(key)}`).catch(()=>({league_id:key,scoring_settings:{rec:1}})));
    return leagueCache.get(key);
  }

  function getProjections(season,week){
    const key = `${season}|${week}`;
    if (!projectionCache.has(key)){
      const url = `${PROJECTIONS}/${encodeURIComponent(season)}/${week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF&order_by=pts_ppr`;
      projectionCache.set(key,json(url).then(projectionMap).catch(()=>new Map()));
    }
    return projectionCache.get(key);
  }

  function gameForPlayer(player){
    try { return state?.games?.get?.(normalizeTeam(player?.team)) || null; }
    catch (_) { return null; }
  }

  function nameOf(player,id){
    return player?.full_name || [player?.first_name,player?.last_name].filter(Boolean).join(" ") || `Player ${id}`;
  }

  function remaining(matchup,league,projections,side){
    const starters = Array.isArray(matchup?.starters) ? matchup.starters : [];
    return starters.map(rawId=>{
      const id = String(rawId);
      let player = {};
      try { player = state?.players?.[id] || {}; } catch (_) {}
      const game = gameForPlayer(player);
      if (!game || game.completed) return null;
      const actual = n(matchup?.players_points?.[id]);
      const fullProjection = projectionPoints(projections.get(id),league);
      const live = String(game?.state || "").toLowerCase()==="in";
      const expectedRemaining = live ? Math.max(0,fullProjection-actual) : Math.max(0,fullProjection);
      return {
        id,side,
        name:nameOf(player,id),
        team:normalizeTeam(player?.team)||"FA",
        position:String(player?.position||"—").toUpperCase(),
        actual,fullProjection,expectedRemaining,live,game
      };
    }).filter(Boolean);
  }

  function buildData(view,league,projections){
    const my = view?.myMatchup;
    const opp = view?.oppMatchup;
    if (!my || !opp) return null;
    const mine = remaining(my,league,projections,"mine");
    const theirs = remaining(opp,league,projections,"opp");
    const myScore = n(my.points);
    const oppScore = n(opp.points);
    const oppProjectedLeft = theirs.reduce((sum,row)=>sum+row.expectedRemaining,0);
    const myProjectedLeft = mine.reduce((sum,row)=>sum+row.expectedRemaining,0);
    const currentNeed = targetTenth(Math.max(0,oppScore-myScore+.01));
    const projectedNeed = targetTenth(Math.max(0,oppScore+oppProjectedLeft-myScore+.01));
    return {
      view,league,mine,theirs,myScore,oppScore,
      myProjectedLeft,oppProjectedLeft,currentNeed,projectedNeed,
      final:mine.length===0 && theirs.length===0
    };
  }

  function cardForLeague(name){
    return [...document.querySelectorAll("#crunchTimeCommandCenter .ct-matchup-card")].find(card=>
      String(card.querySelector(".ct-league-name")?.textContent||"").trim()===String(name||"").trim()
    ) || null;
  }

  function stateFor(data){
    const key = String(data.view.leagueId || data.view.name || "league");
    if (!planState.has(key)) planState.set(key,{mode:data.theirs.length?"projected":"current",allocations:new Map(),initialized:false,target:null});
    return planState.get(key);
  }

  function targetFor(data,plan){
    return plan.mode === "projected" ? data.projectedNeed : data.currentNeed;
  }

  function balanceAllocations(data,plan){
    const target = targetFor(data,plan);
    plan.allocations = new Map();
    if (!data.mine.length) return;
    const weights = data.mine.map(row=>Math.max(.1,row.expectedRemaining));
    const totalWeight = weights.reduce((a,b)=>a+b,0) || data.mine.length;
    let used = 0;
    data.mine.forEach((row,index)=>{
      let value;
      if (index === data.mine.length-1) value = Math.max(0,roundTenth(target-used));
      else value = roundTenth(target*(weights[index]/totalWeight));
      used += value;
      plan.allocations.set(row.id,value);
    });
    plan.initialized = true;
    plan.target = target;
  }

  function useProjections(data,plan){
    plan.allocations = new Map(data.mine.map(row=>[row.id,roundTenth(row.expectedRemaining)]));
    plan.initialized = true;
    plan.target = targetFor(data,plan);
  }

  function avatar(row){
    const initials = esc(row.name.split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase());
    return `<span class="ct-plan-photo"><img src="https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(row.id)}.jpg" alt="" loading="lazy" onerror="this.remove()"><span>${initials}</span></span>`;
  }

  function difficulty(allocation,projection){
    if (allocation<=0) return {label:"No points assigned",tone:"neutral",ratio:0};
    if (projection<=0) return {label:"No projection support",tone:"long",ratio:Infinity};
    const ratio = allocation/projection;
    if (ratio<=.8) return {label:"Below projection",tone:"easy",ratio};
    if (ratio<=1.05) return {label:"Near projection",tone:"normal",ratio};
    if (ratio<=1.3) return {label:"Stretch",tone:"stretch",ratio};
    return {label:"Long shot",tone:"long",ratio};
  }

  function sliderMax(row,target){
    const raw = Math.max(25,target,row.expectedRemaining*2.25,row.fullProjection*1.75);
    return Math.max(25,Math.ceil(raw/5)*5);
  }

  function playerRow(row,target,plan){
    const allocation = n(plan.allocations.get(row.id));
    const d = difficulty(allocation,row.expectedRemaining);
    const ratio = Number.isFinite(d.ratio) ? `${d.ratio.toFixed(2)}× proj left` : "—";
    const status = row.game?.detail || (row.live?"Live":"Upcoming");
    return `<div class="ct-plan-player ${d.tone}" data-player-id="${esc(row.id)}">
      <div class="ct-plan-player-head">
        ${avatar(row)}
        <div class="ct-plan-player-copy"><strong>${esc(row.name)}</strong><span>${esc(row.position)} · ${esc(row.team)} · ${esc(status)}</span></div>
        <div class="ct-plan-assigned"><strong data-ct-assigned>${f(allocation)}</strong><span>assigned</span></div>
      </div>
      <input class="ct-plan-slider" type="range" min="0" max="${sliderMax(row,target)}" step="0.1" value="${allocation}" data-ct-plan-slider data-player-id="${esc(row.id)}" aria-label="Points assigned to ${esc(row.name)}">
      <div class="ct-plan-player-foot"><span>Proj. left <strong>${f(row.expectedRemaining)}</strong></span><span class="ct-plan-difficulty ${d.tone}" data-ct-difficulty>${esc(d.label)} · ${esc(ratio)}</span></div>
    </div>`;
  }

  function passiveCondition(data){
    const margin = data.myScore-data.oppScore;
    if (data.final) return margin>0 ? `Final win ${f(data.myScore)}–${f(data.oppScore)}.` : margin<0 ? `Final loss ${f(data.myScore)}–${f(data.oppScore)}.` : `Final tie ${f(data.myScore)}–${f(data.oppScore)}.`;
    if (!data.mine.length && data.theirs.length){
      if (margin>0) return `No players left for you. Your opponent's remaining starters must score fewer than ${f(margin)} more points.`;
      return `No players left for you and you're down ${f(Math.abs(margin))}. You need negative opponent scoring or a stat correction.`;
    }
    return "";
  }

  function plannerMarkup(data,plan){
    if (!data.mine.length){
      const text = passiveCondition(data);
      return text ? `<div class="ct-plan-passive"><span>Win condition</span><strong>${esc(text)}</strong></div>` : "";
    }

    const target = targetFor(data,plan);
    if (!plan.initialized || !Number.isFinite(plan.target)) balanceAllocations(data,plan);
    const projectedModeAvailable = data.theirs.length>0;
    const allocated = data.mine.reduce((sum,row)=>sum+n(plan.allocations.get(row.id)),0);
    const delta = target-allocated;
    const projectionDelta = data.myProjectedLeft-target;
    const summaryTone = projectionDelta>=0 ? "covers" : "short";
    const targetCopy = plan.mode === "projected" && projectedModeAvailable
      ? `Includes ${f(data.oppProjectedLeft)} projected opponent points still remaining.`
      : projectedModeAvailable
        ? "Minimum to take the lead at the current score; ignores future opponent scoring."
        : "Exact catch-up target from the current score because your opponent has no players left.";
    const allocationStatus = Math.abs(delta)<=.05
      ? "Target fully allocated"
      : delta>0 ? `${f(delta)} still unassigned` : `${f(Math.abs(delta))} above target`;
    const projectionStatus = projectionDelta>=0
      ? `Combined projection covers this target by ${f(projectionDelta)}.`
      : `You need ${f(Math.abs(projectionDelta))} above the combined remaining projection.`;

    return `<section class="ct-points-planner" data-league-id="${esc(data.view.leagueId)}">
      <div class="ct-plan-head">
        <div><span>Points Needed Planner</span><strong>Need ${f(target)} more from ${data.mine.length} player${data.mine.length===1?"":"s"}</strong><p>${esc(targetCopy)}</p></div>
        ${projectedModeAvailable?`<div class="ct-plan-mode" role="group" aria-label="Points-needed target">
          <button type="button" data-ct-plan-mode="current" class="${plan.mode==="current"?"active":""}">Current score</button>
          <button type="button" data-ct-plan-mode="projected" class="${plan.mode==="projected"?"active":""}">Projected finish</button>
        </div>`:""}
      </div>
      <div class="ct-plan-summary">
        <div><span>Need</span><strong>${f(target)}</strong></div>
        <div><span>Assigned</span><strong data-ct-plan-assigned-total>${f(allocated)}</strong><small data-ct-plan-allocation-status>${esc(allocationStatus)}</small></div>
        <div class="${summaryTone}"><span>Proj. left</span><strong>${f(data.myProjectedLeft)}</strong><small>${esc(projectionStatus)}</small></div>
      </div>
      <div class="ct-plan-players">${data.mine.map(row=>playerRow(row,target,plan)).join("")}</div>
      <div class="ct-plan-actions"><button type="button" data-ct-plan-balance>Balance target by projections</button><button type="button" data-ct-plan-projections>Use player projections</button></div>
      <div class="ct-plan-note">This is a scenario planner, not a win probability. “Stretch” labels compare your assigned target with that player's remaining projection.</div>
    </section>`;
  }

  function updateInteractive(card,data,plan){
    const target = targetFor(data,plan);
    let total = 0;
    for (const row of data.mine){
      const allocation = n(plan.allocations.get(row.id));
      total += allocation;
      const player = card.querySelector(`.ct-plan-player[data-player-id="${CSS.escape(row.id)}"]`);
      if (!player) continue;
      const assigned = player.querySelector("[data-ct-assigned]");
      if (assigned) assigned.textContent = f(allocation);
      const d = difficulty(allocation,row.expectedRemaining);
      player.classList.remove("neutral","easy","normal","stretch","long");
      player.classList.add(d.tone);
      const label = player.querySelector("[data-ct-difficulty]");
      const ratio = Number.isFinite(d.ratio) ? `${d.ratio.toFixed(2)}× proj left` : "—";
      if (label){
        label.className = `ct-plan-difficulty ${d.tone}`;
        label.textContent = `${d.label} · ${ratio}`;
      }
    }
    const totalNode = card.querySelector("[data-ct-plan-assigned-total]");
    if (totalNode) totalNode.textContent = f(total);
    const status = card.querySelector("[data-ct-plan-allocation-status]");
    const delta = target-total;
    if (status) status.textContent = Math.abs(delta)<=.05 ? "Target fully allocated" : delta>0 ? `${f(delta)} still unassigned` : `${f(Math.abs(delta))} above target`;
  }

  async function decorate(){
    queued = false;
    const version = ++renderVersion;
    const command = document.getElementById("crunchTimeCommandCenter");
    if (!command) return;
    let views = [], season = "", week = 1;
    try {
      views = Array.isArray(state?.leagues) ? state.leagues : [];
      season = String(state?.season || document.getElementById("season")?.value || new Date().getFullYear());
      week = Number(state?.week || document.getElementById("week")?.value || 1);
    } catch (_) {}
    if (!views.length) return;

    const [projections,leagues] = await Promise.all([
      getProjections(season,week),
      Promise.all(views.map(view=>getLeague(view.leagueId)))
    ]);
    if (version !== renderVersion) return;

    views.forEach((view,index)=>{
      const card = cardForLeague(view.name);
      if (!card) return;
      const data = buildData(view,leagues[index],projections);
      if (!data) return;
      const plan = stateFor(data);
      const existing = card.querySelector(".ct-points-planner,.ct-plan-passive");
      const html = plannerMarkup(data,plan);
      if (!html){ existing?.remove(); return; }
      const temp = document.createElement("div");
      temp.innerHTML = html;
      const next = temp.firstElementChild;
      if (existing) existing.replaceWith(next);
      else {
        const action = card.querySelector(".ct-action");
        if (action) action.insertAdjacentElement("afterend",next);
        else card.appendChild(next);
      }
      card.dataset.ctPlannerLeagueId = String(view.leagueId);
      card.__ctPlannerData = data;
      card.__ctPlannerState = plan;
    });

    document.body.classList.add("crunch-planner-ready");
  }

  function queue(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(decorate);
  }

  function init(){
    document.addEventListener("input",event=>{
      const slider = event.target.closest?.("[data-ct-plan-slider]");
      if (!slider) return;
      const card = slider.closest(".ct-matchup-card");
      const data = card?.__ctPlannerData;
      const plan = card?.__ctPlannerState;
      if (!card || !data || !plan) return;
      plan.allocations.set(String(slider.dataset.playerId),roundTenth(slider.value));
      updateInteractive(card,data,plan);
    });

    document.addEventListener("click",event=>{
      const mode = event.target.closest?.("[data-ct-plan-mode]");
      const balance = event.target.closest?.("[data-ct-plan-balance]");
      const projections = event.target.closest?.("[data-ct-plan-projections]");
      const trigger = mode || balance || projections;
      if (!trigger) return;
      const card = trigger.closest(".ct-matchup-card");
      const data = card?.__ctPlannerData;
      const plan = card?.__ctPlannerState;
      if (!card || !data || !plan) return;
      if (mode){
        plan.mode = mode.dataset.ctPlanMode === "projected" ? "projected" : "current";
        balanceAllocations(data,plan);
      } else if (balance) balanceAllocations(data,plan);
      else if (projections) useProjections(data,plan);
      plan.target = targetFor(data,plan);
      plan.initialized = true;
      const old = card.querySelector(".ct-points-planner,.ct-plan-passive");
      const temp = document.createElement("div");
      temp.innerHTML = plannerMarkup(data,plan);
      if (old && temp.firstElementChild) old.replaceWith(temp.firstElementChild);
    });

    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(node=>node.nodeType===1 && (node.matches?.(".ct-matchup-card,.ct-priority-list") || node.querySelector?.(".ct-matchup-card"))))) queue();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    queue();
    setInterval(queue,5000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
