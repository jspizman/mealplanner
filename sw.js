// Offline cache. Bumps with CACHE version when files change.
// Strategy: NETWORK-FIRST for all same-origin app assets so HTML/CSS/JS always
// update together as a matched set (prevents stale-cache skew, e.g. a new
// planner.js running against an old config.js). Cache is used only as an offline
// fallback and is refreshed on every successful fetch.
const CACHE = "mealplanner-v8";
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
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Never touch Dropbox API calls.
  if (url.hostname.endsWith("dropboxapi.com") || url.hostname.endsWith("dropbox.com")) return;
  // Only manage our own origin; let anything cross-origin pass straight through.
  if (url.origin !== self.location.origin) return;

  // Network-first: fetch fresh, update the cache, fall back to cache when offline.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then((c) => c || caches.match("./index.html")))
  );
});
