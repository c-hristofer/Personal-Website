const STORAGE_KEY = 'auth-remember-me';

const safeWindow = () => (typeof window === 'undefined' ? undefined : window);

export const getStoredRememberMe = () => {
  const win = safeWindow();
  if (!win) {
    return false;
  }
  try {
    const raw = win.localStorage.getItem(STORAGE_KEY);
    return raw === 'true';
  } catch (error) {
    return false;
  }
};

export const persistRememberMe = (value) => {
  const win = safeWindow();
  if (!win) {
    return;
  }
  try {
    win.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch (error) {
    // Ignore storage failures (private mode, etc.)
  }
};
