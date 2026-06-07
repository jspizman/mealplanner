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

// ---- Weekly plan (separate file: Dropbox /plan.json, or localStorage fallback) ----
const LS_PLAN = "mp_plan";

export function emptyPlan() {
  const week = {};
  for (const d of CONFIG.DAYS) {
    week[d] = {};
    for (const s of CONFIG.SLOTS) week[d][s.key] = null; // recipeId or null
  }
  return { familyServings: CONFIG.DEFAULT_FAMILY_SERVINGS, week };
}

export async function loadPlan() {
  if (dbx.isConfigured() && dbx.isConnected()) {
    try {
      const p = await dbx.downloadJson(CONFIG.DROPBOX_PLAN_PATH);
      if (p && p.week) return normalizePlan(p);
    } catch (e) { console.warn("Plan load (Dropbox) failed:", e); }
  }
  try {
    const raw = localStorage.getItem(LS_PLAN);
    if (raw) return normalizePlan(JSON.parse(raw));
  } catch {}
  return emptyPlan();
}

export async function savePlan(plan) {
  localStorage.setItem(LS_PLAN, JSON.stringify(plan)); // always keep a local copy
  if (dbx.isConfigured() && dbx.isConnected()) {
    try { await dbx.uploadJson(plan, CONFIG.DROPBOX_PLAN_PATH); return "dropbox"; }
    catch (e) { console.warn("Plan save (Dropbox) failed:", e); }
  }
  return "local";
}

function normalizePlan(p) {
  const base = emptyPlan();
  base.familyServings = p.familyServings || CONFIG.DEFAULT_FAMILY_SERVINGS;
  for (const d of CONFIG.DAYS)
    for (const s of CONFIG.SLOTS) {
      let v = p.week?.[d]?.[s.key];
      // Migrate plans saved before the snack split: the old single "snack" slot becomes Snack 1.
      if (v == null && s.key === "snack1") v = p.week?.[d]?.snack;
      base.week[d][s.key] = v || null;
    }
  return base;
}

// How many servings a slot scales to for grocery math.
export function slotServings(slot, plan) {
  if (slot.scale === "adults") return Math.max(1, plan.familyServings - CONFIG.KIDS_COUNT);
  if (typeof slot.scale === "number") return slot.scale;
  return plan.familyServings; // "family"
}

// Daily per-person calorie total (Josh's single serving of each meal that's his — kids' lunches excluded).
export function dayCalories(plan, day) {
  let kcal = 0;
  for (const s of CONFIG.SLOTS) {
    if (s.kcal === false) continue;
    const r = byId(plan.week[day][s.key]);
    if (r) kcal += r.macrosPerServing.calories;
  }
  return kcal;
}

// ---- Grocery aggregation: scale each slotted recipe to family size, dedupe, group ----
export function aggregateGrocery(plan) {
  const shop = new Map();   // key "item|unit" -> {item, unit, qty, aisle}
  const staples = new Map(); // item -> aisle
  for (const d of CONFIG.DAYS) {
    for (const s of CONFIG.SLOTS) {
      const r = byId(plan.week[d][s.key]);
      if (!r) continue;
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
