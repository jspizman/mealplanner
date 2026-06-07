# Turn on Dropbox sync (one-time, ~5 minutes)

The app works right now in **local mode** (reads the bundled `data/recipes.json`). To make it
sync across your desktop, phone, and iPad, connect it to your Dropbox. This is free — you're
registering a small "app" that gets its own folder in your Dropbox and nothing else.

## 1. Create the Dropbox app
1. Go to **https://www.dropbox.com/developers/apps** and sign in.
2. Click **Create app**.
3. Choose:
   - **Scoped access**
   - **App folder** access (it will create `Apps/<YourAppName>/` and can only touch that folder)
4. Name it something like `MealPlanner` and click **Create app**.

## 2. Set permissions
1. Open the new app's **Permissions** tab.
2. Check **`files.content.read`** and **`files.content.write`**.
3. Click **Submit** (bottom of the page).

## 3. Add the redirect URL
1. Go to the **Settings** tab.
2. Under **OAuth 2 → Redirect URIs**, add the exact URL where you open the app, e.g.:
   - testing locally: `http://localhost:8766/`
   - once hosted (Phase 2 deploy): your GitHub/Cloudflare Pages URL, e.g. `https://yourname.github.io/mealplanner/`
   - (add both `http://localhost:8766/` and `http://127.0.0.1:8766/` to be safe when testing)
   Add it and click the **Add** button.

## 4. Plug in the App key
1. On the **Settings** tab, copy the **App key**.
2. Open `03_app/js/config.js` and paste it:
   ```js
   DROPBOX_APP_KEY: "paste-your-app-key-here",
   ```
3. Save and reload the app.

## 5. Connect
- The header button now says **Connect Dropbox**. Click it, approve access.
- On first connect the app copies your current `recipes.json` into `Apps/MealPlanner/recipes.json`.
  From then on, every device reads and writes that one file.

## Notes
- We use the secure PKCE flow — there is **no app secret** to hide, which is exactly why this can run as a free static site.
- The app requests **offline** access so you stay signed in (it quietly refreshes its own token).
- To disconnect, click the **Dropbox ✓** button. Your data file stays safe in your Dropbox.
- Your data never goes anywhere except your own Dropbox.
