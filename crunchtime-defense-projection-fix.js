(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "crunchtime.html" || window.__crunchDefenseProjectionFix) return;
  window.__crunchDefenseProjectionFix = true;

  const originalFetch = window.fetch.bind(window);
  const POINT_BUCKETS = [
    "pts_allow_0",
    "pts_allow_1_6",
    "pts_allow_7_13",
    "pts_allow_14_20",
    "pts_allow_21_27",
    "pts_allow_28_34",
    "pts_allow_35p"
  ];
  const YARD_BUCKETS = [
    "yds_allow_0_100",
    "yds_allow_100_199",
    "yds_allow_200_299",
    "yds_allow_300_349",
    "yds_allow_350_399",
    "yds_allow_400_449",
    "yds_allow_450_499",
    "yds_allow_500p"
  ];

  function playerPosition(row){
    return String(row?.position || row?.player?.position || row?.player_position || "").toUpperCase();
  }

  function isDefense(row){
    if (playerPosition(row) === "DEF") return true;
    const id = String(row?.player_id || row?.player?.player_id || "").toUpperCase();
    return /^[A-Z]{2,3}$/.test(id) && row?.stats && (row.stats.pts_allow != null || row.stats.yds_allow != null);
  }

  function pointBucket(value){
    const points = Number(value);
    if (!Number.isFinite(points)) return "";
    if (points <= 0) return "pts_allow_0";
    if (points <= 6) return "pts_allow_1_6";
    if (points <= 13) return "pts_allow_7_13";
    if (points <= 20) return "pts_allow_14_20";
    if (points <= 27) return "pts_allow_21_27";
    if (points <= 34) return "pts_allow_28_34";
    return "pts_allow_35p";
  }

  function yardBucket(value){
    const yards = Number(value);
    if (!Number.isFinite(yards)) return "";
    if (yards <= 100) return "yds_allow_0_100";
    if (yards <= 199) return "yds_allow_100_199";
    if (yards <= 299) return "yds_allow_200_299";
    if (yards <= 349) return "yds_allow_300_349";
    if (yards <= 399) return "yds_allow_350_399";
    if (yards <= 449) return "yds_allow_400_449";
    if (yards <= 499) return "yds_allow_450_499";
    return "yds_allow_500p";
  }

  function applyBucket(stats,buckets,selected){
    if (!selected) return;
    for (const key of buckets) stats[key] = key === selected ? 1 : 0;
  }

  function repairDefenseRow(row){
    if (!isDefense(row)) return row;
    const stats = {...(row.stats || row.projection || {})};
    applyBucket(stats,POINT_BUCKETS,pointBucket(stats.pts_allow ?? stats.pts_allowed));
    applyBucket(stats,YARD_BUCKETS,yardBucket(stats.yds_allow ?? stats.yds_allowed));
    return {...row,stats};
  }

  function repairPayload(payload){
    return Array.isArray(payload) ? payload.map(repairDefenseRow) : payload;
  }

  window.fetch = async function(input,init){
    const response = await originalFetch(input,init);
    const url = typeof input === "string" ? input : String(input?.url || "");
    if (!url.includes("api.sleeper.com/projections/nfl/")) return response;

    try {
      const payload = await response.clone().json();
      const repaired = repairPayload(payload);
      return new Response(JSON.stringify(repaired),{
        status:response.status,
        statusText:response.statusText,
        headers:{"content-type":"application/json"}
      });
    } catch (_) {
      return response;
    }
  };
})();
