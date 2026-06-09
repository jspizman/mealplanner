// Weekly planner: pick recipes into a 7-day x 4-slot grid, scaled to family size.
// Calls onChange(plan) whenever the plan changes (app.js persists it).

import { CONFIG } from "./config.js";
import * as data from "./data.js";
import * as ui from "./ui.js";

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const DAY_LABEL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

let _plan, _onChange, _container;

export function renderPlanner(container, plan, onChange) {
  _container = container; _plan = plan; _onChange = onChange;
  draw();
}

function persist() { _onChange(_plan); }

function draw() {
  _container.innerHTML = "";

  // Controls
  const controls = el("div", "mp-plan-controls");
  const fam = el("label", "mp-fam");
  fam.appendChild(el("span", null, "Cooking for"));
  const input = el("input", "mp-fam-input"); input.type = "number"; input.min = "1"; input.max = "12";
  input.value = String(_plan.familyServings);
  input.addEventListener("change", () => {
    _plan.familyServings = Math.max(1, Math.min(12, Number(input.value) || 1));
    input.value = String(_plan.familyServings); persist();
  });
  fam.appendChild(input);
  fam.appendChild(el("span", null, "people"));
  controls.appendChild(fam);

  const clearBtn = el("button", "mp-mini-btn", "Clear week");
  clearBtn.addEventListener("click", () => {
    if (confirm("Clear all meals from this week?")) {
      _plan = data.clearActiveWeek();
      _plan.familyServings = Number(input.value) || CONFIG.DEFAULT_FAMILY_SERVINGS;
      persist(); draw();
    }
  });
  controls.appendChild(clearBtn);
  _container.appendChild(controls);

  _container.appendChild(weekNav());

  // Day cards
  for (const day of CONFIG.DAYS) {
    const card = el("div", "mp-day");
    const head = el("div", "mp-day-head");
    head.appendChild(el("h3", null, DAY_LABEL[day]));
    const right = el("div", "mp-day-actions");
    const kcal = data.dayCalories(_plan, day);
    const tot = el("span", "mp-day-kcal " + kcalClass(kcal), kcal ? `${kcal} kcal` : "—");
    tot.title = "Your per-person total for the day (target ~" + CONFIG.DAILY_KCAL_TARGET + ")";
    right.appendChild(tot);
    const copy = el("button", "mp-day-copy", "Copy");
    copy.title = "Copy this day's recipes + single-serving ingredients for Noom logging";
    copy.addEventListener("click", () => copyDay(day, copy));
    right.appendChild(copy);
    head.appendChild(right);
    card.appendChild(head);

    for (const slot of CONFIG.SLOTS) {
      card.appendChild(slotRow(day, slot));
    }
    _container.appendChild(card);
  }
}

function kcalClass(k) {
  if (!k) return "";
  if (k >= 1450 && k <= 1650) return "good";
  if (k > 1800) return "high";
  return "warn";
}

// ---- Week switcher: step between forward/back weeks (stored keyed by week-start) ----
function weekNav() {
  const nav = el("div", "mp-weeknav");

  const prev = el("button", "mp-week-arrow", "‹");
  prev.title = "Previous week";
  prev.addEventListener("click", () => switchWeek(data.shiftWeekKey(_plan.weekKey, -1)));
  nav.appendChild(prev);

  const label = el("div", "mp-week-label");
  label.appendChild(el("strong", null, relWeekLabel(data.weekOffset(_plan.weekKey))));
  label.appendChild(el("span", null, data.weekLabel(_plan.weekKey)));
  nav.appendChild(label);

  const next = el("button", "mp-week-arrow", "›");
  next.title = "Next week";
  next.addEventListener("click", () => switchWeek(data.shiftWeekKey(_plan.weekKey, 1)));
  nav.appendChild(next);

  if (data.weekOffset(_plan.weekKey) !== 0) {
    const today = el("button", "mp-mini-btn mp-week-today", "This week");
    today.addEventListener("click", () => switchWeek(data.weekStartKey()));
    nav.appendChild(today);
  }
  return nav;
}

function relWeekLabel(off) {
  if (off === 0) return "This week";
  if (off === 1) return "Next week";
  if (off === -1) return "Last week";
  if (off > 1) return `In ${off} weeks`;
  return `${-off} weeks ago`;
}

