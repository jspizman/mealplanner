# Recipe data schema (v1)

Single source of truth for the meal-planning app. All recipes live in `data/recipes.json`
as an array of Recipe objects. The app computes plans, grocery lists, and macro totals
*from* this structured data — nothing is hand-authored downstream.

## Recipe object

| Field | Type | Notes |
|---|---|---|
| `id` | string | stable slug, e.g. `lemon-garlic-asparagus-pasta` |
| `name` | string | display name |
| `mealType` | string[] | any of: `breakfast`, `lunch`, `dinner`, `snack`, `side`, `drink`, `sauce` (dressings/sauces, not a meal), `component` (doughs/bases, not a meal) |
| `cuisine` | string | Mediterranean / Italian / Asian / Indian / American / … |
| `dietTags` | string[] | `pescatarian`, `vegetarian`, `vegan`, `contains-fish`, `contains-egg`, `contains-dairy`, `gluten`, `gluten-free`, `contains-alcohol` |
| `kidFriendly` | boolean | subjective — does the family's kid(s) like it. Stored because it can't be derived. |
| `prepMin` | number | minutes |
| `cookMin` | number | minutes |
| `baseServings` | number | servings the `ingredients` quantities produce |
| `sourceUrl` | string\|null | original recipe URL if known |
| `sourceFile` | string\|null | original PDF/MD filename in `01_recipefolder/` |
| `macrosPerServing` | object | `{ calories, protein, carbs, fat, fiber }`, all numbers (grams except calories) |
| `macrosEstimated` | boolean | true if macros are an estimate, not from the source |
| `ingredients` | Ingredient[] | structured — see below |
| `steps` | string[] | numbered instructions, one per element |
| `notes` | string[] | optional tips |
| `mealPrepNotes` | string\|null | batch/storage guidance |
| `equipment` | string[] | e.g. `["instant pot"]` — for filtering by what's on hand |
| `lastUsed` | string\|null | ISO date; set when used in a plan (drives variety) |
| `timesUsed` | number | usage counter |

## Ingredient object

| Field | Type | Notes |
|---|---|---|
| `qty` | number\|null | numeric amount for the `baseServings`; null = "to taste" |
| `unit` | string\|null | `cup`, `tbsp`, `tsp`, `oz`, `lb`, `clove`, `bunch`, `can`, `g`, `ml`, `piece`, … |
| `item` | string | canonical ingredient name, e.g. `asparagus`, `extra-firm tofu` |
| `prep` | string\|null | `minced`, `diced`, `drained` — kept separate so it doesn't pollute the item name |
| `aisle` | string | grocery category for list grouping (see below) |
| `optional` | boolean | excluded from required grocery math when true |
| `staple` | boolean | pantry staple (salt, olive oil) — suppressed from the weekly list by default |

### Aisle values (AnyList-friendly grouping)
`Produce`, `Seafood`, `Dairy & Eggs`, `Pasta & Grains`, `Canned & Jarred`,
`Pantry & Baking`, `Condiments & Sauces`, `Spices`, `Frozen`, `Bakery`, `Other`

## Grocery outputs (three views, one computation)

The week's chosen recipes are aggregated once (scaled to servings, deduped by `item`+`unit`).
That single result is rendered three ways:

1. **AnyList export** — a *flat* list, one item per line, **no aisle headers** (AnyList does its
   own category sorting). Non-staple items only. This is the copy-paste target. Matches the old
   `Week_N_Grocery_List.txt` format.
2. **In-app review list** — the same items, but **grouped by `aisle`** for easy human scanning
   before you export. Lets you tick things you already have.
3. **Pantry-staple check** — a separate short list of the `staple` items this week's recipes
   actually use (oil, salt, common spices, vanilla, etc.). Not auto-added to the shopping list —
   it's a "glance and see if you're running low" prompt so you can add what you need yourself.

## Derived attributes (computed by the app, NOT stored)

These are calculated live from the fields above so they can never drift out of sync:

- **High-protein** badge: `protein >= 20` g per serving.
- **Low-calorie** badge: `calories <= 400` per serving.
- **High-protein + low-calorie** (Josh's weight-loss filter): both of the above, i.e.
  `protein >= 20 && calories <= 400`. Equivalently, protein density `protein / (calories/100) >= 5`.
- **Quick** badge: `prepMin + cookMin <= 30`.
- **Not-recently-used**: `lastUsed` older than N weeks (drives variety in the planner).

If these thresholds need tuning, change them in one place in the app — never re-tag recipes.

## Why this shape
- **Structured `ingredients` with `qty`/`unit`/`item`/`aisle`** → the grocery list is computed:
  sum across the week's recipes (scaled to family size), dedupe by `item`+`unit`,
  drop `staple` items, group by `aisle`. This is the thing the old PDF-based system couldn't do.
- **`staple` flag** → stops "buy olive oil + tahini every week."
- **`lastUsed` / `timesUsed`** → planner avoids repeating recent dishes.
- **`macrosPerServing` + `baseServings`** → real per-person calorie math for personal tracking,
  and portions scale correctly for a family of 3+.
