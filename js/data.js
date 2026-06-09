// Data layer: loads recipes (Dropbox if connected, else bundled local file),
// computes derived attributes, and applies filters. Single source of truth in memory.

import { CONFIG } from "./config.js";
import * as dbx from "./dropbox.js";

let recipes = [];
let source = "local"; // "dropbox" | "local"

export function getSource() { return source; }
export function all() { return recipes; }

export async function load() {
  if (dbx.isConfigured() && dbx.isConnected()) {
    try {
      const remote = await dbx.downloadJson();
      if (remote && Array.isArray(remote)) {
        recipes = remote; source = "dropbox"; return { source, count: recipes.length };
      }
      // No remote file yet: seed it from the bundled copy.
      const local = await fetchLocal();
      await dbx.uploadJson(local);
      recipes = local; source = "dropbox";
      return { source, count: recipes.length, seeded: true };
    } catch (e) {
      console.warn("Dropbox load failed, falling back to local:", e);
    }
  }
  recipes = await fetchLocal();
  source = "local";
  return { source, count: recipes.length };
}

async function fetchLocal() {
  try {
    const res = await fetch(CONFIG.LOCAL_DATA_PATH, { cache: "no-store" });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? j : [];
  } catch {
    return []; // shell-only deploy: no bundled data, show the welcome/connect screen
  }
}

export function byId(id) { return recipes.find((r) => r.id === id) || null; }

// A planner slot holds null, a recipeId (string), or a free-text "quick entry" {text, kcal}.
// resolveSlot normalizes any of those into a uniform shape the UI can render.
export function resolveSlot(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const r = byId(value);
    return r ? { kind: "recipe", recipe: r } : null; // dropped if the recipe no longer exists
  }
  if (typeof value === "object" && value.text) {
    return { kind: "note", text: String(value.text), kcal: Number(value.kcal) || 0 };
  }
  return null;
}

// ---- Weekly plans (separate file: Dropbox /plan.json, or localStorage fallback) ----
// Storage shape (v2): { familyServings, weeks: { "YYYY-MM-DD": weekObj } }, each week
// keyed by the Monday of that week. v1 files held a single { familyServings, week }; those
// migrate into the current week's slot on load. familyServings is shared across all weeks.
const LS_PLAN = "mp_plan";

let planStore = null;     // { familyServings, weeks }
let activeWeekKey = null; // "YYYY-MM-DD" Monday of the week currently being viewed

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateOfKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
// Monday (ISO week start) of the week containing `date`, as a YYYY-MM-DD key.
export function weekStartKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 0 = Monday
  return isoDate(d);
}
export function shiftWeekKey(key, deltaWeeks) {
  const d = dateOfKey(key);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return isoDate(d);
}
// "Jun 8–14" / "Jun 29 – Jul 5" date-range label for a week key.
export function weekLabel(key) {
  const start = dateOfKey(key);
  const end = dateOfKey(key); end.setDate(end.getDate() + 6);
  const mo = (x) => x.toLocaleString("en-US", { month: "short" });
  return start.getMonth() === end.getMonth()
    ? `${mo(start)} ${start.getDate()}–${end.getDate()}`
    : `${mo(start)} ${start.getDate()} – ${mo(end)} ${end.getDate()}`;
}
// How many weeks `key` is from the current week (0 = this week, 1 = next, -1 = last).
export function weekOffset(key) {
  return Math.round((dateOfKey(key) - dateOfKey(weekStartKey())) / (7 * 86400000));
}

function emptyWeek() {
  const week = {};
  for (const d of CONFIG.DAYS) {
    week[d] = {};
    for (const s of CONFIG.SLOTS) week[d][s.key] = null; // recipeId, {text,kcal}, or null
  }
  return week;
}
export function emptyPlan() {
  return { familyServings: CONFIG.DEFAULT_FAMILY_SERVINGS, week: emptyWeek() };
}

