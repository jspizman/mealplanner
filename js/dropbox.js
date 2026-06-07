// Dropbox sync via OAuth2 Authorization Code + PKCE (no client secret — safe for static apps).
// Reads/writes a single JSON file in the app's Dropbox folder. Uses a refresh token so the
// user stays connected (offline access) instead of re-authing every few hours.
//
// Flow:
//   1. connect()  -> redirect to Dropbox consent (PKCE challenge stored in sessionStorage)
//   2. Dropbox redirects back with ?code=...  -> handleRedirect() exchanges it for tokens
//   3. tokens (incl. refresh_token) stored in localStorage; access token auto-refreshed
//   4. downloadJson() / uploadJson() hit the Dropbox content API

import { CONFIG } from "./config.js";

const LS = {
  refresh: "mp_dbx_refresh",
  access: "mp_dbx_access",
  expires: "mp_dbx_expires",
  account: "mp_dbx_account",
};
const SS_VERIFIER = "mp_dbx_pkce_verifier";

const AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DL_URL = "https://content.dropboxapi.com/2/files/download";
const UL_URL = "https://content.dropboxapi.com/2/files/upload";

function redirectUri() {
  // Must exactly match a redirect URI registered in the Dropbox App Console.
  // Normalize to the directory URL (strip a trailing index.html) so the bare URL and the
  // installed PWA (whose start_url may resolve to .../index.html) produce the SAME value.
  return (window.location.origin + window.location.pathname).replace(/index\.html$/, "");
}

// ---- PKCE helpers ----
function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(str) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
}
function randomVerifier() {
  const a = new Uint8Array(64);
  crypto.getRandomValues(a);
  return base64url(a);
}

export function isConfigured() {
  return !!CONFIG.DROPBOX_APP_KEY;
}
export function isConnected() {
  return !!localStorage.getItem(LS.refresh);
}
export function accountLabel() {
  return localStorage.getItem(LS.account) || "Dropbox";
}

// Step 1: kick off consent.
export async function connect() {
  if (!isConfigured()) throw new Error("Dropbox App key not set in js/config.js");
  const verifier = randomVerifier();
  sessionStorage.setItem(SS_VERIFIER, verifier);
  const challenge = base64url(await sha256(verifier));
  const params = new URLSearchParams({
    client_id: CONFIG.DROPBOX_APP_KEY,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    token_access_type: "offline",
    redirect_uri: redirectUri(),
  });
  window.location.href = `${AUTH_URL}?${params}`;
}

// Step 2: called on page load; if we came back with ?code=, exchange it.
export async function handleRedirect() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return false;
  const verifier = sessionStorage.getItem(SS_VERIFIER);
  // Clean the code out of the address bar regardless of outcome.
  window.history.replaceState({}, document.title, redirectUri());
  if (!verifier) return false;

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: CONFIG.DROPBOX_APP_KEY,
    code_verifier: verifier,
    redirect_uri: redirectUri(),
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Dropbox token exchange failed: " + (await res.text()));
  const t = await res.json();
  storeTokens(t);
  sessionStorage.removeItem(SS_VERIFIER);
  fetchAccount().catch(() => {});
  return true;
}

function storeTokens(t) {
  if (t.refresh_token) localStorage.setItem(LS.refresh, t.refresh_token);
  if (t.access_token) localStorage.setItem(LS.access, t.access_token);
  if (t.expires_in) localStorage.setItem(LS.expires, String(Date.now() + (t.expires_in - 60) * 1000));
}

async function refreshAccess() {
  const refresh = localStorage.getItem(LS.refresh);
  if (!refresh) throw new Error("Not connected to Dropbox");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: CONFIG.DROPBOX_APP_KEY,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Dropbox token refresh failed: " + (await res.text()));
  storeTokens(await res.json());
}

async function getAccessToken() {
  const exp = Number(localStorage.getItem(LS.expires) || 0);
  if (!localStorage.getItem(LS.access) || Date.now() > exp) await refreshAccess();
  return localStorage.getItem(LS.access);
}

async function fetchAccount() {
  const token = await getAccessToken();
  const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const a = await res.json();
    localStorage.setItem(LS.account, a?.name?.display_name || a?.email || "Dropbox");
  }
}

export function disconnect() {
  Object.values(LS).forEach((k) => localStorage.removeItem(k));
}

// ---- File I/O (path defaults to the recipe library) ----
export async function downloadJson(path = CONFIG.DROPBOX_DATA_PATH) {
  const token = await getAccessToken();
  const res = await fetch(DL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (res.status === 409) return null; // file not found yet
  if (!res.ok) throw new Error("Dropbox download failed: " + (await res.text()));
  return JSON.parse(await res.text());
}

export async function uploadJson(obj, path = CONFIG.DROPBOX_DATA_PATH) {
  const token = await getAccessToken();
  const res = await fetch(UL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }),
    },
    body: JSON.stringify(obj, null, 2),
  });
  if (!res.ok) throw new Error("Dropbox upload failed: " + (await res.text()));
  return res.json();
}
