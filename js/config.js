// App configuration.
// To enable cross-device Dropbox sync, register a free Dropbox app (see SETUP_DROPBOX.md)
// and paste your App key below. Until then, the app runs in LOCAL mode using ./data/recipes.json.

export const CONFIG = {
  // Paste your Dropbox "App key" here (from the Dropbox App Console). Leave "" for local-only mode.
  DROPBOX_APP_KEY: "jt2pqzgmyv8bf3e",

  // Where files live inside the app's Dropbox folder (App-folder access).
  DROPBOX_DATA_PATH: "/recipes.json",
  DROPBOX_PLAN_PATH: "/plan.json",

  // Days and meal slots used by the planner.
  DAYS: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  SLOTS: ["breakfast", "lunch", "dinner", "snack"],

  // Default household size and Josh's personal daily calorie target (for the per-day color coding).
  DEFAULT_FAMILY_SERVINGS: 4,
  DAILY_KCAL_TARGET: 1550,

  // Local fallback bundled with the app (used in local mode and as offline seed).
  LOCAL_DATA_PATH: "./data/recipes.json",

  // Derived-filter thresholds (kept here, never baked into recipe records — see SCHEMA.md).
  HIGH_PROTEIN_G: 20,
  LOW_CALORIE_KCAL: 400,
  QUICK_MINUTES: 30,

  APP_NAME: "Meal Planner",
  DATA_VERSION: 1,
};
