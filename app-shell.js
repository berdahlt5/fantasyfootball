(() => {
  "use strict";

  const KEYS = {
    theme: "fantasyUiTheme",
    favoriteTeam: "fantasyFavoriteTeam",
    watchCount: "fantasyWatchGameCount",
    priorityLeagues: "fantasyPriorityLeagues"
  };

  const DEFAULT_PRIORITY_LEAGUES = ["gridiron gurus", "tnt fantasy"];
  const NFL_TEAMS = [
    ["", "No favorite team"],["ARI","Arizona Cardinals"],["ATL","Atlanta Falcons"],["BAL","Baltimore Ravens"],["BUF","Buffalo Bills"],
    ["CAR","Carolina Panthers"],["CHI","Chicago Bears"],["CIN","Cincinnati Bengals"],["CLE","Cleveland Browns"],["DAL","Dallas Cowboys"],
    ["DEN","Denver Broncos"],["DET","Detroit Lions"],["GB","Green Bay Packers"],["HOU","Houston Texans"],["IND","Indianapolis Colts"],
    ["JAX","Jacksonville Jaguars"],["KC","Kansas City Chiefs"],["LV","Las Vegas Raiders"],["LAC","Los Angeles Chargers"],["LAR","Los Angeles Rams"],
    ["MIA","Miami Dolphins"],["MIN","Minnesota Vikings"],["NE","New England Patriots"],["NO","New Orleans Saints"],["NYG","New York Giants"],
    ["NYJ","New York Jets"],["PHI","Philadelphia Eagles"],["PIT","Pittsburgh Steelers"],["SEA","Seattle Seahawks"],["SF","San Francisco 49ers"],
    ["TB","Tampa Bay Buccaneers"],["TEN","Tennessee Titans"],["WAS","Washington Commanders"]
  ];

  function safeGet(key, fallback="") {
    try { const value = localStorage.getItem(key); return value === null ? fallback : value; }
    catch (_) { return fallback; }
  }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }

  function normalizePriorityLeagues(values) {
    const seen = new Set();
    const result = [];
    for (const raw of values || []) {
      const value = String(raw || "").trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
    return result;
  }

  function readPriorityLeagues() {
    try {
      const parsed = JSON.parse(safeGet(KEYS.priorityLeagues, "[]"));
      if (Array.isArray(parsed) && parsed.length) return normalizePriorityLeagues(parsed);
    } catch (_) {}
    const defaults = [...DEFAULT_PRIORITY_LEAGUES];
    safeSet(KEYS.priorityLeagues, JSON.stringify(defaults));
    return defaults;
  }

  function readSettings() {
    const savedTheme = safeGet(KEYS.theme, "light");
    let favoriteTeam = safeGet(KEYS.favoriteTeam, "").toUpperCase();
    if (!safeGet(KEYS.favoriteTeam, "")) {
      favoriteTeam = "PHI";
      safeSet(KEYS.favoriteTeam, favoriteTeam);
    }
    let watchCount = Number(safeGet(KEYS.watchCount, "4"));
    if (!Number.isFinite(watchCount) || watchCount < 1 || watchCount > 6) watchCount = 4;
    return {
      theme: savedTheme === "dark" ? "dark" : "light",
      favoriteTeam,
      watchCount,
      priorityLeagues: readPriorityLeagues()
    };
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    safeSet(KEYS.theme, next);
  }

  function currentPage() {
    const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    return file === "home.html" ? "index.html" : file;
  }

  function link(href, label, page, current) {
    return `<a class="app-nav-link${current===page?" active":""}" href="./${href}">${label}</a>`;
  }

  function buildNav() {
    const actions = document.querySelector(".header-actions");
    if (!actions || actions.dataset.appShellReady === "1") return;
    actions.dataset.appShellReady = "1";
    const status = actions.querySelector(".status-pill");
    if (status) status.remove();
    const current = currentPage();
    const moreActive = ["lineup-assistant.html","crunchtime.html"].includes(current);
    actions.innerHTML = `
      <nav class="app-nav" aria-label="Primary">
        ${link("index.html","Dashboard","index.html",current)}
        ${link("schedule-tool.html","Watch","schedule-tool.html",current)}
        ${link("team-rankings.html","Rankings","team-rankings.html",current)}
        ${link("waiver-wire-agent.html","Waivers","waiver-wire-agent.html",current)}
        <details class="app-more">
          <summary class="${moreActive?"active":""}">More</summary>
          <div class="app-more-menu">
            <a href="./lineup-assistant.html">Lineup Check</a>
            <a href="./crunchtime.html">Crunchtime</a>
          </div>
        </details>
        <button class="app-nav-button app-settings-button" type="button" data-open-app-settings>Settings</button>
      </nav>`;
    if (status) actions.appendChild(status);
  }

  function ensureSettingsDialog() {
    if (document.getElementById("appSettingsBackdrop")) return;
    const el = document.createElement("div");
    el.className = "app-settings-backdrop";
    el.id = "appSettingsBackdrop";
    el.innerHTML = `
      <div class="app-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="appSettingsTitle">
        <div class="app-settings-head">
          <div><div class="app-settings-title" id="appSettingsTitle">App settings</div><div class="app-settings-subtitle">Saved on this device and used across the fantasy app.</div></div>
          <button class="app-settings-close" type="button" aria-label="Close settings">×</button>
        </div>
        <div class="app-settings-body">
          <div class="app-settings-field"><label for="appThemeSetting">Appearance</label><select id="appThemeSetting"><option value="light">Light</option><option value="dark">Dark</option></select></div>
          <div class="app-settings-field"><label for="appFavoriteTeamSetting">Favorite NFL team</label><select id="appFavoriteTeamSetting">${NFL_TEAMS.map(([v,n])=>`<option value="${v}">${n}</option>`).join("")}</select><div class="app-settings-help">That team's game is always promoted to Must Watch.</div></div>
          <div class="app-settings-field"><label for="appWatchCountSetting">Games you can watch at once</label><select id="appWatchCountSetting">${[1,2,3,4,5,6].map(n=>`<option value="${n}">${n} game${n===1?"":"s"}</option>`).join("")}</select><div class="app-settings-help">Controls how many games are recommended in crowded Sunday windows.</div></div>
          <div class="app-settings-field app-settings-wide"><label for="appPriorityLeaguesSetting">Starred leagues</label><textarea id="appPriorityLeaguesSetting" rows="4" spellcheck="false" placeholder="Gridiron Gurus\nTnT Fantasy"></textarea><div class="app-settings-help">One league name per line. Starred leagues get extra weight in Watch and are highlighted across the app.</div></div>
        </div>
        <div class="app-settings-actions"><button class="app-settings-cancel" type="button">Cancel</button><button class="app-settings-save" type="button">Save settings</button></div>
      </div>`;
    document.body.appendChild(el);

    const close = () => el.classList.remove("show");
    el.querySelector(".app-settings-close").addEventListener("click", close);
    el.querySelector(".app-settings-cancel").addEventListener("click", close);
    el.addEventListener("click", event => { if (event.target === el) close(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    el.querySelector(".app-settings-save").addEventListener("click", () => {
      const theme = document.getElementById("appThemeSetting").value;
      const favoriteTeam = document.getElementById("appFavoriteTeamSetting").value;
      const watchCount = document.getElementById("appWatchCountSetting").value;
      const priorityLeagues = normalizePriorityLeagues(
        document.getElementById("appPriorityLeaguesSetting").value.split(/[\n,]+/)
      );
      safeSet(KEYS.theme, theme);
      safeSet(KEYS.favoriteTeam, favoriteTeam);
      safeSet(KEYS.watchCount, watchCount);
      safeSet(KEYS.priorityLeagues, JSON.stringify(priorityLeagues));
      applyTheme(theme);
      close();
      window.dispatchEvent(new CustomEvent("fantasy-settings-changed", { detail: readSettings() }));
    });
  }

  function openSettings() {
    ensureSettingsDialog();
    const settings = readSettings();
    document.getElementById("appThemeSetting").value = settings.theme;
    document.getElementById("appFavoriteTeamSetting").value = settings.favoriteTeam;
    document.getElementById("appWatchCountSetting").value = String(settings.watchCount);
    document.getElementById("appPriorityLeaguesSetting").value = settings.priorityLeagues.join("\n");
    document.getElementById("appSettingsBackdrop").classList.add("show");
  }

  function init() {
    applyTheme(readSettings().theme);
    buildNav();
    ensureSettingsDialog();
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-open-app-settings]");
      if (button) openSettings();
      const openMore = document.querySelector(".app-more[open]");
      if (openMore && !openMore.contains(event.target)) openMore.removeAttribute("open");
    });
    window.FantasyAppSettings = { read: readSettings, open: openSettings, applyTheme };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
