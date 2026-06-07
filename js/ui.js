// Rendering: filter bar, recipe grid, recipe detail sheet. Pure DOM, no framework.

import * as data from "./data.js";

const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let state = { q: "", mealType: "", cuisine: "", diet: "", kid: false, highProtein: false, quick: false };

export function mountFilters(container, onChange) {
  container.innerHTML = "";
  const f = data.facets();

  const search = el("input", "mp-search");
  search.type = "search";
  search.placeholder = "Search recipes or ingredients…";
  search.value = state.q;
  search.addEventListener("input", () => { state.q = search.value; onChange(state); });
  container.appendChild(search);

  const rowMeal = el("div", "mp-chiprow");
  rowMeal.appendChild(chip("All meals", () => state.mealType === "", () => { state.mealType = ""; }, onChange));
  f.mealTypes.forEach((m) =>
    rowMeal.appendChild(chip(cap(m), () => state.mealType === m, () => { state.mealType = m; }, onChange)));
  container.appendChild(rowMeal);

  const rowToggle = el("div", "mp-chiprow");
  rowToggle.appendChild(chip("Kid-friendly", () => state.kid, () => { state.kid = !state.kid; }, onChange));
  rowToggle.appendChild(chip("High-protein", () => state.highProtein, () => { state.highProtein = !state.highProtein; }, onChange));
  rowToggle.appendChild(chip("Quick (≤30m)", () => state.quick, () => { state.quick = !state.quick; }, onChange));
  ["vegan", "vegetarian", "contains-fish"].forEach((d) =>
    rowToggle.appendChild(chip(d === "contains-fish" ? "Fish" : cap(d), () => state.diet === d,
      () => { state.diet = state.diet === d ? "" : d; }, onChange)));
  container.appendChild(rowToggle);

  const cuisineSel = el("select", "mp-select");
  cuisineSel.appendChild(new Option("All cuisines", ""));
  f.cuisines.forEach((c) => cuisineSel.appendChild(new Option(c, c)));
  cuisineSel.value = state.cuisine;
  cuisineSel.addEventListener("change", () => { state.cuisine = cuisineSel.value; onChange(state); });
  container.appendChild(cuisineSel);
}

function chip(label, isActive, toggle, onChange) {
  const b = el("button", "mp-chip", label);
  const sync = () => b.classList.toggle("active", isActive());
  sync();
  b.addEventListener("click", () => { toggle(); render(); onChange(state); });
  function render() { document.querySelectorAll(".mp-chip").forEach((c) => {}); sync(); }
  b._sync = sync;
  return b;
}

export function renderGrid(container, recipes, onOpen) {
  container.innerHTML = "";
  if (!recipes.length) {
    container.appendChild(el("p", "mp-empty", "No recipes match these filters."));
    return;
  }
  document.querySelectorAll(".mp-chip").forEach((c) => c._sync && c._sync());
  for (const r of recipes) {
    const card = el("button", "mp-card");
    card.addEventListener("click", () => onOpen(r));

    const top = el("div", "mp-card-top");
    top.appendChild(el("h3", "mp-card-title", r.name));
    card.appendChild(top);

    const meta = el("div", "mp-card-meta");
    meta.appendChild(el("span", "mp-tag", r.mealType.map(cap).join(" · ")));
    meta.appendChild(el("span", "mp-tag muted", r.cuisine));
    meta.appendChild(el("span", "mp-tag muted", `${data.totalTime(r)} min`));
    card.appendChild(meta);

    const m = r.macrosPerServing;
    const macros = el("div", "mp-macros");
    macros.appendChild(stat(`${m.calories}`, "kcal"));
    macros.appendChild(stat(`${m.protein}g`, "protein"));
    macros.appendChild(stat(`${m.fiber}g`, "fiber"));
    card.appendChild(macros);

    const badges = el("div", "mp-badges");
    if (r.kidFriendly) badges.appendChild(el("span", "mp-badge kid", "Kid"));
    if (data.isHighProtein(r) && data.isLowCal(r)) badges.appendChild(el("span", "mp-badge hp", "High-protein"));
    if (data.isQuick(r)) badges.appendChild(el("span", "mp-badge quick", "Quick"));
    if (r.macrosEstimated) badges.appendChild(el("span", "mp-badge est", "macros est."));
    card.appendChild(badges);

    container.appendChild(card);
  }
}

