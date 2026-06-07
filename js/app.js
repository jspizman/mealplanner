// Main entry: wires Dropbox connect/redirect, loads data, renders the library.

import { CONFIG } from "./config.js";
import * as dbx from "./dropbox.js";
import * as data from "./data.js";
import * as ui from "./ui.js";
import { renderPlanner } from "./planner.js";
import { renderGrocery } from "./grocery.js";

const $ = (id) => document.getElementById(id);
let plan = null;

async function boot() {
  $("app-name").textContent = CONFIG.APP_NAME;

  // If Dropbox redirected back with ?code=, finish the handshake first.
  try {
    if (dbx.isConfigured()) await dbx.handleRedirect();
  } catch (e) {
    toast("Dropbox connection failed: " + e.message, true);
  }

  wireSync();

  try {
    const res = await data.load();
    renderSyncState(res);
  } catch (e) {
    $("grid").innerHTML = `<p class="mp-empty">Could not load recipes: ${e.message}</p>`;
    return;
  }

  plan = await data.loadPlan();

  if (data.all().length === 0) {
    showEmptyLibrary();
  } else {
    ui.mountFilters($("filters"), apply);
    apply();
  }
  wireTabs();
  registerSW();
}

// Shown when no recipe data is bundled (shell-only deploy) and Dropbox isn't connected yet.
function showEmptyLibrary() {
  $("filters").innerHTML = "";
  $("count").textContent = "";
  const connectable = dbx.isConfigured() && !dbx.isConnected();
  $("grid").innerHTML = `
    <div class="mp-welcome">
      <h2>Welcome to your Meal Planner</h2>
      <p>${connectable
        ? "Connect your Dropbox to load your recipe library and weekly plans. Your data stays private in your own Dropbox."
        : "No recipe data found. Connect Dropbox (top right) to load your library."}</p>
      ${connectable ? '<button id="welcome-connect" class="mp-mini-btn primary">Connect Dropbox</button>' : ""}
    </div>`;
  const b = document.getElementById("welcome-connect");
  if (b) b.addEventListener("click", () => dbx.connect().catch((e) => toast(e.message, true)));
}

function wireTabs() {
  document.querySelectorAll(".mp-tab[data-view]").forEach((tab) => {
    tab.addEventListener("click", () => showView(tab.dataset.view, tab));
  });
}

function showView(view, tab) {
  document.querySelectorAll(".mp-tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
  document.querySelectorAll(".mp-view").forEach((v) => (v.hidden = true));
  $("view-" + view).hidden = false;
  if (view === "planner") renderPlanner($("view-planner"), plan, onPlanChange);
  if (view === "grocery") renderGrocery($("view-grocery"), plan);
}

async function onPlanChange(updated) {
  plan = updated;
  const where = await data.savePlan(plan);
  if (where === "dropbox") toast("Plan saved to Dropbox");
}

function apply(stateMaybe) {
  const recipes = data.filter(stateMaybe || {});
  $("count").textContent = `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`;
  ui.renderGrid($("grid"), recipes, ui.openDetail);
}

// Refilter using the live filter state captured by ui.mountFilters.
// ui calls back into apply(state) on every change, so we just re-run with no args otherwise.
function wireSync() {
  const btn = $("sync-btn");
  if (!dbx.isConfigured()) {
    btn.textContent = "Local mode";
    btn.title = "Add a Dropbox App key in js/config.js to enable cross-device sync";
    btn.classList.add("muted");
    btn.addEventListener("click", () => toast("Local mode — see SETUP_DROPBOX.md to enable sync."));
    return;
  }
  if (dbx.isConnected()) {
    btn.textContent = "Dropbox ✓";
    btn.title = "Connected as " + dbx.accountLabel() + " — click to disconnect";
    btn.addEventListener("click", () => {
      if (confirm("Disconnect Dropbox? Your data file stays in Dropbox.")) { dbx.disconnect(); location.reload(); }
    });
  } else {
    btn.textContent = "Connect Dropbox";
    btn.addEventListener("click", () => dbx.connect().catch((e) => toast(e.message, true)));
  }
}

function renderSyncState(res) {
  const tag = $("source-tag");
  if (res.source === "dropbox") {
    tag.textContent = res.seeded ? "Synced to Dropbox (seeded)" : "Synced from Dropbox";
    tag.className = "mp-source ok";
  } else {
    tag.textContent = "Local data";
    tag.className = "mp-source";
  }
}

let toastTimer;
function toast(msg, isErr) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "mp-toast show" + (isErr ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "mp-toast"), 4000);
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  // When a new service worker takes control (after a deploy), reload once so the
  // page picks up the fresh, matched set of assets instead of running a stale mix.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

boot();
