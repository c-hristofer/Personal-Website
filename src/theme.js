const STORAGE_KEY = 'theme-preference';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';
const VALID_PREFERENCES = new Set(['light', 'dark', 'system']);

let initialized = false;
let currentPreference = 'system';
let effectiveTheme = 'light';
let mediaQuery;
let mediaQueryHandler;
const listeners = new Set();

const safeWindow = () => (typeof window === 'undefined' ? undefined : window);
const safeDocument = () => (typeof document === 'undefined' ? undefined : document);

const readStoredPreference = () => {
  const win = safeWindow();
  if (!win) return 'system';
  try {
    const value = win.localStorage.getItem(STORAGE_KEY);
    return VALID_PREFERENCES.has(value) ? value : 'system';
  } catch (error) {
    return 'system';
  }
};

const persistPreference = (mode) => {
  const win = safeWindow();
  if (!win) return;
  try {
    win.localStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    // Ignore storage failures (private browsing, etc.)
  }
};

const getMediaQuery = () => {
  if (mediaQuery || !safeWindow()) {
    return mediaQuery;
  }
  mediaQuery = window.matchMedia(MEDIA_QUERY);
  return mediaQuery;
};

const resolveTheme = (preference) => {
  if (preference !== 'system') {
    return preference;
  }
  const mq = getMediaQuery();
  return mq && mq.matches ? 'dark' : 'light';
};

const applyTheme = (theme, source) => {
  const doc = safeDocument();
  if (!doc) return;
  const root = doc.documentElement;
  root.dataset.theme = theme;
  root.dataset.themeSource = source;
  root.style.colorScheme = theme;
};

const notify = () => {
  listeners.forEach((callback) => {
    callback({ preference: currentPreference, effectiveTheme });
  });
};

const ensureInitializedValues = () => {
  if (!initialized && safeWindow()) {
    currentPreference = readStoredPreference();
    effectiveTheme = resolveTheme(currentPreference);
  }
};

const attachMediaListener = () => {
  const mq = getMediaQuery();
  if (!mq || mediaQueryHandler) {
    return;
  }
  mediaQueryHandler = (event) => {
    if (currentPreference === 'system') {
      effectiveTheme = event.matches ? 'dark' : 'light';
      applyTheme(effectiveTheme, currentPreference);
      notify();
    }
  };
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', mediaQueryHandler);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(mediaQueryHandler);
  }
};

const init = () => {
  if (initialized || !safeDocument()) {
    return;
  }
  ensureInitializedValues();
  applyTheme(effectiveTheme, currentPreference);
  attachMediaListener();
  initialized = true;
  notify();
};

const setPreference = (preference) => {
  if (!VALID_PREFERENCES.has(preference)) {
    preference = 'system';
  }
  currentPreference = preference;
  persistPreference(preference);
  effectiveTheme = resolveTheme(preference);
  applyTheme(effectiveTheme, currentPreference);
  notify();
};

const getPreference = () => {
  ensureInitializedValues();
  return currentPreference;
};

const getEffectiveTheme = () => {
  ensureInitializedValues();
  return effectiveTheme;
};

const subscribe = (callback) => {
  listeners.add(callback);
  callback({ preference: getPreference(), effectiveTheme: getEffectiveTheme() });
  return () => {
    listeners.delete(callback);
  };
};

export const themeManager = {
  init,
  setPreference,
  getPreference,
  getEffectiveTheme,
  subscribe,
};
