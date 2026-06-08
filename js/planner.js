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
    if (confirm("Clear all meals from this week?")) { _plan = data.emptyPlan(); _plan.familyServings = Number(input.value) || CONFIG.DEFAULT_FAMILY_SERVINGS; persist(); draw(); }
  });
  controls.appendChild(clearBtn);
  _container.appendChild(controls);

  // Day cards
  for (const day of CONFIG.DAYS) {
    const card = el("div", "mp-day");
    const head = el("div", "mp-day-head");
    head.appendChild(el("h3", null, DAY_LABEL[day]));
    const kcal = data.dayCalories(_plan, day);
    const tot = el("span", "mp-day-kcal " + kcalClass(kcal), kcal ? `${kcal} kcal` : "—");
    tot.title = "Your per-person total for the day (target ~" + CONFIG.DAILY_KCAL_TARGET + ")";
    head.appendChild(tot);
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
