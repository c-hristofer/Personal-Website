import {
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  setPersistence,
} from 'firebase/auth';

const isStorageUnavailableError = (error) => {
  if (!error) return false;
  const { code, message } = error;
  if (code === 'auth/web-storage-unsupported' || code === 'auth/internal-error') {
    return true;
  }
  const text = (message || '').toLowerCase();
  return text.includes('insecure')
    || text.includes('securityerr')
    || text.includes('quota')
    || text.includes('storage');
};

const describeResult = (persistence) => {
  if (persistence === browserLocalPersistence) return 'local';
  if (persistence === browserSessionPersistence) return 'session';
  return 'memory';
};

export const applyPersistencePreference = async (auth, preference = 'session') => {
  const order = preference === 'local'
    ? [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
    : [browserSessionPersistence, inMemoryPersistence];

  let lastError = null;
  for (const persistence of order) {
    try {
      await setPersistence(auth, persistence);
      return describeResult(persistence);
    } catch (error) {
      lastError = error;
      if (!isStorageUnavailableError(error)) {
        throw error;
      }
    }
  }
  throw lastError || new Error('Unable to set persistence');
};
