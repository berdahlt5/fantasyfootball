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
  const roundTenth = value => Math.round(n(value)*10)/10;
  const targetTenth = value => Math.max(0,Math.ceil(n(value)*10)/10);
  const normalizeTeam = value => {
    const team = String(value || "").toUpperCase();
    return TEAM_ALIASES[team] || team;
  };

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
    if (!leagueCache.has(key)){
      leagueCache.set(key,json(`${API}/league/${encodeURIComponent(key)}`).catch(()=>({league_id:key,scoring_settings:{rec:1}})));
    }
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

  function playerName(player,id){
    return player?.full_name || [player?.first_name,player?.last_name].filter(Boolean).join(" ") || `Player ${id}`;
  }

  function remaining(matchup,league,projections){
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
        id,
        name:playerName(player,id),
        team:normalizeTeam(player?.team)||"FA",
        position:String(player?.position||"—").toUpperCase(),
        actual,
        fullProjection,
        expectedRemaining,
        live,
        game
      };
    }).filter(Boolean);
  }

  function buildData(view,league,projections){
    const my = view?.myMatchup;
    const opp = view?.oppMatchup;
    if (!my || !opp) return null;
    const mine = remaining(my,league,projections);
    const theirs = remaining(opp,league,projections);
    const myScore = n(my.points);
    const oppScore = n(opp.points);
    const oppProjectedLeft = theirs.reduce((sum,row)=>sum+row.expectedRemaining,0);
    const currentNeed = targetTenth(Math.max(0,oppScore-myScore+.01));
    const projectedNeed = targetTenth(Math.max(0,oppScore+oppProjectedLeft-myScore+.01));
    const target = theirs.length ? projectedNeed : currentNeed;
    return {
      view,league,mine,theirs,myScore,oppScore,oppProjectedLeft,target,
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
    if (!planState.has(key)) planState.set(key,{allocations:new Map(),target:null});
    return planState.get(key);
  }

  function distribute(data,plan,changedId=null,changedValue=null){
    const rows = data.mine;
    const target = data.target;
    if (!rows.length) return;

    if (!changedId){
      const weightTotal = rows.reduce((sum,row)=>sum+Math.max(.1,row.expectedRemaining),0) || rows.length;
      let used = 0;
      rows.forEach((row,index)=>{
        const value = index===rows.length-1
          ? Math.max(0,roundTenth(target-used))
          : roundTenth(target*(Math.max(.1,row.expectedRemaining)/weightTotal));
        plan.allocations.set(row.id,value);
        used += value;
      });
      plan.target = target;
      return;
    }

    const changed = rows.find(row=>row.id===changedId);
    if (!changed) return;
    const fixed = Math.min(target,Math.max(0,roundTenth(changedValue)));
    plan.allocations.set(changed.id,fixed);
    const others = rows.filter(row=>row.id!==changed.id);
    if (!others.length){
      plan.allocations.set(changed.id,target);
      plan.target = target;
      return;
    }

    const remainder = Math.max(0,roundTenth(target-fixed));
    const currentWeight = others.reduce((sum,row)=>sum+Math.max(0,n(plan.allocations.get(row.id))),0);
    const projectionWeight = others.reduce((sum,row)=>sum+Math.max(.1,row.expectedRemaining),0);
    let used = 0;
    others.forEach((row,index)=>{
      const base = currentWeight>0 ? Math.max(0,n(plan.allocations.get(row.id))) : Math.max(.1,row.expectedRemaining);
      const denom = currentWeight>0 ? currentWeight : projectionWeight;
      const value = index===others.length-1
        ? Math.max(0,roundTenth(remainder-used))
        : roundTenth(remainder*(base/denom));
      plan.allocations.set(row.id,value);
      used += value;
    });
    plan.target = target;
  }

  function ensurePlan(data,plan){
    if (plan.target!==data.target || data.mine.some(row=>!plan.allocations.has(row.id))){
      plan.allocations = new Map();
      distribute(data,plan);
    }
  }

  function avatar(row){
    const initials = esc(row.name.split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase());
    return `<span class="ct-plan-photo"><img src="https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(row.id)}.jpg" alt="" loading="lazy" onerror="this.remove()"><span>${initials}</span></span>`;
  }

  function tone(allocation,projection){
    if (projection<=0) return allocation>0 ? "long" : "neutral";
    const ratio = allocation/projection;
    if (ratio<=1.05) return "normal";
    if (ratio<=1.3) return "stretch";
    return "long";
  }

  function playerRow(row,target,plan){
    const allocation = n(plan.allocations.get(row.id));
    const pct = target>0 ? Math.min(100,Math.max(0,(allocation/target)*100)) : 0;
    const status = row.live ? "Live" : "Upcoming";
    const playerTone = tone(allocation,row.expectedRemaining);
    return `<div class="ct-plan-player ${playerTone}" data-player-id="${esc(row.id)}">
      <div class="ct-plan-player-head">
        ${avatar(row)}
        <div class="ct-plan-player-copy"><strong>${esc(row.name)}</strong><span>${esc(row.position)} · ${esc(row.team)} · ${status} · proj ${f(row.expectedRemaining)}</span></div>
        <strong class="ct-plan-value" data-ct-assigned>${f(allocation)}</strong>
      </div>
      <input class="ct-plan-slider" type="range" min="0" max="${Math.max(.1,target)}" step="0.1" value="${allocation}" style="--fill:${pct}%" data-ct-plan-slider data-player-id="${esc(row.id)}" aria-label="Allocate points to ${esc(row.name)}">
    </div>`;
  }

  function passiveCondition(data){
    const margin = data.myScore-data.oppScore;
    if (data.final) return margin>0 ? `Final win ${f(data.myScore)}–${f(data.oppScore)}.` : margin<0 ? `Final loss ${f(data.myScore)}–${f(data.oppScore)}.` : `Final tie ${f(data.myScore)}–${f(data.oppScore)}.`;
    if (!data.mine.length && data.theirs.length){
      if (margin>0) return `Hold on: opponent needs ${f(margin)} more to catch you.`;
      return `No players left for you. You need negative opponent scoring or a stat correction.`;
    }
    return "";
  }

  function allocationEquation(data,plan){
    return data.mine.map(row=>f(plan.allocations.get(row.id))).join(" + ");
  }

  function plannerMarkup(data,plan){
    if (!data.mine.length){
      const text = passiveCondition(data);
      return text ? `<div class="ct-plan-passive"><strong>${esc(text)}</strong></div>` : "";
    }

    ensurePlan(data,plan);
    if (data.target<=0){
      return `<div class="ct-plan-passive good"><strong>You’re already ahead of the projected finish.</strong></div>`;
    }

    const context = data.theirs.length
      ? `vs projected finish · opponent has ${f(data.oppProjectedLeft)} projected left`
      : "opponent is finished";

    return `<section class="ct-points-planner" data-league-id="${esc(data.view.leagueId)}">
      <div class="ct-plan-head-simple">
        <div><span>You need</span><strong>${f(data.target)} pts</strong><small>${esc(context)}</small></div>
        <button type="button" data-ct-plan-reset>Reset</button>
      </div>
      <div class="ct-plan-players">${data.mine.map(row=>playerRow(row,data.target,plan)).join("")}</div>
      <div class="ct-plan-equation"><span data-ct-plan-equation>${esc(allocationEquation(data,plan))}</span><strong>= ${f(data.target)}</strong></div>
    </section>`;
  }

  function updateInteractive(card,data,plan){
    for (const row of data.mine){
      const allocation = n(plan.allocations.get(row.id));
      const player = card.querySelector(`.ct-plan-player[data-player-id="${CSS.escape(row.id)}"]`);
      if (!player) continue;
      const value = player.querySelector("[data-ct-assigned]");
      if (value) value.textContent = f(allocation);
      player.classList.remove("neutral","normal","stretch","long");
      player.classList.add(tone(allocation,row.expectedRemaining));
      const slider = player.querySelector("[data-ct-plan-slider]");
      if (slider){
        slider.value = String(allocation);
        const pct = data.target>0 ? Math.min(100,Math.max(0,(allocation/data.target)*100)) : 0;
        slider.style.setProperty("--fill",`${pct}%`);
      }
    }
    const equation = card.querySelector("[data-ct-plan-equation]");
    if (equation) equation.textContent = allocationEquation(data,plan);
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
    if (version!==renderVersion) return;

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
      else card.appendChild(next);
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
      distribute(data,plan,String(slider.dataset.playerId),slider.value);
      updateInteractive(card,data,plan);
    });

    document.addEventListener("click",event=>{
      const reset = event.target.closest?.("[data-ct-plan-reset]");
      if (!reset) return;
      const card = reset.closest(".ct-matchup-card");
      const data = card?.__ctPlannerData;
      const plan = card?.__ctPlannerState;
      if (!card || !data || !plan) return;
      plan.allocations = new Map();
      distribute(data,plan);
      updateInteractive(card,data,plan);
    });

    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(node=>node.nodeType===1 && (node.matches?.(".ct-matchup-card,.ct-priority-list") || node.querySelector?.(".ct-matchup-card"))))) queue();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    queue();
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