// The active week as a single-week plan object the planner/grocery views consume.
// `week` is a live reference into the store, so slot edits mutate the store directly.
export function activePlan() {
  return { familyServings: planStore.familyServings, week: planStore.weeks[activeWeekKey], weekKey: activeWeekKey };
}
export function getActiveWeekKey() { return activeWeekKey; }

export function setActiveWeek(key) {
  if (!planStore.weeks[key]) planStore.weeks[key] = emptyWeek();
  activeWeekKey = key;
  return activePlan();
}
export function clearActiveWeek() {
  planStore.weeks[activeWeekKey] = emptyWeek();
  return activePlan();
}

export async function loadPlan() {
  let stored = null;
  if (dbx.isConfigured() && dbx.isConnected()) {
    try {
      const p = await dbx.downloadJson(CONFIG.DROPBOX_PLAN_PATH);
      if (p && typeof p === "object") stored = p;
    } catch (e) { console.warn("Plan load (Dropbox) failed:", e); }
  }
  if (!stored) {
    try {
      const raw = localStorage.getItem(LS_PLAN);
      if (raw) stored = JSON.parse(raw);
    } catch {}
  }
  planStore = normalizeStore(stored);
  activeWeekKey = weekStartKey(); // always open on the current week
  if (!planStore.weeks[activeWeekKey]) planStore.weeks[activeWeekKey] = emptyWeek();
  return activePlan();
}

function weekIsEmpty(week) {
  for (const d of CONFIG.DAYS) for (const s of CONFIG.SLOTS) if (week?.[d]?.[s.key]) return false;
  return true;
}

export async function savePlan(plan) {
  // Fold the active-week view back into the store, then persist the whole store.
  if (plan) {
    if (plan.familyServings) planStore.familyServings = plan.familyServings;
    if (plan.week) planStore.weeks[activeWeekKey] = plan.week;
  }
  // Drop empty weeks (except the one in view) so merely browsing ahead doesn't bloat the file.
  for (const k of Object.keys(planStore.weeks))
    if (k !== activeWeekKey && weekIsEmpty(planStore.weeks[k])) delete planStore.weeks[k];
  localStorage.setItem(LS_PLAN, JSON.stringify(planStore)); // always keep a local copy
  if (dbx.isConfigured() && dbx.isConnected()) {
    try { await dbx.uploadJson(planStore, CONFIG.DROPBOX_PLAN_PATH); return "dropbox"; }
    catch (e) { console.warn("Plan save (Dropbox) failed:", e); }
  }
  return "local";
}

function normalizeStore(p) {
  const store = { familyServings: CONFIG.DEFAULT_FAMILY_SERVINGS, weeks: {} };
  if (p && typeof p === "object") {
    store.familyServings = p.familyServings || CONFIG.DEFAULT_FAMILY_SERVINGS;
    if (p.weeks && typeof p.weeks === "object") {
      for (const [k, w] of Object.entries(p.weeks)) store.weeks[k] = normalizeWeek(w);
    } else if (p.week) {
      store.weeks[weekStartKey()] = normalizeWeek(p.week); // migrate v1 single week
    }
  }
  return store;
}

function normalizeWeek(w) {
  const week = emptyWeek();
  for (const d of CONFIG.DAYS)
    for (const s of CONFIG.SLOTS) {
      let v = w?.[d]?.[s.key];
      // Migrate plans saved before the snack split: the old single "snack" slot becomes Snack 1.
      if (v == null && s.key === "snack1") v = w?.[d]?.snack;
      week[d][s.key] = v || null;
    }
  return week;
}

// How many servings a slot scales to for grocery math.
export function slotServings(slot, plan) {
  if (slot.scale === "adults") return Math.max(1, plan.familyServings - CONFIG.KIDS_COUNT);
  if (typeof slot.scale === "number") return slot.scale;
  return plan.familyServings; // "family"
}

