(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html") return;

  const API = "https://api.sleeper.app/v1";
  const PROJECTIONS = "https://api.sleeper.com/projections/nfl";
  const FILTER_KEY = "fantasyCrunchTimeFilter";
  const TEAM_ALIASES = {JAC:"JAX",WSH:"WAS",OAK:"LV",SD:"LAC",STL:"LAR"};
  const leagueMetaCache = new Map();
  const projectionCache = new Map();
  let renderToken = 0;
  let renderTimer = null;
  let installed = false;

  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const f = value => n(value).toFixed(1);
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function normalizeTeam(value){
    const team = String(value || "").toUpperCase();
    return TEAM_ALIASES[team] || team;
  }

  async function json(url, cache="force-cache"){
    const response = await fetch(url,{cache});
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  function readFilter(){
    try {
      const value = localStorage.getItem(FILTER_KEY) || "priority";
      return ["priority","all","final"].includes(value) ? value : "priority";
    } catch (_) { return "priority"; }
  }

  function writeFilter(value){
    try { localStorage.setItem(FILTER_KEY,value); } catch (_) {}
  }

  function mount(){
    let host = document.getElementById("crunchTimeCommandCenter");
    if (!host){
      host = document.createElement("section");
      host.id = "crunchTimeCommandCenter";
      host.className = "ct-command-center";
      host.setAttribute("aria-live","polite");
      const error = document.getElementById("errorBox");
      if (error?.parentNode) error.insertAdjacentElement("afterend",host);
      else document.querySelector("main.shell,main")?.appendChild(host);
    }
    return host;
  }

  function projectionMap(rows){
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []){
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
      if (!Number.isFinite(multiplier) || multiplier === 0 || !Number.isFinite(stat)) continue;
      total += stat * multiplier;
      matched += 1;
    }
    if (matched > 0 && Number.isFinite(total) && total !== 0) return Math.max(0,total);
    const rec = Number(scoring.rec || 0);
    const fallback = rec >= .75 ? row.pts_ppr : rec >= .25 ? row.pts_half_ppr : row.pts_std;
    if (Number.isFinite(Number(fallback))) return Math.max(0,Number(fallback));
    for (const key of ["pts_ppr","pts_half_ppr","pts_std"]){
      if (Number.isFinite(Number(row?.[key]))) return Math.max(0,Number(row[key]));
    }
    return 0;
  }

  function getLeagueMeta(id){
    const key = String(id || "");
    if (!leagueMetaCache.has(key)){
      leagueMetaCache.set(key,json(`${API}/league/${encodeURIComponent(key)}`).catch(()=>({league_id:key,scoring_settings:{rec:1}})));
    }
    return leagueMetaCache.get(key);
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
    try {
      return state?.games?.get?.(normalizeTeam(player?.team)) || null;
    } catch (_) { return null; }
  }

  function playerName(player,id){
    return player?.full_name || [player?.first_name,player?.last_name].filter(Boolean).join(" ") || `Player ${id}`;
  }

  function remainingPlayers(matchup,league,projections,side){
    const starters = Array.isArray(matchup?.starters) ? matchup.starters : [];
    return starters.map(rawId=>{
      const id = String(rawId);
      let player = {};
      try { player = state?.players?.[id] || {}; } catch (_) {}
      const game = gameForPlayer(player);
      if (!game || game.completed) return null;
      const actual = n(matchup?.players_points?.[id]);
      const projected = projectionPoints(projections.get(id),league);
      const isLive = String(game?.state || "").toLowerCase() === "in";
      const expectedRemaining = isLive ? Math.max(0,projected-actual) : Math.max(0,projected);
      return {
        id,
        side,
        name:playerName(player,id),
        team:normalizeTeam(player?.team) || "FA",
        position:String(player?.position || "—").toUpperCase(),
        actual,
        projected,
        expectedRemaining,
        game,
        isLive
      };
    }).filter(Boolean);
  }

  function shortName(name){
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return name || "Player";
    return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
  }

  function actionText(item){
    if (item.final) return `Final: ${f(item.myScore)}–${f(item.oppScore)}${item.margin>0?" win":item.margin<0?" loss":" tie"}.`;
    const margin = item.margin;
    const edge = item.projectedEdge;
    if (margin < 0 && edge >= 0){
      return `Comeback path: down ${f(Math.abs(margin))}, but your remaining players project to swing this matchup back in your favor.`;
    }
    if (margin > 0 && edge < 0){
      return `Lead at risk: up ${f(margin)} now, but the remaining projection currently favors your opponent.`;
    }
    if (margin < 0){
      return `Need +${f(Math.abs(margin)+0.01)} net points from here just to get ahead; projected finish still has you behind by ${f(Math.abs(edge))}.`;
    }
    if (margin > 0){
      return `Protect a ${f(margin)}-point cushion from here; projected finish has you ${edge>=0?`ahead by ${f(edge)}`:`behind by ${f(Math.abs(edge))}`}.`;
    }
    return `Dead even right now; projected finish gives ${edge>=0?"you":"your opponent"} a ${f(Math.abs(edge))}-point edge.`;
  }

  function classify(item){
    if (item.final) return {key:"final",label:"Final",tone:item.margin>=0?"good":"bad"};
    const absEdge = Math.abs(item.projectedEdge);
    if (absEdge <= 5) return {key:"tossup",label:"Toss-up",tone:"hot"};
    if (item.projectedEdge < -5) return {key:"chase",label:"Chasing",tone:"bad"};
    if (item.projectedEdge >= 12) return {key:"control",label:"In control",tone:"good"};
    return {key:"edge",label:"Your edge",tone:"watch"};
  }

  function urgency(item){
    if (item.final) return -1000;
    let score = 100 - Math.min(80,Math.abs(item.projectedEdge)*5);
    if (item.liveCount) score += 18;
    if (item.remainingCount <= 3) score += 10;
    if (Math.abs(item.margin) <= 8) score += 10;
    if (item.projectedEdge < 0) score += 7;
    return score;
  }

  function buildItem(view,league,projections){
    const my = view?.myMatchup;
    const opp = view?.oppMatchup;
    if (!my || !opp) return null;
    const myRows = remainingPlayers(my,league,projections,"mine");
    const oppRows = remainingPlayers(opp,league,projections,"opp");
    const rows = [...myRows,...oppRows];
    const myScore = n(my.points);
    const oppScore = n(opp.points);
    const margin = myScore-oppScore;
    const myRemaining = myRows.reduce((sum,row)=>sum+row.expectedRemaining,0);
    const oppRemaining = oppRows.reduce((sum,row)=>sum+row.expectedRemaining,0);
    const myFinish = myScore + myRemaining;
    const oppFinish = oppScore + oppRemaining;
    const projectedEdge = myFinish-oppFinish;
    const final = rows.length===0;
    const liveCount = rows.filter(row=>row.isLive).length;
    const distinctGames = new Set(rows.map(row=>row.game?.id).filter(Boolean)).size;
    const item = {
      view,league,my,opp,myRows,oppRows,rows,
      myScore,oppScore,margin,myRemaining,oppRemaining,myFinish,oppFinish,projectedEdge,
      final,liveCount,distinctGames,remainingCount:rows.length
    };
    item.classification = classify(item);
    item.urgency = urgency(item);
    item.action = actionText(item);
    item.swing = [...rows].sort((a,b)=>b.expectedRemaining-a.expectedRemaining).slice(0,3);
    return item;
  }

  function avatar(row){
    const initials = esc(row.name.split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase());
    return `<span class="ct-player-photo"><img src="https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(row.id)}.jpg" alt="" loading="lazy" onerror="this.remove()"><span>${initials}</span></span>`;
  }

  function playerDetail(row){
    const status = row.game?.detail || (row.isLive?"Live":"Upcoming");
    return `<div class="ct-detail-player">
      ${avatar(row)}
      <div class="ct-detail-copy"><strong>${esc(row.name)}</strong><span>${esc(row.position)} · ${esc(row.team)} · ${esc(status)}</span></div>
      <div class="ct-detail-score"><strong>${f(row.actual)}</strong><span>now</span></div>
      <div class="ct-detail-score projected"><strong>${f(row.expectedRemaining)}</strong><span>exp. left</span></div>
    </div>`;
  }

  function detailsSide(title,rows){
    return `<div class="ct-detail-side"><div class="ct-detail-title">${esc(title)} · ${rows.length}</div>${rows.length?rows.map(playerDetail).join(""):'<div class="ct-detail-empty">No remaining starters.</div>'}</div>`;
  }

  function swingChip(row){
    const label = row.side === "mine" ? "YOU" : "OPP";
    return `<span class="ct-swing-chip ${row.side}">${avatar(row)}<span><strong>${esc(shortName(row.name))}</strong><small>${label} · ${f(row.expectedRemaining)} exp. left</small></span></span>`;
  }

  function card(item,index){
    const c = item.classification;
    const marginLabel = item.margin>0?`+${f(item.margin)}`:f(item.margin);
    const edgeLabel = item.projectedEdge>0?`+${f(item.projectedEdge)}`:f(item.projectedEdge);
    const liveLabel = item.liveCount ? `${item.liveCount} live` : item.final ? "Complete" : `${item.remainingCount} left`;
    return `<article class="ct-matchup-card ${c.tone}" data-ct-status="${c.key}">
      <div class="ct-card-top">
        <div class="ct-rank">${index+1}</div>
        <div class="ct-league-copy"><div class="ct-league-name">${esc(item.view.name)}</div><div class="ct-team-line">${esc(item.view.myName)} vs ${esc(item.view.oppName)}</div></div>
        <span class="ct-status-pill ${c.tone}">${esc(c.label)}</span>
      </div>

      <div class="ct-score-strip">
        <div><span>Current</span><strong>${f(item.myScore)} <em>–</em> ${f(item.oppScore)}</strong><small>margin ${marginLabel}</small></div>
        <div><span>Projected finish</span><strong>${f(item.myFinish)} <em>–</em> ${f(item.oppFinish)}</strong><small>edge ${edgeLabel}</small></div>
        <div><span>Remaining</span><strong>${liveLabel}</strong><small>${item.distinctGames} NFL game${item.distinctGames===1?"":"s"}</small></div>
      </div>

      <div class="ct-action ${c.tone}"><span>What matters</span><strong>${esc(item.action)}</strong></div>

      ${item.swing.length?`<div class="ct-swing-row"><span class="ct-swing-label">Swing players</span><div class="ct-swing-chips">${item.swing.map(swingChip).join("")}</div></div>`:""}

      <details class="ct-details">
        <summary>Show remaining-player detail</summary>
        <div class="ct-detail-grid">${detailsSide("Your starters",item.myRows)}${detailsSide("Opponent starters",item.oppRows)}</div>
      </details>
    </article>`;
  }

  function hero(items){
    const active = items.filter(item=>!item.final);
    const tossups = active.filter(item=>Math.abs(item.projectedEdge)<=5).length;
    const behind = active.filter(item=>item.projectedEdge<0).length;
    const ahead = active.filter(item=>item.projectedEdge>=0).length;
    const finals = items.filter(item=>item.final).length;
    const top = active[0];
    const lead = !top
      ? "No active matchups need attention right now."
      : `${top.view.name}: ${top.action}`;
    return `<div class="ct-hero">
      <div class="ct-hero-copy"><div class="ct-eyebrow">Decision-first gameday view</div><h2>Crunch Time Command Center</h2><p>${esc(lead)}</p></div>
      <div class="ct-hero-metrics">
        <div><strong>${active.length}</strong><span>Active</span></div>
        <div><strong>${tossups}</strong><span>Toss-ups</span></div>
        <div><strong>${behind}</strong><span>Projected behind</span></div>
        <div><strong>${finals}</strong><span>Final</span></div>
      </div>
    </div>
    <div class="ct-toolbar">
      <div class="ct-toolbar-copy"><strong>${ahead} projected ahead</strong><span>Sorted by urgency, not league order.</span></div>
      <div class="ct-filter" role="group" aria-label="Crunch Time matchup filter">
        <button type="button" data-ct-filter="priority">Priority</button>
        <button type="button" data-ct-filter="all">All matchups</button>
        <button type="button" data-ct-filter="final">Final</button>
      </div>
    </div>`;
  }

  function filteredItems(items,filter){
    if (filter === "final") return items.filter(item=>item.final);
    if (filter === "all") return items;
    const active = items.filter(item=>!item.final);
    const priority = active.filter(item=>item.projectedEdge<0 || Math.abs(item.projectedEdge)<=10 || item.liveCount);
    return priority.length ? priority : active;
  }

  function applyFilterState(host,filter){
    for (const button of host.querySelectorAll("[data-ct-filter]")){
      const active = button.dataset.ctFilter === filter;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",active?"true":"false");
    }
  }

  async function renderCommandCenter(){
    const token = ++renderToken;
    const host = mount();
    let views = [];
    let season = "";
    let week = 1;
    try {
      views = Array.isArray(state?.leagues) ? state.leagues : [];
      season = String(state?.season || document.getElementById("season")?.value || new Date().getFullYear());
      week = Number(state?.week || document.getElementById("week")?.value || 1);
    } catch (_) {}

    if (!views.length){
      host.innerHTML = `<div class="ct-loading"><strong>Building the decision view…</strong><span>Waiting for your live matchup data.</span></div>`;
      return;
    }

    host.innerHTML = `<div class="ct-loading"><strong>Prioritizing your matchups…</strong><span>Applying league scoring and remaining-player projections.</span></div>`;

    try {
      const [projections,metas] = await Promise.all([
        getProjections(season,week),
        Promise.all(views.map(view=>getLeagueMeta(view.leagueId)))
      ]);
      if (token !== renderToken) return;
      const items = views.map((view,index)=>buildItem(view,metas[index],projections)).filter(Boolean).sort((a,b)=>b.urgency-a.urgency || Math.abs(a.projectedEdge)-Math.abs(b.projectedEdge));
      const filter = readFilter();
      const visible = filteredItems(items,filter);
      host.innerHTML = `${hero(items)}<div class="ct-priority-list">${visible.length?visible.map(card).join(""):'<div class="ct-empty-state">Nothing matches this filter right now.</div>'}</div><div class="ct-method-note">Projected finish = current score + remaining Sleeper projection under each league’s scoring settings. Live players use projected points still remaining, floored at zero.</div>`;
      applyFilterState(host,filter);
      document.body.classList.add("crunch-v2-ready");
    } catch (error){
      host.innerHTML = `<div class="ct-loading error"><strong>Couldn’t build the priority view.</strong><span>${esc(error?.message || "Projection data could not be loaded.")}</span></div>`;
    }
  }

  function scheduleRender(delay=80){
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderCommandCenter,delay);
  }

  function install(){
    if (installed) return true;
    try {
      if (typeof render !== "function") return false;
      const baseRender = render;
      render = function(...args){
        const result = baseRender.apply(this,args);
        scheduleRender();
        return result;
      };
      installed = true;
    } catch (_) { return false; }

    const host = mount();
    host.addEventListener("click",event=>{
      const button = event.target.closest("[data-ct-filter]");
      if (!button) return;
      const next = button.dataset.ctFilter;
      if (!["priority","all","final"].includes(next)) return;
      writeFilter(next);
      scheduleRender(0);
    });
    scheduleRender(0);
    return true;
  }

  if (!install()){
    let attempts = 0;
    const timer = setInterval(()=>{
      attempts += 1;
      if (install() || attempts > 40) clearInterval(timer);
    },100);
  }
})();
