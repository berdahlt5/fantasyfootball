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

  function ensureScoreboardStyles(){
    if (document.getElementById("crunchTimeTeamScoreboardStyles")) return;
    const style = document.createElement("style");
    style.id = "crunchTimeTeamScoreboardStyles";
    style.textContent = `
      .ct-team-scoreboard{margin-top:10px;overflow:hidden;border:1px solid rgba(134,171,218,.17);border-radius:14px;background:linear-gradient(135deg,rgba(255,255,255,.34),rgba(239,247,255,.24),rgba(239,251,247,.2));box-shadow:inset 0 1px 0 rgba(255,255,255,.64),0 8px 24px rgba(63,91,132,.055);-webkit-backdrop-filter:blur(20px) saturate(1.16);backdrop-filter:blur(20px) saturate(1.16)}
      .ct-scoreboard-head,.ct-scoreboard-row{display:grid;grid-template-columns:minmax(84px,.72fr) minmax(0,1fr) minmax(0,1fr);align-items:stretch}
      .ct-scoreboard-head{border-bottom:1px solid rgba(130,169,217,.12);background:rgba(245,249,255,.2)}
      .ct-scoreboard-head>span{min-width:0}
      .ct-scoreboard-team{min-width:0;padding:8px 9px;text-align:center;border-left:1px solid rgba(130,169,217,.1)}
      .ct-scoreboard-team small{display:block;margin-bottom:2px;color:#8998ab;font-size:.38rem;font-weight:1000;text-transform:uppercase;letter-spacing:.055em}
      .ct-scoreboard-team strong{display:block;overflow:hidden;color:#395474;font-size:.55rem;font-weight:1000;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}
      .ct-scoreboard-team.you strong{color:#32687e}
      .ct-scoreboard-row{border-bottom:1px solid rgba(130,169,217,.1)}
      .ct-scoreboard-row:last-child{border-bottom:0}
      .ct-scoreboard-label{display:grid;align-content:center;gap:2px;padding:8px 9px}
      .ct-scoreboard-label>strong{color:#6f829c;font-size:.45rem;font-weight:1000;text-transform:uppercase;letter-spacing:.05em}
      .ct-scoreboard-label>small{color:#9aa6b5;font-size:.36rem;line-height:1.15}
      .ct-scoreboard-row>strong{display:grid;place-items:center;min-width:0;padding:8px 7px;border-left:1px solid rgba(130,169,217,.1);color:#3e5775;font-size:.76rem;line-height:1;font-weight:1000;font-variant-numeric:tabular-nums}
      .ct-scoreboard-row.current>strong{color:#405a79}
      .ct-scoreboard-row.projected>strong{color:#667ab0}
      .ct-scoreboard-row.scenario>strong:first-of-type{color:#335f7e}
      .ct-scoreboard-result{display:inline-flex;width:max-content;max-width:100%;margin-top:2px;padding:3px 6px;border:1px solid transparent;border-radius:999px;font-size:.37rem;font-weight:1000;line-height:1;letter-spacing:.025em}
      .ct-scoreboard-row.scenario.win{background:linear-gradient(90deg,rgba(70,185,152,.055),rgba(255,255,255,.02))}
      .ct-scoreboard-row.scenario.win .ct-scoreboard-result{color:#39836f;background:rgba(75,187,154,.1);border-color:rgba(75,187,154,.16)}
      .ct-scoreboard-row.scenario.tie{background:linear-gradient(90deg,rgba(224,177,68,.06),rgba(255,255,255,.02))}
      .ct-scoreboard-row.scenario.tie .ct-scoreboard-result{color:#9d741f;background:rgba(224,177,68,.1);border-color:rgba(224,177,68,.18)}
      .ct-scoreboard-row.scenario.loss{background:linear-gradient(90deg,rgba(208,112,137,.055),rgba(255,255,255,.02))}
      .ct-scoreboard-row.scenario.loss .ct-scoreboard-result{color:#a65468;background:rgba(208,112,137,.09);border-color:rgba(208,112,137,.16)}
      .ct-team-scoreboard-note{margin:4px 2px 0;color:#98a5b5;font-size:.38rem;text-align:right}
      html[data-theme="dark"] .ct-team-scoreboard{background:linear-gradient(135deg,rgba(20,34,58,.44),rgba(25,42,68,.3),rgba(22,50,55,.24));border-color:rgba(116,156,215,.15);box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 24px rgba(0,0,0,.12)}
      html[data-theme="dark"] .ct-scoreboard-head{background:rgba(26,42,68,.23);border-color:rgba(116,156,215,.12)}
      html[data-theme="dark"] .ct-scoreboard-team,html[data-theme="dark"] .ct-scoreboard-row>strong{border-color:rgba(116,156,215,.11)}
      html[data-theme="dark"] .ct-scoreboard-team small,html[data-theme="dark"] .ct-scoreboard-label>small,html[data-theme="dark"] .ct-team-scoreboard-note{color:#73849b}
      html[data-theme="dark"] .ct-scoreboard-team strong{color:#c2d3e8}
      html[data-theme="dark"] .ct-scoreboard-team.you strong{color:#a9d6e3}
      html[data-theme="dark"] .ct-scoreboard-label>strong{color:#8799b1}
      html[data-theme="dark"] .ct-scoreboard-row>strong{color:#c3d4e8}
      html[data-theme="dark"] .ct-scoreboard-row.projected>strong{color:#aaa9de}
      html[data-theme="dark"] .ct-scoreboard-row.scenario>strong:first-of-type{color:#b5d9e8}
      @media(max-width:560px){
        .ct-scoreboard-head,.ct-scoreboard-row{grid-template-columns:74px minmax(0,1fr) minmax(0,1fr)}
        .ct-scoreboard-team{padding:7px 6px}.ct-scoreboard-team strong{font-size:.5rem}
        .ct-scoreboard-label{padding:7px 6px}.ct-scoreboard-label>strong{font-size:.4rem}.ct-scoreboard-label>small{font-size:.33rem}
        .ct-scoreboard-row>strong{padding:7px 5px;font-size:.69rem}.ct-scoreboard-result{font-size:.34rem;padding:3px 5px}
      }
    `;
    document.head.appendChild(style);
  }

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
    const myProjectedLeft = mine.reduce((sum,row)=>sum+row.expectedRemaining,0);
    const oppProjectedLeft = theirs.reduce((sum,row)=>sum+row.expectedRemaining,0);
    const myProjectedFinal = myScore + myProjectedLeft;
    const oppProjectedFinal = oppScore + oppProjectedLeft;
    const currentNeed = targetTenth(Math.max(0,oppScore-myScore+.01));
    const projectedNeed = targetTenth(Math.max(0,oppProjectedFinal-myScore+.01));
    const target = theirs.length ? projectedNeed : currentNeed;
    return {
      view,league,mine,theirs,myScore,oppScore,myProjectedLeft,oppProjectedLeft,
      myProjectedFinal,oppProjectedFinal,target,
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
    if (!planState.has(key)) planState.set(key,{allocations:new Map(),target:null,mode:"win"});
    const plan = planState.get(key);
    if (!plan.mode) plan.mode = "win";
    return plan;
  }

  function distributeToWin(data,plan,changedId=null,changedValue=null){
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

  function seedFree(data,plan,keepExisting=false){
    const next = new Map();
    for (const row of data.mine){
      const existing = keepExisting ? plan.allocations.get(row.id) : null;
      next.set(row.id,existing==null ? roundTenth(row.expectedRemaining) : Math.max(0,roundTenth(existing)));
    }
    plan.allocations = next;
    plan.target = data.target;
  }

  function ensurePlan(data,plan){
    const rowIds = new Set(data.mine.map(row=>row.id));
    const missing = data.mine.some(row=>!plan.allocations.has(row.id));
    const stale = [...plan.allocations.keys()].some(id=>!rowIds.has(id));

    if (plan.mode === "free"){
      if (missing || stale || !plan.allocations.size) seedFree(data,plan,true);
      plan.target = data.target;
      return;
    }

    if (plan.target!==data.target || missing || stale || !plan.allocations.size){
      plan.allocations = new Map();
      distributeToWin(data,plan);
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

  function sliderScale(row,target){
    const actual = Math.max(0,n(row.actual));
    const projectedFinal = actual + Math.max(0,n(row.expectedRemaining));
    const scenarioCeiling = actual + Math.max(.1,n(target));
    return Math.max(1,Math.ceil(Math.max(scenarioCeiling,projectedFinal*1.18)*10)/10);
  }

  function playerRow(row,target,plan){
    const allocation = n(plan.allocations.get(row.id));
    const actual = Math.max(0,n(row.actual));
    const projectedFinal = actual + Math.max(0,n(row.expectedRemaining));
    const scenarioFinal = actual + allocation;
    const axisMax = sliderScale(row,Math.max(target,allocation));
    const pct = Math.min(100,Math.max(0,(scenarioFinal/axisMax)*100));
    const currentPct = Math.min(100,Math.max(0,(actual/axisMax)*100));
    const projPct = Math.min(100,Math.max(0,(projectedFinal/axisMax)*100));
    const status = row.live ? "Live" : "Upcoming";
    const playerTone = tone(allocation,row.expectedRemaining);
    return `<div class="ct-plan-player ${playerTone}" data-player-id="${esc(row.id)}">
      <div class="ct-plan-player-head">
        ${avatar(row)}
        <div class="ct-plan-player-copy"><strong>${esc(row.name)}</strong><span>${esc(row.position)} · ${esc(row.team)} · ${status}</span></div>
        <div class="ct-plan-value-wrap"><small>Scenario</small><strong class="ct-plan-value" data-ct-assigned>${f(scenarioFinal)}</strong></div>
      </div>
      <div class="ct-plan-slider-wrap" style="--current:${currentPct}%;--proj:${projPct}%">
        <input class="ct-plan-slider" type="range" min="0" max="${axisMax}" step="0.1" value="${scenarioFinal}" style="--fill:${pct}%" data-ct-plan-slider data-player-id="${esc(row.id)}" aria-label="Final point scenario for ${esc(row.name)}">
        <span class="ct-plan-current-marker" aria-hidden="true"><i></i><b>Current ${f(actual)}</b></span>
        <span class="ct-plan-proj-marker" aria-hidden="true"><i></i><b>Proj ${f(projectedFinal)}</b></span>
      </div>
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

  function scenarioValues(data,plan){
    const additional = data.mine.reduce((sum,row)=>sum+Math.max(0,n(plan.allocations.get(row.id))),0);
    const mine = data.myScore + additional;
    const opp = data.oppProjectedFinal;
    const edge = mine-opp;
    const result = Math.abs(edge)<.05 ? "tie" : edge>0 ? "win" : "loss";
    return {additional,mine,opp,edge,result};
  }

  function resultLabel(values){
    if (values.result === "tie") return "TIE";
    const sign = values.edge>0 ? "+" : "−";
    return `${values.result.toUpperCase()} ${sign}${f(Math.abs(values.edge))}`;
  }

  function scoreboardMarkup(data,plan){
    const scenario = scenarioValues(data,plan);
    const myName = data.view?.myName || "Your team";
    const oppName = data.view?.oppName || "Opponent";
    const opponentBasis = data.theirs.length ? "Opponent scenario stays at projected finish." : "Opponent score is final.";
    return `<div class="ct-team-scoreboard">
      <div class="ct-scoreboard-head">
        <span></span>
        <div class="ct-scoreboard-team you"><small>You</small><strong title="${esc(myName)}">${esc(myName)}</strong></div>
        <div class="ct-scoreboard-team opp"><small>Opponent</small><strong title="${esc(oppName)}">${esc(oppName)}</strong></div>
      </div>
      <div class="ct-scoreboard-row current">
        <div class="ct-scoreboard-label"><strong>Current</strong><small>actual now</small></div>
        <strong>${f(data.myScore)}</strong>
        <strong>${f(data.oppScore)}</strong>
      </div>
      <div class="ct-scoreboard-row projected">
        <div class="ct-scoreboard-label"><strong>Projected</strong><small>live projection</small></div>
        <strong>${f(data.myProjectedFinal)}</strong>
        <strong>${f(data.oppProjectedFinal)}</strong>
      </div>
      <div class="ct-scoreboard-row scenario ${scenario.result}">
        <div class="ct-scoreboard-label"><strong>Your scenario</strong><span class="ct-scoreboard-result" data-ct-scenario-result>${esc(resultLabel(scenario))}</span></div>
        <strong data-ct-scenario-mine>${f(scenario.mine)}</strong>
        <strong data-ct-scenario-opp>${f(scenario.opp)}</strong>
      </div>
    </div><div class="ct-team-scoreboard-note">${esc(opponentBasis)}</div>`;
  }

  function allocationEquation(data,plan){
    return data.mine.map(row=>f(plan.allocations.get(row.id))).join(" + ");
  }

  function headerMarkup(data,plan){
    const opponentDone = data.theirs.length===0;
    const mode = plan.mode === "free" ? "free" : "win";
    const label = mode === "free" ? "Free scenario" : opponentDone ? "To win · final target" : "To win · projected target";
    const title = mode === "free"
      ? "Build any finish"
      : data.target>0 ? `Need ${f(data.target)} more` : "Already above the target";
    const detail = mode === "free"
      ? "Sliders move independently · result updates live"
      : opponentDone ? `Opponent is finished at ${f(data.oppScore)}` : `Beat opponent projected ${f(data.oppProjectedFinal)}`;
    return `<div class="ct-plan-head-simple">
      <div><span>${esc(label)}</span><strong>${esc(title)}</strong><small>${esc(detail)}</small></div>
      <div class="ct-plan-head-actions">
        <div class="ct-plan-mode" role="group" aria-label="Scenario mode">
          <button type="button" data-ct-plan-mode="win" class="${mode==="win"?"active":""}" aria-pressed="${mode==="win"}">To win</button>
          <button type="button" data-ct-plan-mode="free" class="${mode==="free"?"active":""}" aria-pressed="${mode==="free"}">Free</button>
        </div>
        <button type="button" class="ct-plan-reset" data-ct-plan-reset>Reset</button>
      </div>
    </div>`;
  }

  function plannerMarkup(data,plan){
    if (!data.mine.length){
      const text = passiveCondition(data);
      return text ? `<div class="ct-plan-passive"><strong>${esc(text)}</strong></div>` : "";
    }

    ensurePlan(data,plan);
    const equation = plan.mode === "win"
      ? `<div class="ct-plan-equation"><small>From here</small><span data-ct-plan-equation>${esc(allocationEquation(data,plan))}</span><strong>= ${f(data.target)} more</strong></div>`
      : "";

    return `<section class="ct-points-planner" data-league-id="${esc(data.view.leagueId)}" data-plan-mode="${esc(plan.mode)}">
      ${headerMarkup(data,plan)}
      ${scoreboardMarkup(data,plan)}
      <div class="ct-plan-players">${data.mine.map(row=>playerRow(row,data.target,plan)).join("")}</div>
      ${equation}
    </section>`;
  }

  function updateScenarioSummary(card,data,plan){
    const values = scenarioValues(data,plan);
    const mine = card.querySelector("[data-ct-scenario-mine]");
    const opp = card.querySelector("[data-ct-scenario-opp]");
    const result = card.querySelector("[data-ct-scenario-result]");
    const row = card.querySelector(".ct-scoreboard-row.scenario");
    if (mine) mine.textContent = f(values.mine);
    if (opp) opp.textContent = f(values.opp);
    if (result) result.textContent = resultLabel(values);
    if (row){
      row.classList.remove("win","tie","loss");
      row.classList.add(values.result);
    }
  }

  function updateInteractive(card,data,plan){
    for (const row of data.mine){
      const allocation = n(plan.allocations.get(row.id));
      const actual = Math.max(0,n(row.actual));
      const scenarioFinal = actual + allocation;
      const player = card.querySelector(`.ct-plan-player[data-player-id="${CSS.escape(row.id)}"]`);
      if (!player) continue;
      const value = player.querySelector("[data-ct-assigned]");
      if (value) value.textContent = f(scenarioFinal);
      player.classList.remove("neutral","normal","stretch","long");
      player.classList.add(tone(allocation,row.expectedRemaining));
      const slider = player.querySelector("[data-ct-plan-slider]");
      if (slider){
        const min = n(slider.min);
        const max = Math.max(min+.1,n(slider.max));
        slider.value = String(Math.min(max,Math.max(min,scenarioFinal)));
        const pct = Math.min(100,Math.max(0,((n(slider.value)-min)/(max-min))*100));
        slider.style.setProperty("--fill",`${pct}%`);
      }
    }
    const equation = card.querySelector("[data-ct-plan-equation]");
    if (equation) equation.textContent = allocationEquation(data,plan);
    updateScenarioSummary(card,data,plan);
  }

  function replacePlanner(card,data,plan){
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
      replacePlanner(card,data,plan);
    });

    document.body.classList.add("crunch-planner-ready");
  }

  function queue(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(decorate);
  }

  function init(){
    ensureScoreboardStyles();

    document.addEventListener("input",event=>{
      const slider = event.target.closest?.("[data-ct-plan-slider]");
      if (!slider) return;
      const card = slider.closest(".ct-matchup-card");
      const data = card?.__ctPlannerData;
      const plan = card?.__ctPlannerState;
      if (!card || !data || !plan) return;
      const id = String(slider.dataset.playerId);
      const row = data.mine.find(item=>String(item.id)===id);
      if (!row) return;
      const finalScenario = Math.max(n(row.actual),n(slider.value));
      const additional = Math.max(0,roundTenth(finalScenario-n(row.actual)));
      if (plan.mode === "free") plan.allocations.set(id,additional);
      else distributeToWin(data,plan,id,additional);
      updateInteractive(card,data,plan);
    });

    document.addEventListener("click",event=>{
      const modeButton = event.target.closest?.("[data-ct-plan-mode]");
      if (modeButton){
        const card = modeButton.closest(".ct-matchup-card");
        const data = card?.__ctPlannerData;
        const plan = card?.__ctPlannerState;
        if (!card || !data || !plan) return;
        const nextMode = modeButton.dataset.ctPlanMode === "free" ? "free" : "win";
        if (plan.mode === nextMode) return;
        plan.mode = nextMode;
        if (nextMode === "win"){
          plan.allocations = new Map();
          distributeToWin(data,plan);
        } else {
          seedFree(data,plan,true);
        }
        replacePlanner(card,data,plan);
        return;
      }

      const reset = event.target.closest?.("[data-ct-plan-reset]");
      if (!reset) return;
      const card = reset.closest(".ct-matchup-card");
      const data = card?.__ctPlannerData;
      const plan = card?.__ctPlannerState;
      if (!card || !data || !plan) return;
      plan.allocations = new Map();
      if (plan.mode === "free") seedFree(data,plan,false);
      else distributeToWin(data,plan);
      replacePlanner(card,data,plan);
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
