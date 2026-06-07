// App configuration.
// To enable cross-device Dropbox sync, register a free Dropbox app (see SETUP_DROPBOX.md)
// and paste your App key below. Until then, the app runs in LOCAL mode using ./data/recipes.json.

export const CONFIG = {
  // Paste your Dropbox "App key" here (from the Dropbox App Console). Leave "" for local-only mode.
  DROPBOX_APP_KEY: "jt2pqzgmyv8bf3e",

  // Where files live inside the app's Dropbox folder (App-folder access).
  DROPBOX_DATA_PATH: "/recipes.json",
  DROPBOX_PLAN_PATH: "/plan.json",

  // Days and meal slots used by the planner. Each slot:
  //   key      storage key in the plan (plan.week[day][key])
  //   label    shown in the planner grid
  //   mealType which recipe meal type the picker filters to by default
  //   scale    grocery scaling — "family" (everyone), "adults" (family minus kids), or a fixed serving count
  //   kid      picker defaults to kid-friendly recipes (the kids' own lunches)
  //   kcal     counts toward your per-person daily calorie total — kids' lunches are yours-excluded
  DAYS: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  SLOTS: [
    { key: "breakfast",  label: "Breakfast", mealType: "breakfast", scale: "family", kcal: true },
    { key: "lunch",      label: "Lunch",     mealType: "lunch",     scale: "adults", kcal: true },
    { key: "alanaLunch", label: "Alana",     mealType: "lunch",     scale: 1, kid: true, kcal: false },
    { key: "finnLunch",  label: "Finn",      mealType: "lunch",     scale: 1, kid: true, kcal: false },
    { key: "dinner",     label: "Dinner",    mealType: "dinner",    scale: "family", kcal: true },
    { key: "snack1",     label: "Snack 1",   mealType: "snack",     scale: "family", kcal: true },
    { key: "snack2",     label: "Snack 2",   mealType: "snack",     scale: "family", kcal: true },
  ],

  // Children with their own dedicated lunch slots (Alana + Finn). Used to scale the
  // adults-only "Lunch" slot: adults = familyServings - KIDS_COUNT.
  KIDS_COUNT: 2,

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
