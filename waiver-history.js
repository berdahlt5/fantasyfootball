/* Top Waiver Adds — historical Sleeper waiver claims and free-agent pickups.
   Lazy-loaded so the owner dashboard stays fast. */
(function(){
  "use strict";
  const panel=document.getElementById("waiverHistoryPanel");
  if(!panel)return;
  const list=document.getElementById("waiverHistoryList");
  const note=document.getElementById("waiverHistoryNote");
  const count=document.getElementById("waiverHistoryCount");
  const leagueFilter=document.getElementById("waiverHistoryLeague");
  const seasonFilter=document.getElementById("waiverHistorySeason");
  const typeFilter=document.getElementById("waiverHistoryType");
  const sortFilter=document.getElementById("waiverHistorySort");
  const showMore=document.getElementById("waiverHistoryMore");

  let pickups=[],contexts=[],loading=false,loaded=false,showAll=false,generation=0;
  let missingWeeks=0,matchedSeasons=0,seasonTotal=0;

  const safe=value=>escapeHtml(String(value??""));
  const named=(n,singular,plural=singular+"s")=>n+" "+(n===1?singular:plural);
  const fixed=(n,d=1)=>Number(n||0).toFixed(d);
  const signed=n=>(n>0?"+":"")+fixed(n);
  const errorText=message=>'<div class="waiver-history-empty">'+safe(message)+'</div>';
  const isDynasty=view=>Number(view?.rawLeague?.settings?.type)===2;

  function seasonLineage(){
    const result=[];
    (state.leagues||[]).forEach(view=>{
      const current={leagueId:String(view.leagueId),season:String(state.season),
        rosterId:String(view.myRoster.roster_id),current:true};
      const history=(state.teamHistory.get(String(view.leagueId))||[]).map(row=>({
        leagueId:String(row.leagueId),season:String(row.season),
        rosterId:String(row.rosterId),current:String(row.leagueId)===String(view.leagueId)
      }));
      const seen=new Set();
      [current,...history].forEach(row=>{
        if(!row.leagueId||seen.has(row.leagueId))return;
        seen.add(row.leagueId);
        result.push({view,row});
      });
    });
    return result.sort((a,b)=>Number(a.row.season)-Number(b.row.season));
  }

  async function seasonTransactions(ctx) {
    const {row,view}=ctx;
    const present=Number(row.season)===Number(state.nflState?.season);
    const nflWeek=Number(state.nflState?.week || state.nflState?.display_week || 1);
    const through=present?Math.min(18,Math.max(0,nflWeek)):18;
    const weeks=Array.from({length:through+1},(_,week)=>week);
    const results=await mapWithConcurrency(weeks,4,async week=>{
      const data=await optionalJson(SLEEPER_API+"/league/"+encodeURIComponent(row.leagueId)+"/transactions/"+week);
      return {data,week};
    });
    const unique=new Map();
    results.forEach(result=>{
      if(result.status!=="fulfilled"||!Array.isArray(result.value.data)){
        // Week 0 is unsupported by some historical leagues.
        if(result.status!=="fulfilled"||result.value.week!==0)missingWeeks++;
        return;
      }
      for(const tx of result.value.data){
        if(tx?.status!=="complete")continue;
        const id=String(tx.transaction_id||row.leagueId+":"+tx.created+":"+tx.leg);
        if(!unique.has(id))unique.set(id,tx);
      }
    });
    ctx.transactions=[...unique.values()].sort((a,b)=>
      Number(a.leg||0)-Number(b.leg||0)||
      Number(a.status_updated||a.created||0)-Number(b.status_updated||b.created||0));
    if(!row.current) {
      ctx.league=await optionalJson(SLEEPER_API+"/league/"+encodeURIComponent(row.leagueId));
    } else ctx.league=view.rawLeague;
  }

  function buildPickups(){
    const found=[];
    const processedViews=new Set();
    for(const {view} of contexts){
      // Process each franchise once, even if its seasons finish loading out of order.
      if(processedViews.has(String(view.leagueId)))continue;
      processedViews.add(String(view.leagueId));
      const chain=contexts.filter(ctx=>String(ctx.view.leagueId)===String(view.leagueId))
        .sort((a,b)=>Number(a.row.season)-Number(b.row.season));
      const active=new Map();
      chain.forEach(ctx=>{
        const roster=String(ctx.row.rosterId);
        (ctx.transactions||[]).forEach(tx=>{
          const stamp={season:String(ctx.row.season),week:Number(tx.leg||0),
            time:Number(tx.status_updated||tx.created||0)};
          const drops=tx.drops||{},adds=tx.adds||{};
          const leaving=new Set(Object.entries(drops)
            .filter(([,to])=>String(to)===roster).map(([id])=>String(id)));
          // Some trades contain only destination in 'adds'; close the player
          // if our roster is a participant and another team receives them.
          if(tx.type==="trade" && (tx.roster_ids||[]).map(String).includes(roster)){
            Object.entries(adds).forEach(([id,to])=>{
              if(String(to)!==roster && active.has(String(id)))leaving.add(String(id));
            });
          }
          for(const id of leaving){
            const previous=active.get(id);
            if(previous && !previous.end)previous.end={...stamp};
            active.delete(id);
          }
          if(!["waiver","free_agent"].includes(String(tx.type)))return;
          Object.entries(adds).forEach(([id,to])=>{
            if(String(to)!==roster)return;
            const previous=active.get(String(id));
            if(previous && !previous.end)previous.end={...stamp};
            const player=getPlayer(String(id));
            const position=String(player?.position||player?.fantasy_positions?.[0]||"OTHER").toUpperCase();
            const amount=tx.settings?.waiver_bid;
            const candidate={
              id:String(ctx.row.leagueId)+":"+String(tx.transaction_id||stamp.time)+":"+String(id),
              _processedView:String(view.leagueId),
              playerId:String(id),playerName:playerName(player,id),
              position,season:String(ctx.row.season),week:stamp.week,time:stamp.time,
              leagueId:String(ctx.row.leagueId),franchiseId:String(view.leagueId),
              leagueName:String(view.name),teamName:String(view.myMeta?.name||"My team"),
              type:String(tx.type),bid:amount==null?null:Number(amount),
              start:stamp,end:null,points:0,starts:0,above:0,impact:0,playoffStarts:0,
              gamesBySeason:[],incomplete:false
            };
            found.push(candidate);active.set(String(id),candidate);
          });
        });
      });
    }
    return found;
  }

  function scoredPoints(match,playerId){
    if(!match)return null;
    const map=match.players_points||{};
    if(map[playerId]!=null && Number.isFinite(Number(map[playerId])))return Number(map[playerId]);
    const starterIndex=(match.starters||[]).map(String).indexOf(String(playerId));
    if(starterIndex>=0 && Array.isArray(match.starters_points)){
      const points=match.starters_points[starterIndex];
      if(points!=null && Number.isFinite(Number(points)))return Number(points);
    }
    return null;
  }
  function weeklyBaseline(rows){
    const byPosition=new Map();
    for(const matchup of rows||[]){
      for(const id of matchup.starters||[]){
        if(String(id)==="0"||!id)continue;
        const pos=String(getPlayer(String(id))?.position||"OTHER").toUpperCase();
        const value=scoredPoints(matchup,String(id));
        if(pos==="OTHER"||value===null)continue;
        if(!byPosition.has(pos))byPosition.set(pos,[]);
        byPosition.get(pos).push(value);
      }
    }
    const medians=new Map();
    byPosition.forEach((values,key)=>{
      values.sort((a,b)=>a-b);
      const mid=Math.floor(values.length/2);
      medians.set(key,values.length%2?values[mid]:(values[mid-1]+values[mid])/2);
    });
    return medians;
  }

  async function seasonMatchups(ctx){
    const current=Number(ctx.row.season)===Number(state.nflState?.season);
    // Only settled fantasy weeks; don't grade a currently underway game.
    const now=Number(state.nflState?.week||state.nflState?.display_week||1);
    const through=current?Math.min(18,Math.max(0,now-1)):18;
    const weeks=Array.from({length:through},(_,index)=>index+1);
    const results=await mapWithConcurrency(weeks,4,async week=>{
      const data=await optionalJson(SLEEPER_API+"/league/"+encodeURIComponent(ctx.row.leagueId)+"/matchups/"+week);
      return {week,data};
    });
    ctx.matchups=new Map();ctx.medians=new Map();
    results.forEach(result=>{
      if(result.status!=="fulfilled"||!Array.isArray(result.value.data)){
        missingWeeks++;return;
      }
      ctx.matchups.set(result.value.week,result.value.data);
      ctx.medians.set(result.value.week,weeklyBaseline(result.value.data));
    });
  }

  function compareSeasonWeek(season,week,ref){
    return Number(season)-Number(ref.season)||Number(week)-Number(ref.week);
  }

  function measure(){
    for(const pickup of pickups){
      const view=state.leagues.find(v=>String(v.leagueId)===pickup.franchiseId);
      const seasons=contexts.filter(ctx=>String(ctx.view.leagueId)===pickup.franchiseId)
        .filter(ctx=>Number(ctx.row.season)>=Number(pickup.season))
        .filter(ctx=>isDynasty(view)||String(ctx.row.season)===pickup.season)
        .sort((a,b)=>Number(a.row.season)-Number(b.row.season));
      const seasonStats=[];
      const seenStarts=new Set();
      for(const ctx of seasons){
        let starts=0,points=0,above=0,impact=0,playoffStarts=0;
        const postseason=Number(ctx.league?.settings?.playoff_week_start||
          view.rawLeague?.settings?.playoff_week_start||15);
        for(const [week,rows] of ctx.matchups||[]){
          const atStart=compareSeasonWeek(ctx.row.season,week,pickup.start);
          const afterEnd=pickup.end ? compareSeasonWeek(ctx.row.season,week,pickup.end): -1;
          if(atStart<0 || (pickup.end && afterEnd>=0))continue;
          // If a player is re-added in the same week, only the final acquisition
          // gets credit for that week's started lineup.
          const gameKey=ctx.row.leagueId+":"+week+":"+pickup.playerId;
          if(seenStarts.has(gameKey))continue;
          const team=rows.find(r=>String(r.roster_id)===String(ctx.row.rosterId));
          if(!team||(team.starters||[]).map(String).indexOf(pickup.playerId)<0)continue;
          const playerPoints=scoredPoints(team,pickup.playerId);
          if(playerPoints===null){pickup.incomplete=true;continue;}
          const baseline=ctx.medians.get(week)?.get(pickup.position);
          if(baseline==null){pickup.incomplete=true;continue;}
          seenStarts.add(gameKey);
          const extra=playerPoints-baseline;
          const playoff=week>=postseason && Number.isFinite(postseason);
          const recency=Number(ctx.row.season)===Number(state.nflState?.season)?1.12:1;
          const weighted=extra*(playoff?1.5:1)*recency;
          points+=playerPoints;above+=extra;impact+=weighted;starts++;
          if(playoff)playoffStarts++;
        }
        if(starts)seasonStats.push({season:String(ctx.row.season),starts,points,above});
        pickup.points+=points;pickup.starts+=starts;
        pickup.above+=above;pickup.impact+=impact;pickup.playoffStarts+=playoffStarts;
      }
      pickup.gamesBySeason=seasonStats;
      pickup.ppg=pickup.starts?pickup.points/pickup.starts:null;
      // A pickup contributes only when it actually produced a fantasy start.
      // Negative impact is meaningful and remains visible for below-median additions.
    }
  }

  function card(pickup,rank){
    const id=pickup.playerId;
    const face=/^[A-Za-z0-9_-]+$/.test(id)
      ?"https://sleepercdn.com/content/nfl/players/thumb/"+encodeURIComponent(id)+".jpg":null;
    const position=safe(pickup.position==="OTHER"?"NFL":pickup.position);
    const portrait=face?'<span class="waiver-headshot"><span>'+position+'</span><img src="'+face+
      '" alt="" loading="lazy" decoding="async" onerror="this.hidden=true" /></span>':
      '<span class="waiver-headshot"><span>'+position+'</span></span>';
    const when=pickup.week>0?'Week '+pickup.week:'Preseason';
    const cost=pickup.bid!=null&&Number.isFinite(pickup.bid)?' · $'+pickup.bid+' FAAB':"";
    const via=pickup.type==="waiver"?"Waiver claim":"Free-agent add";
    const stat=pickup.starts?
      '<span>'+pickup.starts+' starts</span><span>'+fixed(pickup.ppg)+' PPG</span>'+
      '<span>'+fixed(pickup.points)+' fantasy pts</span>':
      '<span>No fantasy starts recorded</span>';
    const years=pickup.gamesBySeason.map(s=>'<span class="waiver-year-stat">'+safe(s.season)+
      ': '+s.starts+' starts · '+fixed(s.points/s.starts)+' PPG</span>').join("");
    const playoff=pickup.playoffStarts?
      '<span class="waiver-playoff-stat">'+named(pickup.playoffStarts,"playoff start")+'</span>':"";
    const remark=pickup.incomplete?'<span class="waiver-footnote">Some weekly scoring data is missing.</span>':"";
    return '<article class="waiver-add-card"><div class="waiver-add-main">'+
      '<span class="waiver-add-rank">#'+rank+'</span>'+portrait+
      '<div class="waiver-add-info"><div class="waiver-add-name">'+safe(pickup.playerName)+'</div>'+
      '<div class="waiver-add-team">'+position+' · '+safe(pickup.leagueName)+'</div>'+
      '<div class="waiver-add-acquired">'+safe(pickup.season)+' · '+when+' · '+via+cost+'</div></div>'+
      '<div class="waiver-add-impact"><strong>'+signed(pickup.impact)+'</strong>'+
      '<span>adjusted impact</span></div></div>'+
      '<div class="waiver-add-stats">'+stat+playoff+'</div>'+
      (years?'<div class="waiver-add-seasons">'+years+'</div>':"")+remark+'</article>';
  }

  function render(){
    const league=leagueFilter.value||"all",season=seasonFilter.value||"all";
    const type=typeFilter.value||"all",sort=sortFilter.value||"impact";
    const filtered=pickups.filter(p=>(league==="all"||p.franchiseId===league)
      &&(season==="all"||p.season===season)
      &&(type==="all"||p.type===type));
    filtered.sort((a,b)=>{
      let difference=0;
      if(sort==="points")difference=b.points-a.points;
      else if(sort==="starts")difference=b.starts-a.starts;
      else if(sort==="ppg")difference=(b.ppg??-Infinity)-(a.ppg??-Infinity);
      else difference=b.impact-a.impact;
      return difference||b.starts-a.starts||b.points-a.points||b.time-a.time;
    });
    count.textContent=loading?'Searching franchise seasons…':
      named(filtered.length,"pickup")+" found · "+named(filtered.filter(p=>p.starts>0).length,"played pickup");
    if(loading && !pickups.length){list.innerHTML=errorText("Scanning completed waiver claims and free-agent pickups…");showMore.hidden=true;return;}
    const visible=showAll?filtered:filtered.slice(0,10);
    list.innerHTML=visible.length?visible.map((p,index)=>card(p,index+1)).join(""):
      errorText(loading?"Scanning transactions…":"No pickups match the selected filters.");
    showMore.hidden=filtered.length<=10;
    showMore.textContent=showAll?"Show top 10":"Show all "+filtered.length+" pickups";
  }

  function populateFilters(){
    const previousLeague=leagueFilter.value||"all";
    const previousYear=seasonFilter.value||"all";
    leagueFilter.innerHTML='<option value="all">All teams</option>'+
      (state.leagues||[]).map(view=>'<option value="'+safe(view.leagueId)+'">'+safe(view.name)+'</option>').join("");
    const years=[...new Set(pickups.map(p=>p.season))].sort((a,b)=>Number(b)-Number(a));
    seasonFilter.innerHTML='<option value="all">All seasons</option>'+
      years.map(season=>'<option value="'+safe(season)+'">'+safe(season)+'</option>').join("");
    if([...leagueFilter.options].some(o=>o.value===previousLeague))leagueFilter.value=previousLeague;
    if([...seasonFilter.options].some(o=>o.value===previousYear))seasonFilter.value=previousYear;
  }

  async function load(){
    if(loading||loaded||!panel.open||!state.user||!state.leagues?.length)return;
    if(!state.historyLoaded){
      list.innerHTML=errorText("Franchise history is loading. Waiver history will start when it is ready.");
      return;
    }
    const run=++generation;loading=true;showAll=false;pickups=[];contexts=[];
    missingWeeks=0;matchedSeasons=0;
    const lineage=seasonLineage();seasonTotal=lineage.length;
    note.textContent="Loading pickups from "+named(seasonTotal,"franchise season")+"…";
    render();
    const results=await mapWithConcurrency(lineage,2,async entry=>{
      const ctx={...entry,transactions:[],matchups:new Map(),medians:new Map(),league:null};
      if(run!==generation)return null;
      await seasonTransactions(ctx);
      if(run!==generation)return null;
      contexts.push(ctx);
      matchedSeasons++;
      count.textContent="Scanned "+matchedSeasons+" of "+seasonTotal+" seasons…";
      return ctx;
    });
    if(run!==generation)return;
    const failedSeasons=results.filter(r=>r.status!=="fulfilled").length;
    missingWeeks+=failedSeasons;
    pickups=buildPickups();
    // Only fetch lineups for franchise-years that could contain post-add starts.
    const needed=contexts.filter(ctx=>pickups.some(p=>
      String(p.franchiseId)===String(ctx.view.leagueId)&&
      Number(ctx.row.season)>=Number(p.season)&&
      (isDynasty(ctx.view)||String(ctx.row.season)===p.season)));
    if(needed.length){
      note.textContent="Measuring "+named(pickups.length,"pickup")+" against league starters…";
      await mapWithConcurrency(needed,2,async ctx=>{if(run!==generation)return;await seasonMatchups(ctx);});
    }
    if(run!==generation)return;
    measure();
    loading=false;loaded=true;
    populateFilters();
    note.textContent="Top pickups ranked by actual lineup impact after you added them."+
      (missingWeeks?" Some weeks were unavailable, so results may be incomplete.":"");
    render();
  }

  function reset(){
    generation++;loading=false;loaded=false;showAll=false;pickups=[];contexts=[];
    missingWeeks=0;matchedSeasons=0;seasonTotal=0;
    leagueFilter.value="all";seasonFilter.value="all";typeFilter.value="all";sortFilter.value="impact";
    leagueFilter.innerHTML='<option value="all">All teams</option>';
    seasonFilter.innerHTML='<option value="all">All seasons</option>';
    note.textContent="Find your best waiver claims and free-agent steals across Sleeper seasons.";
    count.textContent="";
    list.innerHTML=errorText("Load the dashboard, then open Top Waiver Adds.");
    showMore.hidden=true;
  }

  panel.addEventListener("toggle",()=>{if(panel.open)load();});
  [leagueFilter,seasonFilter,typeFilter,sortFilter].forEach(el=>
    el.addEventListener("change",()=>{showAll=false;render();}));
  showMore.addEventListener("click",()=>{showAll=!showAll;render();});
  window.addEventListener("fantasy-dashboard-reset",reset);
  window.addEventListener("fantasy-owner-history-ready",()=>{if(panel.open)load();});
})();