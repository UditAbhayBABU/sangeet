/**
 * Bulletproof Safe Storage Wrapper
 * Guarantees zero crashes in sandboxed iframes, incognito windows, or environments
 * where window.localStorage throws a DOMException: SecurityError.
 */

const memoryStore = new Map<string, string>();

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__sangeet_storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const canUseLocalStorage = isStorageAvailable();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (canUseLocalStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Ignore security errors
    }
    return memoryStore.get(key) || null;
  },

  setItem(key: string, value: string): void {
    try {
      if (canUseLocalStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore quota or security errors
    }
    memoryStore.set(key, value);
  },

  removeItem(key: string): void {
    try {
      if (canUseLocalStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore security errors
    }
    memoryStore.delete(key);
  },

  clear(): void {
    try {
      if (canUseLocalStorage) {
        window.localStorage.clear();
      }
    } catch {
      // Ignore security errors
    }
    memoryStore.clear();
  },
};