function switchWeek(key) {
  _plan = data.setActiveWeek(key); // viewing only — no save until the week is edited
  draw();
}

// ---- Copy day for Noom: each recipe with its ingredients scaled to ONE serving ----
// Noom is logged food-by-food, so the export lists every ingredient at Josh's single
// portion (recipe qty ÷ baseServings) under each recipe, not just the recipe name.
function dayDateLabel(day) {
  const [y, m, d] = _plan.weekKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + CONFIG.DAYS.indexOf(day));
  return dt.toLocaleString("en-US", { month: "short", day: "numeric" });
}

// Format a scaled ingredient amount as a tidy cooking quantity (snapped to common fractions).
function fmtAmt(q) {
  if (q == null) return "";
  if (q >= 10) return String(Math.round(q));
  const whole = Math.floor(q);
  const opts = [0, 0.25, 0.33, 0.5, 0.67, 0.75, 1];
  let best = 0, bd = 1;
  for (const o of opts) { const dd = Math.abs((q - whole) - o); if (dd < bd) { bd = dd; best = o; } }
  let w = whole, f = best;
  if (f === 1) { w += 1; f = 0; }
  if (w === 0 && f === 0) return String(Math.round(q * 100) / 100); // tiny qty: don't vanish to 0
  const frac = { 0: "", 0.25: "¼", 0.33: "⅓", 0.5: "½", 0.67: "⅔", 0.75: "¾" }[f];
  return (w ? String(w) : "") + (frac ? (w ? " " : "") + frac : "");
}

function ingLine(ing, scale) {
  const q = ing.qty != null ? ing.qty * scale : null;
  const head = [fmtAmt(q), q != null ? ing.unit : ""].filter(Boolean).join(" ");
  const prep = ing.prep ? `, ${ing.prep}` : "";
  return `  - ${head ? head + " " : ""}${ing.item}${prep}${ing.optional ? " (optional)" : ""}`;
}

function dayNoomText(day) {
  const blocks = [];
  for (const slot of CONFIG.SLOTS) {
    if (slot.kcal === false) continue; // kids' lunches don't count toward Josh's intake
    const e = data.resolveSlot(_plan.week[day][slot.key]);
    if (!e) continue;
    if (e.kind === "recipe") {
      const r = e.recipe;
      const scale = 1 / r.baseServings; // ingredients for a single serving
      const lines = r.ingredients.map((ing) => ingLine(ing, scale));
      blocks.push(`${slot.label}: ${r.name} — ${r.macrosPerServing.calories} kcal (1 serving)\n${lines.join("\n")}`);
    } else {
      blocks.push(`${slot.label}: ${e.text}${e.kcal ? ` — ${e.kcal} kcal` : ""}`);
    }
  }
  if (!blocks.length) return null;
  const header = `${DAY_LABEL[day]} (${dayDateLabel(day)}) — ${data.dayCalories(_plan, day)} kcal`;
  return header + "\n\n" + blocks.join("\n\n");
}

async function copyDay(day, btn) {
  const text = dayNoomText(day);
  if (!text) { flash(btn, "Empty"); return; }
  try {
    await navigator.clipboard.writeText(text);
    flash(btn, "Copied ✓");
  } catch {
    flash(btn, "Ctrl+C");
  }
}

function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = old), 1500);
}

function slotRow(day, slot) {
  const row = el("div", "mp-slot");
  row.appendChild(el("span", "mp-slot-label" + (slot.kid ? " kid" : ""), slot.label));
  const value = _plan.week[day][slot.key];
  const e = data.resolveSlot(value);
  const btn = el("button", "mp-slot-btn" + (e ? " filled" : ""));
  if (e && e.kind === "recipe") {
    btn.appendChild(el("span", "mp-slot-name", e.recipe.name));
    btn.appendChild(el("span", "mp-slot-kcal", `${e.recipe.macrosPerServing.calories} kcal`));
    btn.addEventListener("click", () => openRecipe(day, slot, e.recipe)); // recipe → view it
  } else if (e && e.kind === "note") {
    btn.appendChild(el("span", "mp-slot-name note", e.text));
    btn.appendChild(el("span", "mp-slot-kcal", e.kcal ? `${e.kcal} kcal` : ""));
    btn.addEventListener("click", () => openPicker(day, slot, value)); // quick entry → edit it
  } else {
    btn.appendChild(el("span", "mp-slot-add", "+ Add"));
    btn.addEventListener("click", () => openPicker(day, slot, null)); // empty → pick one
  }
  row.appendChild(btn);
  return row;
}

