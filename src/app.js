/**
 * App — router, global state, navigation.
 * ------------------------------------------------------------------------
 * Very small, deliberately. Screens own their markup and behavior; this
 * file only orchestrates which screen is mounted and holds the shared
 * state (profile, today's intake).
 *
 * State is persisted to localStorage so the demo survives a refresh. This
 * is a browser PWA, not a sandboxed artifact — persistence is expected.
 */

import { computePlan } from './engine/nutritionStrategyV1.js?v=39';
import { renderOnboarding } from './screens/onboarding.js?v=39';
import { renderToday } from './screens/today.js?v=39';
import { renderMealAnalysis } from './screens/meal-analysis.js?v=39';
import { renderNextMeal } from './screens/next-meal.js?v=39';
import { renderDayCards } from './screens/day-cards.js?v=39';
import { renderEasterEgg } from './screens/easter-egg.js?v=39';

/**
 * Map the onboarding NutritionProfile → NutritionProfileInput (Strategy v1).
 * Fields the onboarding does not collect stay undefined; the strategy
 * records that as an assumption instead of silently guessing.
 */
export function profileToInput(p) {
  return {
    age: p.age,
    biologicalSex: p.biologicalSex,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    goal: p.goal === 'lose_gentle' ? 'gentle_fat_loss' : (p.goal === 'maintain' ? 'maintenance' : p.goal),
    activityLevel: p.activityLevel,           // legacy category → band (assumption logged)
    strengthSessionsPerWeek: p.trainingFrequency ?? 0,
    mealsPerDay: p.mealsPerDay ?? 3,
    useTrainingDayAdjustment: false,          // daily_balanced default; not exposed in onboarding
    pregnant: undefined,
    breastfeeding: undefined,
    specialMedicalNutritionNeeds: undefined,
  };
}

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'eat.app.state.v0';

const DEFAULT_STATE = {
  profile: null,          // NutritionProfile | null
  targets: null,          // NutritionTargets | null (derived)
  onboarded: false,
  today: {
    date: todayKey(),
    meals: [],            // [{ slot:'breakfast'|'lunch'|'dinner'|'snack', mealId, quantity, addedAt, sourceType }]
  },
  lastAnalysis: null,     // last mock AI analysis result
};

let state = load();

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    // Roll the day over if the stored state is from a previous day.
    if (parsed.today?.date !== todayKey()) {
      parsed.today = { date: todayKey(), meals: [] };
    }
    const merged = { ...structuredClone(DEFAULT_STATE), ...parsed };
    // Re-derive the plan whenever a profile exists (strategy upgrades,
    // missing or stale plans). Keeps load() total.
    if (merged.profile) {
      merged.targets = computePlan(profileToInput(merged.profile));
    }
    return merged;
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export const store = {
  get: () => state,
  setProfile(profile) {
    state.profile = profile;
    state.targets = computePlan(profileToInput(profile));
    state.onboarded = true;
    persist();
  },
  addMeal({ slot, mealId, quantity = 1, sourceType = 'official_menu' }) {
    state.today.meals.push({
      slot, mealId, quantity, sourceType,
      addedAt: new Date().toISOString(),
    });
    persist();
  },
  setLastAnalysis(analysis) {
    state.lastAnalysis = analysis;
    persist();
  },
  reset() {
    state = structuredClone(DEFAULT_STATE);
    persist();
  },
};

/* ------------------------------------------------------------------ */
/* Router                                                             */
/* ------------------------------------------------------------------ */

const routes = {
  onboarding: { render: renderOnboarding,     mode: 'flow', tab: null },
  today:      { render: renderToday,          mode: 'tab',  tab: 'today' },
  meal:       { render: renderMealAnalysis,   mode: 'tab',  tab: 'meal'  },
  next:       { render: renderNextMeal,       mode: 'tab',  tab: 'next'  },
  days:       { render: renderDayCards,       mode: 'tab',  tab: 'today' },
  easter:     { render: renderEasterEgg,      mode: 'flow', tab: null },
  'meal-result': { render: renderMealAnalysis, mode: 'tab', tab: 'meal', params: { step: 'result' } },
};

let currentRoute = null;

function parseHash() {
  const h = (location.hash || '#/today').replace(/^#\/?/, '');
  const [name, qs] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { name: name || 'today', params };
}

export function navigate(name, params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs = new URLSearchParams(clean).toString();
  const next = `#/${name}${qs ? `?${qs}` : ''}`;
  if (location.hash === next) render();   // same-route re-render
  else location.hash = next;
}

function render() {
  const { name, params } = parseHash();
  const route = routes[name] ?? routes.today;

  // Guard: if not onboarded, force onboarding.
  if (!state.onboarded && name !== 'onboarding') {
    location.hash = '#/onboarding';
    return;
  }
  // If already onboarded and someone lands on onboarding, redirect to today.
  if (state.onboarded && name === 'onboarding') {
    location.hash = '#/today';
    return;
  }

  const device = document.getElementById('device');
  device.dataset.mode = route.mode;
  device.dataset.statusTheme = name === 'onboarding' && params.step === 'welcome' ? 'light' : 'light';

  // Update tab bar active state.
  document.querySelectorAll('.tab').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === route.tab);
  });

  const root = document.getElementById('screenRoot');
  root.scrollTop = 0;
  root.innerHTML = '';
  const merged = { ...route.params, ...params };
  currentRoute = { name, params: merged };
  route.render(root, merged, { navigate, store });

  updateStatusClock();
}

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

function updateStatusClock() {
  const el = document.getElementById('statusTime');
  if (!el) return;
  const d = new Date();
  el.textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.tab));
  });
}

let booted = false;

/**
 * Demo hook (?demo=1): seeds a reference profile for screen capture / live
 * demo deep-links. Only applies when no profile exists yet; normal visitors
 * and returning users are untouched.
 */
function seedDemo() {
  try {
    const usp = new URLSearchParams(location.search);
    // ?reset=1 wipes saved state so onboarding can be re-run (demo/teaching aid)
    if (usp.get('reset')) {
      localStorage.removeItem(STORAGE_KEY);
      state = structuredClone(DEFAULT_STATE);
      return;
    }
    if (!usp.get('demo') || state.onboarded) return;
    store.setProfile({
      age: 28, biologicalSex: 'female', heightCm: 165, weightKg: 60,
      activityLevel: 'light', trainingFrequency: 2, goal: 'lose_gentle',
      takeoutFrequency: 10, mealsPerDay: 3, breakfastHabit: 'convenience',
      wantsNutritionNumbers: false, calorieAttitude: 'no',
    });
  } catch {}
}

function boot() {
  if (booted) return;
  booted = true;
  seedDemo();
  bindTabs();
  setInterval(updateStatusClock, 30_000);
  updateStatusClock();
  if (!location.hash) location.hash = state.onboarded ? '#/today' : '#/onboarding';
  render();
}

/* Dev/verification hook — read-only view of app state. Safe to remove. */
window.__EAT__ = {
  get state() { return state; },
  store,
  navigate,
  version: 3,
};

window.addEventListener('hashchange', render);

/* Presentation handoff — hidden shortcut: press P to return to the launch
   presentation. When the app runs inside the presentation's iframe, we ask
   the parent to close the overlay; standalone, we navigate directly. */
window.addEventListener('keydown', (e) => {
  if (!e.key || e.key.toLowerCase() !== 'p') return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'eat:return-to-presentation' }, '*');
  } else {
    window.location.href = './presentation/index.html';
  }
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { currentRoute };
