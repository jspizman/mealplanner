// Minimal offline cache. Bumps with CACHE version when files change.
const CACHE = "mealplanner-v4";
const ASSETS = [
  "./", "./index.html", "./css/styles.css",
  "./js/app.js", "./js/ui.js", "./js/data.js", "./js/dropbox.js", "./js/config.js",
  "./js/planner.js", "./js/grocery.js",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache Dropbox API calls.
  if (url.hostname.endsWith("dropboxapi.com") || url.hostname.endsWith("dropbox.com")) return;
  // Network-first for data and config so edits show up; cache-first for the rest of the shell.
  if (url.pathname.endsWith("recipes.json") || url.pathname.endsWith("config.js")) {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then((c) => c || fetch(e.request)));
});
