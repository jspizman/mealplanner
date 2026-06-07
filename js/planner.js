// Weekly planner: pick recipes into a 7-day x 4-slot grid, scaled to family size.
// Calls onChange(plan) whenever the plan changes (app.js persists it).

import { CONFIG } from "./config.js";
import * as data from "./data.js";

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
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
  row.appendChild(el("span", "mp-slot-label", cap(slot)));
  const id = _plan.week[day][slot];
  const r = id ? data.byId(id) : null;
  const btn = el("button", "mp-slot-btn" + (r ? " filled" : ""));
  if (r) {
    btn.appendChild(el("span", "mp-slot-name", r.name));
    btn.appendChild(el("span", "mp-slot-kcal", `${r.macrosPerServing.calories} kcal`));
  } else {
    btn.appendChild(el("span", "mp-slot-add", "+ Add"));
  }
  btn.addEventListener("click", () => openPicker(day, slot, r));
  row.appendChild(btn);
  return row;
}

function openPicker(day, slot, current) {
  const back = el("div", "mp-sheet-backdrop");
  const sheet = el("div", "mp-sheet mp-picker");
  back.appendChild(sheet);
  const close = () => back.remove();
  back.addEventListener("click", (e) => { if (e.target === back) close(); });

  const head = el("div", "mp-sheet-head");
  head.appendChild(el("h2", null, `${cap(slot)} · ${DAY_LABEL[day]}`));
  const x = el("button", "mp-x", "✕"); x.addEventListener("click", close); head.appendChild(x);
  sheet.appendChild(head);

  if (current) {
    const rm = el("button", "mp-mini-btn danger", "Remove " + current.name);
    rm.addEventListener("click", () => { _plan.week[day][slot] = null; persist(); close(); draw(); });
    sheet.appendChild(rm);
  }

  const search = el("input", "mp-search"); search.type = "search"; search.placeholder = "Search recipes…";
  sheet.appendChild(search);

  const list = el("div", "mp-picker-list");
  sheet.appendChild(list);

  const renderList = () => {
    const q = search.value.trim();
    // Default: recipes matching this slot's meal type; search overrides across everything.
    let matches = q ? data.filter({ q }) : data.filter({ mealType: slot });
    if (!q && matches.length === 0) matches = data.all();
    list.innerHTML = "";
    matches.slice(0, 60).forEach((rec) => {
      const item = el("button", "mp-picker-item");
      const m = rec.macrosPerServing;
      item.innerHTML = `<strong>${rec.name}</strong><span>${rec.cuisine} · ${m.calories} kcal · ${m.protein}g protein</span>`;
      item.addEventListener("click", () => { _plan.week[day][slot] = rec.id; persist(); close(); draw(); });
      list.appendChild(item);
    });
    if (!matches.length) list.appendChild(el("p", "mp-empty", "No matches."));
  };
  search.addEventListener("input", renderList);
  renderList();
  document.body.appendChild(back);
  setTimeout(() => search.focus(), 50);
}
