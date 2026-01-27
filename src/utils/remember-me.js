const STORAGE_KEY = 'auth-remember-me';

const safeWindow = () => (typeof window === 'undefined' ? undefined : window);

const getStorage = () => {
  const win = safeWindow();
  if (!win) return null;
  try {
    return win.localStorage;
  } catch (error) {
    return null;
  }
};

export const getStoredRememberMe = () => {
  const storage = getStorage();
  if (!storage) {
    return false;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw === 'true';
  } catch (error) {
    return false;
  }
};

export const persistRememberMe = (value) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch (error) {
    // Ignore storage failures (private mode, etc.)
  }
};
