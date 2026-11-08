/**
 * Permanent Client-Side Promo Storage & Auto-Healing Engine
 * Uses browser IndexedDB to permanently store promo audio binaries and metadata.
 * Survives page reloads, server restarts, container recreations, and offline scenarios.
 * Automatically restores missing promos back to the server if the server restarts.
 */

import { PromoClip } from '../types';

const DB_NAME = 'Sangeet_Promo_Storage_v1';
const DB_VERSION = 1;
const STORE_NAME = 'promo_clips';

export interface StoredPromoRecord {
  id: string;
  title: string;
  categoryId: string;
  audioUrl: string;
  audioData?: string; // Base64 Data URL or Blob string for offline/restore guarantee
  duration: number;
  enabled: boolean;
  playsCount: number;
  scriptSnippet?: string;
  storageType?: 'cloud' | 'preset' | 'custom';
  fileSizeBytes?: number;
  fileName?: string;
  uploadedAt: number;
  isCloudSaved?: boolean;
}

// In-memory cache of resolved Blob URLs for instant audio playback
const blobUrlCache = new Map<string, string>();

/**
 * Open IndexedDB database safely
 */
function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('categoryId', 'categoryId', { unique: false });
          store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (e) => {
        console.warn('[PromoStorage] IndexedDB open error:', e);
        resolve(null);
      };
    } catch (err) {
      console.warn('[PromoStorage] Failed to initialize IndexedDB:', err);
      resolve(null);
    }
  });
}

/**
 * Save promo clip and its raw audio to permanent client-side IndexedDB
 */
export async function savePromoToLocalDB(
  promo: PromoClip,
  rawAudioData?: string
): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: StoredPromoRecord = {
        id: promo.id,
        title: promo.title,
        categoryId: promo.categoryId,
        audioUrl: promo.audioUrl,
        audioData: rawAudioData || (promo.audioUrl.startsWith('data:') ? promo.audioUrl : undefined),
        duration: promo.duration,
        enabled: promo.enabled ?? true,
        playsCount: promo.playsCount || 0,
        scriptSnippet: promo.scriptSnippet,
        storageType: promo.storageType || 'cloud',
        fileSizeBytes: promo.fileSizeBytes,
        fileName: promo.fileName,
        uploadedAt: promo.uploadedAt || Date.now(),
        isCloudSaved: true,
      };

      const putReq = store.put(record);

      putReq.onsuccess = () => {
        console.log(`[PromoStorage] Successfully saved "${promo.title}" to permanent IndexedDB`);
        // If raw audio data is present, cache as Blob URL
        if (record.audioData && record.audioData.startsWith('data:')) {
          createBlobUrlFromDataUri(promo.id, record.audioData);
        }
        resolve(true);
      };

      putReq.onerror = (err) => {
        console.warn('[PromoStorage] Error saving to IndexedDB:', err);
        resolve(false);
      };
    } catch (err) {
      console.warn('[PromoStorage] Transaction error:', err);
      resolve(false);
    }
  });
}

/**
 * Get all custom promos saved in IndexedDB
 */
export async function getAllLocalPromos(): Promise<StoredPromoRecord[]> {
  const db = await openDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results: StoredPromoRecord[] = req.result || [];
        resolve(results);
      };

      req.onerror = () => {
        resolve([]);
      };
    } catch {
      resolve([]);
    }
  });
}

/**
 * Get raw audio data (Data URL or Blob URL) for a promo ID
 */
export async function getLocalPromoAudio(promoId: string): Promise<string | null> {
  // Check memory Blob URL cache first
  if (blobUrlCache.has(promoId)) {
    return blobUrlCache.get(promoId)!;
  }

  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(promoId);

      req.onsuccess = () => {
        const item: StoredPromoRecord | undefined = req.result;
        if (item && item.audioData) {
          const blobUrl = createBlobUrlFromDataUri(promoId, item.audioData);
          resolve(blobUrl || item.audioData);
        } else if (item && item.audioUrl) {
          resolve(item.audioUrl);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Delete promo from IndexedDB
 */
export async function deletePromoFromLocalDB(promoId: string): Promise<boolean> {
  // Revoke cached Blob URL if any
  if (blobUrlCache.has(promoId)) {
    try {
      URL.revokeObjectURL(blobUrlCache.get(promoId)!);
    } catch {
      // ignore
    }
    blobUrlCache.delete(promoId);
  }

  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(promoId);

      req.onsuccess = () => {
        console.log(`[PromoStorage] Deleted promo ${promoId} from IndexedDB`);
        resolve(true);
      };

      req.onerror = () => {
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

/**
 * Helper: Convert Data URL to high-performance Blob URL
 */
function createBlobUrlFromDataUri(promoId: string, dataUrl: string): string | null {
  try {
    if (!dataUrl.startsWith('data:')) return dataUrl;
    const parts = dataUrl.split(';base64,');
    if (parts.length !== 2) return dataUrl;

    const mime = parts[0].replace('data:', '');
    const byteCharacters = atob(parts[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mime || 'audio/mpeg' });
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(promoId, blobUrl);
    return blobUrl;
  } catch (e) {
    console.warn('[PromoStorage] Error converting Data URL to Blob:', e);
    return dataUrl;
  }
}

/**
 * Self-Healing Synchronization Engine:
 * Compares current server promos with permanent IndexedDB promos.
 * If server container has restarted or lost custom uploaded clips,
 * this automatically sends them back to the server in the background!
 */
export async function healServerPromosFromIndexedDB(
  stationId: string,
  serverPromos: PromoClip[],
  onRestored?: (restoredCount: number, updatedPromos: PromoClip[]) => void
): Promise<void> {
  try {
    const localRecords = await getAllLocalPromos();
    if (localRecords.length === 0) return;

    // Identify custom promos that exist locally in IndexedDB but are missing from server
    const serverIds = new Set(serverPromos.map((p) => p.id));
    const serverTitles = new Set(serverPromos.map((p) => p.title.trim().toLowerCase()));

    const missingPromos = localRecords.filter((local) => {
      // If server doesn't have ID AND doesn't have same title
      const hasId = serverIds.has(local.id);
      const hasTitle = serverTitles.has(local.title.trim().toLowerCase());
      return !hasId && !hasTitle && Boolean(local.audioData || local.audioUrl);
    });

    if (missingPromos.length === 0) {
      return;
    }

    console.log(`[PromoStorage] Server container restarted or missing ${missingPromos.length} custom promo(s). Auto-restoring from IndexedDB...`);

    const res = await fetch(`/api/storage/promos/sync-restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId,
        promos: missingPromos.map((m) => ({
          id: m.id,
          title: m.title,
          categoryId: m.categoryId,
          audioUrl: m.audioUrl,
          audioData: m.audioData,
          duration: m.duration,
          enabled: m.enabled,
          scriptSnippet: m.scriptSnippet,
          storageType: m.storageType || 'cloud',
          fileSizeBytes: m.fileSizeBytes,
          fileName: m.fileName,
          uploadedAt: m.uploadedAt,
        })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.promos)) {
        console.log(`[PromoStorage] Auto-restored ${data.restoredCount || missingPromos.length} promo(s) successfully to server!`);
        onRestored?.(data.restoredCount || missingPromos.length, data.promos);
      }
    }
  } catch (err) {
    console.warn('[PromoStorage] Auto-restore sync attempt warning:', err);
  }
}
