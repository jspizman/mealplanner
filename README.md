# Meal Planner app

An installable PWA (Progressive Web App) for the family's pescatarian meal planning.
Vanilla JS, **no build step** — it's just static files, so it hosts free on GitHub/Cloudflare Pages
and is trivial to maintain. Data lives in one `recipes.json`, synced via your Dropbox.

## Run it locally
From the project root (`30_personal/mealplanning/`):
```
python -m http.server 8766 --directory 03_app
```
Then open http://localhost:8766/ . (Module scripts need a server — opening index.html as a file won't work.)

## Files
| Path | Purpose |
|---|---|
| `index.html` | App shell + tab bar (Library active; Planner/Grocery/Tracking are next) |
| `css/styles.css` | All styling, responsive (2-col grid on phones) |
| `js/config.js` | **Edit this** — Dropbox App key + filter thresholds |
| `js/dropbox.js` | Dropbox OAuth2 PKCE + file read/write (no secret needed) |
| `js/data.js` | Loads recipes (Dropbox or local), derived filters, search |
| `js/ui.js` | Renders filter bar, recipe grid, detail sheet |
| `js/app.js` | Boot + wiring |
| `data/recipes.json` | The 96-recipe library (source of truth in local mode) |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA installability + offline cache |
| `SCHEMA.md` | Recipe data schema |
| `SETUP_DROPBOX.md` | How to enable cross-device sync (one-time) |
| `_migration/` | How the library was built (manifest, batches, progress) |

## Status
- ✅ Recipe Library: browse, search, filter (meal type, cuisine, diet, kid-friendly, high-protein, quick), detail view
- ✅ Dropbox sync layer (built, gated until you add your App key — see `SETUP_DROPBOX.md`)
- ✅ Installable + offline shell
- ⬜ Planner tab (drag recipes into a week, scale to family, daily macro totals)
- ⬜ Grocery tab (auto list from the plan — 3 views: AnyList flat / aisle / pantry check)
- ⬜ Tracking tab (personal weight + what-you-ate log)

## Deploy (free, when ready)
Push `03_app/` to a GitHub repo and enable **GitHub Pages** (or drag the folder onto Cloudflare
Pages / Netlify). Then add that URL as a Dropbox redirect URI (see `SETUP_DROPBOX.md`).
