(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "schedule-tool.html") return;

  function loadStablePulse(){
    if (document.getElementById("gameDayPlayerPulseScript")) return;
    const script = document.createElement("script");
    script.id = "gameDayPlayerPulseScript";
    script.src = "./gameday-player-pulse.js?v=20260913a";
    script.async = false;
    document.head.appendChild(script);
  }

  if (document.head) loadStablePulse();
  else document.addEventListener("DOMContentLoaded", loadStablePulse, {once:true});
})();
