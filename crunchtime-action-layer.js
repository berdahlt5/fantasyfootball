(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html") return;

  let queued = false;
  let lastSignature = "";

  const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmt = value => num(value).toFixed(1);

  function matchupRows(view){
    try {
      return {
        mine: remainingRows(view?.myMatchup) || [],
        opp: remainingRows(view?.oppMatchup) || []
      };
    } catch (_) {
      return {mine:[],opp:[]};
    }
  }

  function winCondition(view){
    const my = view?.myMatchup;
    const opp = view?.oppMatchup;
    if (!my || !opp) return null;
    const rows = matchupRows(view);
    const mine = rows.mine.length;
    const theirs = rows.opp.length;
    const margin = num(my.points) - num(opp.points);

    if (!mine && !theirs){
      return {
        kind:"final",
        label:margin>0?"FINAL WIN":margin<0?"FINAL LOSS":"FINAL TIE",
        text:`Final score: ${fmt(my.points)}–${fmt(opp.points)}.`,
        rows
      };
    }

    if (mine===1 && !theirs){
      const row = rows.mine[0];
      if (margin < 0){
        const need = Math.abs(margin) + .01;
        const total = num(row.points) + need;
        return {
          kind:"need",
          label:`NEED +${fmt(need)}`,
          text:`${row.name} needs about ${fmt(need)} more points (${fmt(total)} total) to move you ahead.`,
          rows
        };
      }
      return {
        kind:"safe",
        label:`UP ${fmt(margin)}`,
        text:`Only ${row.name} remains for you. Any additional scoring adds to your ${fmt(margin)}-point cushion.`,
        rows
      };
    }

    if (!mine && theirs===1){
      const row = rows.opp[0];
      if (margin > 0){
        const limit = num(row.points) + margin;
        return {
          kind:"hold",
          label:`HOLD < ${fmt(limit)}`,
          text:`Hold ${row.name} below about ${fmt(limit)} total points. That means fewer than ${fmt(margin)} more from here.`,
          rows
        };
      }
      return {
        kind:"miracle",
        label:"NEED NEGATIVE PTS",
        text:`You trail by ${fmt(Math.abs(margin))} and only ${row.name} remains for your opponent. You need negative scoring or a stat correction.`,
        rows
      };
    }

    if (mine===1 && theirs===1){
      const me = rows.mine[0];
      const them = rows.opp[0];
      if (margin < 0){
        const need = Math.abs(margin) + .01;
        return {
          kind:"need",
          label:`OUTSCORE +${fmt(need)}`,
          text:`From here, ${me.name} needs to outscore ${them.name} by more than ${fmt(Math.abs(margin))} points.`,
          rows
        };
      }
      return {
        kind:"hold",
        label:`CAN ALLOW ${fmt(margin)}`,
        text:`From here, ${me.name} can be outscored by about ${fmt(margin)} points by ${them.name} and you still hold the lead.`,
        rows
      };
    }

    if (mine && !theirs){
      const need = Math.max(0,-margin+.01);
      if (need > 0){
        return {
          kind:"need",
          label:`NEED +${fmt(need)} COMBINED`,
          text:`Your ${mine} remaining starters need about ${fmt(need)} more combined points to move you ahead.`,
          rows
        };
      }
      return {
        kind:"safe",
        label:`UP ${fmt(margin)}`,
        text:`You lead by ${fmt(margin)} and only your players remain.`,
        rows
      };
    }

    if (!mine && theirs){
      if (margin > 0){
        return {
          kind:"hold",
          label:`ALLOW < ${fmt(margin)} MORE`,
          text:`Your opponent's ${theirs} remaining starters must combine for fewer than ${fmt(margin)} more points for you to hold on.`,
          rows
        };
      }
      return {
        kind:"miracle",
        label:"NO POSITIVE PATH",
        text:`You trail by ${fmt(Math.abs(margin))} with only opponent starters remaining.`,
        rows
      };
    }

    if (margin < 0){
      const need = Math.abs(margin) + .01;
      return {
        kind:"need",
        label:`WIN REMAINING BY +${fmt(need)}`,
        text:`Your remaining group must outscore the opponent's remaining group by more than ${fmt(Math.abs(margin))} points from here.`,
        rows
      };
    }

    return {
      kind:"hold",
      label:`CAN LOSE REMAINING BY ${fmt(margin)}`,
      text:`Your remaining group can be outscored by about ${fmt(margin)} points from here and you still stay ahead.`,
      rows
    };
  }

  function urgency(view,rows){
    const margin = Math.abs(num(view?.myMatchup?.points)-num(view?.oppMatchup?.points));
    const all = [...rows.mine,...rows.opp];
    const live = all.some(row=>String(row?.game?.state || "").toLowerCase()==="in");
    let score = 100 - Math.min(70,margin*4);
    if (live) score += 45;
    if (all.length <= 3) score += 12;
    return score;
  }

  function gameTeams(gameId){
    const teams = [];
    try {
      for (const [team,game] of state.games.entries()){
        if (String(game?.id || "")===String(gameId) && !teams.includes(team)) teams.push(team);
      }
    } catch (_) {}
    return teams;
  }

  function buildGameGroups(){
    const groups = new Map();
    let views = [];
    try { views = Array.isArray(state?.leagues) ? state.leagues : []; } catch (_) {}

    for (const view of views){
      const condition = winCondition(view);
      if (!condition || condition.kind === "final") continue;
      const rows = condition.rows;
      const all = [...rows.mine.map(row=>({...row,side:"mine"})),...rows.opp.map(row=>({...row,side:"opp"}))];
      const perLeagueGames = new Set();

      for (const row of all){
        const id = String(row?.game?.id || "");
        if (!id) continue;
        if (!groups.has(id)) groups.set(id,{
          id,
          game:row.game,
          teams:gameTeams(id),
          leagues:new Set(),
          players:new Map(),
          score:0,
          live:false
        });
        const group = groups.get(id);
        group.leagues.add(String(view.name || "League"));
        group.live = group.live || String(row?.game?.state || "").toLowerCase()==="in";
        if (!perLeagueGames.has(id)){
          group.score += urgency(view,rows);
          perLeagueGames.add(id);
        }

        if (!group.players.has(String(row.id))) group.players.set(String(row.id),{
          id:String(row.id),
          name:String(row.name || "NFL Player"),
          team:String(row.team || ""),
          position:String(row.position || ""),
          forLeagues:new Set(),
          againstLeagues:new Set(),
          appearances:0
        });
        const player = group.players.get(String(row.id));
        player.appearances += 1;
        if (row.side === "mine") player.forLeagues.add(String(view.name || "League"));
        else player.againstLeagues.add(String(view.name || "League"));
      }
    }

    return [...groups.values()].sort((a,b)=>Number(b.live)-Number(a.live) || b.score-a.score || b.leagues.size-a.leagues.size);
  }

  function playerAvatar(player){
    const initials = esc(String(player.name || "").split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase());
    return `<span class="ct-root-photo"><img src="https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(player.id)}.jpg" alt="" loading="lazy" onerror="this.remove()"><span>${initials}</span></span>`;
  }

  function rootingChip(player){
    const helps = player.forLeagues.size;
    const hurts = player.againstLeagues.size;
    let direction = "ROOT FOR";
    let tone = "for";
    let sub = `${helps} league${helps===1?"":"s"}`;
    if (helps && hurts){
      direction = "CONFLICT";
      tone = "conflict";
      sub = `${helps} helps · ${hurts} hurts`;
    } else if (hurts){
      direction = "ROOT AGAINST";
      tone = "against";
      sub = `${hurts} league${hurts===1?"":"s"}`;
    }
    return `<span class="ct-root-player ${tone}">${playerAvatar(player)}<span class="ct-root-player-copy"><strong>${esc(player.name)}</strong><small>${direction} · ${sub}</small></span></span>`;
  }

  function rootingGuide(){
    const groups = buildGameGroups().slice(0,3);
    if (!groups.length) return "";
    return `<section class="ct-rooting-guide">
      <div class="ct-rooting-head"><div><span>Cross-league rooting guide</span><strong>What NFL games actually matter to you</strong></div><small>Same player helping and hurting you is flagged as a conflict.</small></div>
      <div class="ct-rooting-grid">${groups.map((group,index)=>{
        const players = [...group.players.values()].sort((a,b)=>b.appearances-a.appearances || a.name.localeCompare(b.name));
        const shown = players.slice(0,4);
        const extra = Math.max(0,players.length-shown.length);
        const teams = group.teams.length ? group.teams.join(" · ") : "NFL game";
        const status = group.game?.detail || (group.live?"Live":"Upcoming");
        return `<article class="ct-root-game ${group.live?"live":""}">
          <div class="ct-root-game-top"><span class="ct-root-rank">${index+1}</span><div><strong>${esc(teams)}</strong><small>${esc(status)} · impacts ${group.leagues.size} league${group.leagues.size===1?"":"s"}</small></div>${group.live?'<b>LIVE</b>':''}</div>
          <div class="ct-root-players">${shown.map(rootingChip).join("")}${extra?`<span class="ct-root-more">+${extra} more</span>`:""}</div>
        </article>`;
      }).join("")}</div>
    </section>`;
  }

  function decorateCards(){
    const command = document.getElementById("crunchTimeCommandCenter");
    if (!command) return;
    let views = [];
    try { views = Array.isArray(state?.leagues) ? state.leagues : []; } catch (_) {}
    const byName = new Map(views.map(view=>[String(view.name || ""),view]));

    for (const card of command.querySelectorAll(".ct-matchup-card")){
      const leagueName = String(card.querySelector(".ct-league-name")?.textContent || "").trim();
      const view = byName.get(leagueName);
      if (!view) continue;
      const condition = winCondition(view);
      if (!condition) continue;

      let panel = card.querySelector(".ct-win-condition");
      if (!panel){
        panel = document.createElement("div");
        panel.className = "ct-win-condition";
        const top = card.querySelector(".ct-card-top");
        if (top) top.insertAdjacentElement("afterend",panel);
        else card.prepend(panel);
      }
      panel.className = `ct-win-condition ${condition.kind}`;
      const html = `<span>Win condition</span><strong>${esc(condition.label)}</strong><p>${esc(condition.text)}</p>`;
      if (panel.innerHTML !== html) panel.innerHTML = html;

      const outlookLabel = card.querySelector(".ct-action > span");
      if (outlookLabel) outlookLabel.textContent = "Projection outlook";
    }

    let guide = command.querySelector(".ct-rooting-guide");
    const markup = rootingGuide();
    if (!markup){
      if (guide) guide.remove();
      return;
    }
    const temp = document.createElement("div");
    temp.innerHTML = markup;
    const nextGuide = temp.firstElementChild;
    if (!guide){
      const hero = command.querySelector(".ct-hero");
      if (hero) hero.insertAdjacentElement("afterend",nextGuide);
      else command.prepend(nextGuide);
    } else if (guide.outerHTML !== nextGuide.outerHTML){
      guide.replaceWith(nextGuide);
    }
  }

  function signature(){
    try {
      return (state.leagues || []).map(view=>{
        const rows = matchupRows(view);
        const ids = [...rows.mine,...rows.opp].map(row=>`${row.id}:${fmt(row.points)}:${row.game?.state||""}:${row.game?.completed?1:0}`).join(",");
        return `${view.leagueId}:${fmt(view.myMatchup?.points)}:${fmt(view.oppMatchup?.points)}:${ids}`;
      }).join("|");
    } catch (_) { return ""; }
  }

  function apply(){
    queued = false;
    const command = document.getElementById("crunchTimeCommandCenter");
    if (!command?.querySelector(".ct-matchup-card")) return;
    const sig = signature();
    if (sig === lastSignature && command.querySelector(".ct-rooting-guide") && command.querySelector(".ct-win-condition")) return;
    lastSignature = sig;
    decorateCards();
  }

  function queue(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  function init(){
    queue();
    const observer = new MutationObserver(mutations=>{
      if (mutations.some(m=>m.addedNodes.length || m.removedNodes.length)) queue();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    setInterval(queue,5000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded",init,{once:true});
})();