function stat(big, small) {
  const w = el("div", "mp-stat");
  w.appendChild(el("strong", null, big));
  w.appendChild(el("span", null, small));
  return w;
}

// openDetail(r, actions?) — actions is an optional array of { label, className?, onClick(close) }
// rendered as buttons under the subtitle (used by the planner for Swap / Remove).
export function openDetail(r, actions) {
  const back = el("div", "mp-sheet-backdrop");
  const sheet = el("div", "mp-sheet");
  back.appendChild(sheet);

  const close = () => back.remove();
  back.addEventListener("click", (e) => { if (e.target === back) close(); });

  const header = el("div", "mp-sheet-head");
  const h = el("h2", null, r.name);
  const x = el("button", "mp-x", "✕");
  x.addEventListener("click", close);
  header.appendChild(h); header.appendChild(x);
  sheet.appendChild(header);

  const sub = el("p", "mp-sheet-sub",
    `${r.cuisine} · ${r.mealType.map(cap).join(", ")} · serves ${r.baseServings} · ${data.totalTime(r)} min`);
  sheet.appendChild(sub);

  if (actions && actions.length) {
    const bar = el("div", "mp-sheet-actions");
    actions.forEach((a) => {
      const b = el("button", "mp-mini-btn" + (a.className ? " " + a.className : ""), a.label);
      b.addEventListener("click", () => a.onClick(close));
      bar.appendChild(b);
    });
    sheet.appendChild(bar);
  }

  const m = r.macrosPerServing;
  const macros = el("div", "mp-sheet-macros");
  [["Calories", m.calories], ["Protein", m.protein + "g"], ["Carbs", m.carbs + "g"], ["Fat", m.fat + "g"], ["Fiber", m.fiber + "g"]]
    .forEach(([k, v]) => { const c = el("div", "mp-sheet-macro"); c.appendChild(el("strong", null, String(v))); c.appendChild(el("span", null, k)); macros.appendChild(c); });
  sheet.appendChild(macros);
  if (r.macrosEstimated) sheet.appendChild(el("p", "mp-note-inline", "Macros are an estimate."));

  sheet.appendChild(el("h4", "mp-sheet-h", "Ingredients"));
  const ul = el("ul", "mp-ing");
  for (const i of r.ingredients) {
    const qty = i.qty != null ? `${fmtQty(i.qty)}${i.unit ? " " + i.unit : ""} ` : "";
    const prep = i.prep ? `, ${i.prep}` : "";
    const li = el("li", i.optional ? "opt" : null);
    li.innerHTML = `<strong>${qty}</strong>${i.item}${prep}` + (i.optional ? " <em>(optional)</em>" : "");
    ul.appendChild(li);
  }
  sheet.appendChild(ul);

  sheet.appendChild(el("h4", "mp-sheet-h", "Steps"));
  const ol = el("ol", "mp-steps");
  r.steps.forEach((s) => ol.appendChild(el("li", null, s)));
  sheet.appendChild(ol);

  if (r.notes && r.notes.length) {
    sheet.appendChild(el("h4", "mp-sheet-h", "Notes"));
    r.notes.forEach((n) => sheet.appendChild(el("p", "mp-note-inline", n)));
  }
  if (r.mealPrepNotes) {
    sheet.appendChild(el("h4", "mp-sheet-h", "Meal prep"));
    sheet.appendChild(el("p", "mp-note-inline", r.mealPrepNotes));
  }
  document.body.appendChild(back);
}

function fmtQty(q) {
  const map = { 0.25: "¼", 0.33: "⅓", 0.5: "½", 0.67: "⅔", 0.75: "¾", 1.5: "1½", 1.25: "1¼", 1.33: "1⅓" };
  if (map[q]) return map[q];
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100);
}
