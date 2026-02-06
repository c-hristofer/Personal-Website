const INTERVAL_TIMER_SETTINGS_KEY = 'intervalTimerSettings';
const INTERVAL_TIMER_LAST_VIEW_KEY = 'intervalTimerLastView';
export const INTERVAL_TIMER_SETTINGS_EVENT = 'intervalTimerSettingsUpdated';

const VALID_VIEW_PREFERENCES = new Set(['split', 'focus', 'last']);

export const DEFAULT_INTERVAL_TIMER_SETTINGS = {
  soundEnabled: true,
  viewPreference: 'split',
};

const normalizeSettings = (raw = {}) => {
  const viewPreference = VALID_VIEW_PREFERENCES.has(raw.viewPreference)
    ? raw.viewPreference
    : DEFAULT_INTERVAL_TIMER_SETTINGS.viewPreference;
  return {
    soundEnabled: raw.soundEnabled !== false,
    viewPreference,
  };
};

export const getIntervalTimerSettings = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_INTERVAL_TIMER_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(INTERVAL_TIMER_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return normalizeSettings(parsed);
  } catch (error) {
    return DEFAULT_INTERVAL_TIMER_SETTINGS;
  }
};

export const saveIntervalTimerSettings = (settings) => {
  if (typeof window === 'undefined') return;
  const nextSettings = normalizeSettings(settings);
  window.localStorage.setItem(INTERVAL_TIMER_SETTINGS_KEY, JSON.stringify(nextSettings));
  window.dispatchEvent(new Event(INTERVAL_TIMER_SETTINGS_EVENT));
};

export const getStoredIntervalView = () => {
  if (typeof window === 'undefined') return 'split';
  try {
    const value = window.localStorage.getItem(INTERVAL_TIMER_LAST_VIEW_KEY);
    return value === 'focus' ? 'focus' : 'split';
  } catch (error) {
    return 'split';
  }
};

export const setStoredIntervalView = (view) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INTERVAL_TIMER_LAST_VIEW_KEY, view === 'focus' ? 'focus' : 'split');
};

export const getInitialIntervalView = () => {
  const settings = getIntervalTimerSettings();
  if (settings.viewPreference === 'focus') return 'focus';
  if (settings.viewPreference === 'split') return 'split';
  return getStoredIntervalView();
};
