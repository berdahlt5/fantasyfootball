(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  function style(id,href){
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function script(id,src){
    if (document.getElementById(id)) return;
    const node = document.createElement("script");
    node.id = id;
    node.src = src;
    node.async = false;
    document.head.appendChild(node);
  }

  function loadCurrentHubAssets(){
    style("gameDayPulsePolishStyles","./gameday-pulse-polish.css?v=20260913b");
    style("gameDayPulseWindowStyles","./gameday-pulse-windows.css?v=20260913a");
    style("gameDayPulseActualStyles","./gameday-pulse-actual.css?v=20260913a");
    style("gameDayScoreboardGlassStyles","./gameday-scoreboard-glass.css?v=20260913a");
    style("gameDayMatchupFootprintStyles","./gameday-matchup-footprint.css?v=20260913a");

    script("gameDayPlayerPulseScript","./gameday-player-pulse-windowed.js?v=20260913a");
    script("gameDayPulsePolishScript","./gameday-pulse-polish.js?v=20260913b");
    script("gameDayPulseActualScript","./gameday-pulse-actual.js?v=20260913a");
    script("gameDayHubDetailsScript","./gameday-hub-details.js?v=20260913a");
    script("gameDayWatchRelevanceScript","./gameday-watch-relevance-v2.js?v=20260913a");
  }

  if (document.head) loadCurrentHubAssets();
  else document.addEventListener("DOMContentLoaded",loadCurrentHubAssets,{once:true});
})();
