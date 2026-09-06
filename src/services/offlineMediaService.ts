/**
 * Offline Media Storage Engine
 * Stores full binary Blobs (MP4, MKV, MP3, CBZ, PDF) persistently in IndexedDB
 * so users can watch and stream movies, animes, series, and read mangas
 * 100% offline without consuming any mobile data plan (SANS FORFAIT).
 */

export interface OfflineMediaRecord {
  messageId: number;
  title: string;
  fileName: string;
  sizeMb: number;
  mimeType: string;
  channel: string;
  blob: Blob;
  savedAt: number;
  duration?: string;
  thumbnail?: string;
  category?: string;
}

export interface OfflineMediaMeta {
  messageId: number;
  title: string;
  fileName: string;
  sizeMb: number;
  mimeType: string;
  channel: string;
  savedAt: number;
  duration?: string;
  thumbnail?: string;
  category?: string;
}

const DB_NAME = 'nlsbox_offline_media_vault';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

class OfflineMediaVaultService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private activeBlobUrls = new Map<number, string>();

  private getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'messageId' });
          }
        };
        request.onsuccess = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          resolve(db);
        };
        request.onerror = (e) => {
          console.warn('[OfflineMediaVault] Failed to open IndexedDB:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[OfflineMediaVault] IndexedDB init error:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Saves a full media file (video/audio/manga/doc) into persistent local storage
   */
  async saveMedia(record: Omit<OfflineMediaRecord, 'savedAt'>): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    const fullRecord: OfflineMediaRecord = {
      ...record,
      savedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(fullRecord);
        req.onsuccess = () => resolve();
        req.onerror = (err) => reject(err);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Retrieves the full offline media record
   */
  async getMedia(messageId: number): Promise<OfflineMediaRecord | null> {
    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(messageId);
        req.onsuccess = () => {
          resolve(req.result || null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Check if an episode is already saved offline
   */
  async hasMedia(messageId: number): Promise<boolean> {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getKey(messageId);
        req.onsuccess = () => {
          resolve(req.result !== undefined);
        };
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Returns a local object URL (blob:...) that can be passed directly to <video src="...">
   * or <a href="..."> without requiring any network requests or data forfait!
   */
  async getMediaBlobUrl(messageId: number): Promise<string | null> {
    // If we already generated an active Blob URL, reuse it
    if (this.activeBlobUrls.has(messageId)) {
      return this.activeBlobUrls.get(messageId)!;
    }

    const record = await this.getMedia(messageId);
    if (!record || !record.blob) return null;

    const url = URL.createObjectURL(record.blob);
    this.activeBlobUrls.set(messageId, url);
    return url;
  }

  /**
   * Returns raw Blob
   */
  async getMediaBlob(messageId: number): Promise<Blob | null> {
    const record = await this.getMedia(messageId);
    return record?.blob || null;
  }

  /**
   * Deletes a media file from offline storage
   */
  async deleteMedia(messageId: number): Promise<void> {
    if (this.activeBlobUrls.has(messageId)) {
      try {
        URL.revokeObjectURL(this.activeBlobUrls.get(messageId)!);
      } catch {}
      this.activeBlobUrls.delete(messageId);
    }

    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(messageId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Returns all downloaded offline media metadata (without loading heavy Blobs into memory)
   */
  async getAllMediaMeta(): Promise<OfflineMediaMeta[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        const results: OfflineMediaMeta[] = [];

        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            const val = cursor.value as OfflineMediaRecord;
            results.push({
              messageId: val.messageId,
              title: val.title,
              fileName: val.fileName,
              sizeMb: val.sizeMb,
              mimeType: val.mimeType,
              channel: val.channel,
              savedAt: val.savedAt,
              duration: val.duration,
              thumbnail: val.thumbnail,
              category: val.category,
            });
            cursor.continue();
          } else {
            resolve(results.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)));
          }
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  /**
   * Returns set of all message IDs stored offline
   */
  async getAllDownloadedIds(): Promise<Set<number>> {
    const db = await this.getDB();
    if (!db) return new Set();

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => {
          const keys = (req.result || []) as number[];
          resolve(new Set(keys));
        };
        req.onerror = () => resolve(new Set());
      } catch {
        resolve(new Set());
      }
    });
  }

  /**
   * Computes total storage used by offline media in bytes and formatted string
   */
  async getTotalStorageUsed(): Promise<{ totalBytes: number; formatted: string }> {
    const metas = await this.getAllMediaMeta();
    const totalBytes = metas.reduce((acc, m) => acc + (m.sizeMb * 1024 * 1024), 0);
    const totalMb = totalBytes / (1024 * 1024);

    const formatted = totalMb >= 1024
      ? `${(totalMb / 1024).toFixed(2)} Go`
      : `${totalMb.toFixed(1)} Mo`;

    return { totalBytes, formatted };
  }

  /**
   * Clears all offline media
   */
  async clearAllMedia(): Promise<void> {
    for (const url of this.activeBlobUrls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.activeBlobUrls.clear();

    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

export const offlineMediaService = new OfflineMediaVaultService();
