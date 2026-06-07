// Grocery view: derives the shopping list from the current plan and renders 3 views:
//   1) AnyList export (flat, copy-paste)   2) aisle-grouped review   3) pantry-staple check

import * as data from "./data.js";

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

const AISLE_ORDER = ["Produce", "Seafood", "Dairy & Eggs", "Bakery", "Pasta & Grains",
  "Canned & Jarred", "Condiments & Sauces", "Pantry & Baking", "Spices", "Frozen", "Other"];

function fmtItem(x) {
  const q = x.qty != null ? `${x.qty}${x.unit ? " " + x.unit : ""}` : "";
  return q ? `${x.item}, ${q}` : x.item;
}

export function renderGrocery(container, plan) {
  container.innerHTML = "";
  const agg = data.aggregateGrocery(plan);

  const mealCount = countMeals(plan);
  if (!mealCount) {
    container.appendChild(el("p", "mp-empty", "Your week is empty — add meals in the Planner tab and the grocery list builds itself."));
    return;
  }

  const head = el("div", "mp-groc-head");
  head.appendChild(el("p", "mp-groc-sum", `${agg.items.length} items for ${mealCount} planned meal${mealCount === 1 ? "" : "s"} · scaled to your household`));
  const copyBtn = el("button", "mp-mini-btn primary", "Copy AnyList list");
  copyBtn.addEventListener("click", () => copyFlat(agg, copyBtn));
  head.appendChild(copyBtn);
  container.appendChild(head);

  // View 1: flat AnyList export (in a textarea for easy manual copy too)
  const sect1 = section(container, "AnyList export", "Flat list — paste straight into AnyList, which sorts it into aisles for you.");
  const ta = el("textarea", "mp-groc-textarea");
  ta.rows = Math.min(20, agg.items.length + 1);
  ta.readOnly = true;
  ta.value = agg.items.map(fmtItem).join("\n");
  sect1.appendChild(ta);

  // View 2: aisle-grouped review
  const sect2 = section(container, "Review by aisle", "Tick things off as you check your kitchen.");
  const byAisle = {};
  for (const x of agg.items) (byAisle[x.aisle] = byAisle[x.aisle] || []).push(x);
  for (const aisle of AISLE_ORDER) {
    if (!byAisle[aisle]) continue;
    sect2.appendChild(el("h5", "mp-aisle-h", aisle));
    const ul = el("ul", "mp-groc-list");
    byAisle[aisle].sort((a, b) => a.item.localeCompare(b.item)).forEach((x) => {
      const li = el("li");
      const cb = el("input"); cb.type = "checkbox";
      const lab = el("label"); lab.appendChild(cb); lab.appendChild(el("span", null, " " + fmtItem(x)));
      li.appendChild(lab); ul.appendChild(li);
    });
    sect2.appendChild(ul);
  }

  // View 3: pantry-staple check
  const sect3 = section(container, "Pantry check", "Staples these recipes use — not added to the list. Glance and restock anything you're low on.");
  const ul3 = el("ul", "mp-groc-list staples");
  agg.staples.sort((a, b) => a.item.localeCompare(b.item)).forEach((s) => {
    const li = el("li");
    const cb = el("input"); cb.type = "checkbox";
    const lab = el("label"); lab.appendChild(cb); lab.appendChild(el("span", null, " " + s.item));
    li.appendChild(lab); ul3.appendChild(li);
  });
  sect3.appendChild(ul3);
}

function section(container, title, sub) {
  const s = el("section", "mp-groc-section");
  s.appendChild(el("h4", "mp-groc-title", title));
  if (sub) s.appendChild(el("p", "mp-groc-sub", sub));
  container.appendChild(s);
  return s;
}

function countMeals(plan) {
  let n = 0;
  for (const d of Object.values(plan.week)) for (const v of Object.values(d)) if (v) n++;
  return n;
}

async function copyFlat(agg, btn) {
  const text = agg.items.map(fmtItem).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    const old = btn.textContent; btn.textContent = "Copied ✓";
    setTimeout(() => (btn.textContent = old), 1800);
  } catch {
    btn.textContent = "Press Ctrl+C";
  }
}