// Open the full recipe detail straight from the planner, with Swap / Remove actions.
function openRecipe(day, slot, r) {
  ui.openDetail(r, [
    { label: "Swap recipe", onClick: (close) => { close(); openPicker(day, slot, r.id); } },
    { label: "Remove from plan", className: "danger", onClick: (close) => {
        _plan.week[day][slot.key] = null; persist(); close(); draw();
      } },
  ]);
}

function openPicker(day, slot, current) {
  const back = el("div", "mp-sheet-backdrop");
  const sheet = el("div", "mp-sheet mp-picker");
  back.appendChild(sheet);
  const close = () => back.remove();
  back.addEventListener("click", (e) => { if (e.target === back) close(); });

  const head = el("div", "mp-sheet-head");
  head.appendChild(el("h2", null, `${slot.label} · ${DAY_LABEL[day]}`));
  const x = el("button", "mp-x", "✕"); x.addEventListener("click", close); head.appendChild(x);
  sheet.appendChild(head);

  const cur = data.resolveSlot(current);
  if (cur) {
    const label = cur.kind === "recipe" ? cur.recipe.name : cur.text;
    const rm = el("button", "mp-mini-btn danger", "Remove " + label);
    rm.addEventListener("click", () => { _plan.week[day][slot.key] = null; persist(); close(); draw(); });
    sheet.appendChild(rm);
  }

  // Quick entry: free text (e.g. "Fruit") with optional calories, no recipe needed.
  const qa = el("div", "mp-quickadd");
  qa.appendChild(el("label", "mp-quickadd-label", "Quick entry"));
  const qaRow = el("div", "mp-quickadd-row");
  const qText = el("input", "mp-quickadd-text"); qText.type = "text"; qText.placeholder = "e.g. Fruit, leftovers…";
  const qKcal = el("input", "mp-quickadd-kcal"); qKcal.type = "number"; qKcal.min = "0"; qKcal.placeholder = "kcal";
  const qBtn = el("button", "mp-mini-btn primary", "Add");
  if (cur && cur.kind === "note") { qText.value = cur.text; if (cur.kcal) qKcal.value = String(cur.kcal); }
  const addNote = () => {
    const text = qText.value.trim();
    if (!text) { qText.focus(); return; }
    _plan.week[day][slot.key] = { text, kcal: Math.max(0, Number(qKcal.value) || 0) };
    persist(); close(); draw();
  };
  qBtn.addEventListener("click", addNote);
  [qText, qKcal].forEach((i) => i.addEventListener("keydown", (ev) => { if (ev.key === "Enter") addNote(); }));
  qaRow.appendChild(qText); qaRow.appendChild(qKcal); qaRow.appendChild(qBtn);
  qa.appendChild(qaRow);
  sheet.appendChild(qa);

  sheet.appendChild(el("p", "mp-or", "or pick a recipe"));

  const search = el("input", "mp-search"); search.type = "search"; search.placeholder = "Search recipes…";
  sheet.appendChild(search);

  const list = el("div", "mp-picker-list");
  sheet.appendChild(list);

  const renderList = () => {
    const q = search.value.trim();
    // Default: recipes matching this slot's meal type (and kid-friendly for the kids' slots);
    // search overrides across everything.
    let matches = q ? data.filter({ q }) : data.filter({ mealType: slot.mealType, kid: !!slot.kid });
    if (!q && matches.length === 0) matches = data.all();
    list.innerHTML = "";
    matches.slice(0, 60).forEach((rec) => {
      const item = el("button", "mp-picker-item");
      const m = rec.macrosPerServing;
      item.innerHTML = `<strong>${rec.name}</strong><span>${rec.cuisine} · ${m.calories} kcal · ${m.protein}g protein</span>`;
      item.addEventListener("click", () => { _plan.week[day][slot.key] = rec.id; persist(); close(); draw(); });
      list.appendChild(item);
    });
    if (!matches.length) list.appendChild(el("p", "mp-empty", "No matches."));
  };
  search.addEventListener("input", renderList);
  renderList();
  document.body.appendChild(back);
  setTimeout(() => search.focus(), 50);
}