// Daily per-person calorie total (Josh's single serving of each meal that's his — kids' lunches excluded).
// Quick entries contribute their optional kcal (0 if left blank).
export function dayCalories(plan, day) {
  let kcal = 0;
  for (const s of CONFIG.SLOTS) {
    if (s.kcal === false) continue;
    const e = resolveSlot(plan.week[day][s.key]);
    if (!e) continue;
    kcal += e.kind === "recipe" ? e.recipe.macrosPerServing.calories : e.kcal;
  }
  return kcal;
}

// ---- Grocery aggregation: scale each slotted recipe to family size, dedupe, group ----
export function aggregateGrocery(plan) {
  const shop = new Map();   // key "item|unit" -> {item, unit, qty, aisle}
  const staples = new Map(); // item -> aisle
  const extras = new Map();  // lowercased text -> original text (free-text quick entries, deduped)
  for (const d of CONFIG.DAYS) {
    for (const s of CONFIG.SLOTS) {
      const e = resolveSlot(plan.week[d][s.key]);
      if (!e) continue;
      if (e.kind === "note") { extras.set(e.text.toLowerCase(), e.text); continue; }
      const r = e.recipe;
      const scale = slotServings(s, plan) / r.baseServings;
      for (const ing of r.ingredients) {
        if (ing.optional) continue;
        if (ing.staple) { staples.set(ing.item, ing.aisle); continue; }
        const key = ing.item + "|" + (ing.unit || "");
        const cur = shop.get(key) || { item: ing.item, unit: ing.unit || "", qty: 0, aisle: ing.aisle, hasQty: false };
        if (ing.qty != null) { cur.qty += ing.qty * scale; cur.hasQty = true; }
        cur.aisle = cur.aisle || ing.aisle;
        shop.set(key, cur);
      }
    }
  }
  const items = [...shop.values()].map((x) => ({ ...x, qty: roundQty(x.qty) }));
  return {
    items,
    staples: [...staples.entries()].map(([item, aisle]) => ({ item, aisle })),
    extras: [...extras.values()],
  };
}

function roundQty(q) {
  if (!q) return null;
  if (q >= 10) return Math.round(q);
  if (q >= 1) return Math.round(q * 2) / 2;     // nearest 1/2
  return Math.round(q * 4) / 4;                  // nearest 1/4
}

// ---- Derived attributes (computed, never stored) ----
export function isHighProtein(r) { return r.macrosPerServing.protein >= CONFIG.HIGH_PROTEIN_G; }
export function isLowCal(r) { return r.macrosPerServing.calories <= CONFIG.LOW_CALORIE_KCAL; }
export function isQuick(r) { return (r.prepMin + r.cookMin) <= CONFIG.QUICK_MINUTES; }
export function totalTime(r) { return r.prepMin + r.cookMin; }

// ---- Facets for filter chips ----
export function facets() {
  const mealTypes = new Set(), cuisines = new Set();
  for (const r of recipes) {
    r.mealType.forEach((m) => mealTypes.add(m));
    cuisines.add(r.cuisine);
  }
  const order = ["breakfast", "lunch", "dinner", "side", "snack", "drink", "sauce", "component"];
  return {
    mealTypes: [...mealTypes].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    cuisines: [...cuisines].sort(),
  };
}

// ---- Filtering ----
export function filter({ q = "", mealType = "", cuisine = "", diet = "", kid = false, highProtein = false, quick = false } = {}) {
  const needle = q.trim().toLowerCase();
  return recipes.filter((r) => {
    if (mealType && !r.mealType.includes(mealType)) return false;
    if (cuisine && r.cuisine !== cuisine) return false;
    if (diet && !r.dietTags.includes(diet)) return false;
    if (kid && !r.kidFriendly) return false;
    if (highProtein && !(isHighProtein(r) && isLowCal(r))) return false;
    if (quick && !isQuick(r)) return false;
    if (needle) {
      const hay = (r.name + " " + r.cuisine + " " + r.dietTags.join(" ") + " " +
        r.ingredients.map((i) => i.item).join(" ")).toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}
