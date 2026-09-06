/**
 * OfflineCacheService
 * Robust client-side persistent storage engine powered by IndexedDB (with graceful localStorage fallback).
 * Ensures instant loading of thumbnails, posters, MAL metadata, catalogs and manga scans even without Internet.
 */

import { Episode, JikanAnimeData } from '../types';

const DB_NAME = 'nlsbox_offline_v2';
const DB_VERSION = 1;

const STORES = {
  THUMBNAILS: 'thumbnails',
  METADATA: 'metadata',
  CATALOGS: 'catalogs',
  PLAYBACK: 'playback',
  MANGA: 'manga',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

class OfflineCacheEngine {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isIndexedDbAvailable: boolean = typeof indexedDB !== 'undefined';

  constructor() {
    if (this.isIndexedDbAvailable) {
      this.initDB().catch((err) => {
        console.warn('[OfflineCache] IndexedDB initialization failed, falling back to localStorage', err);
        this.isIndexedDbAvailable = false;
      });
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (!this.isIndexedDbAvailable) {
        return resolve(null);
      }

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORES.THUMBNAILS)) {
            db.createObjectStore(STORES.THUMBNAILS, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORES.METADATA)) {
            db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORES.CATALOGS)) {
            db.createObjectStore(STORES.CATALOGS, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORES.PLAYBACK)) {
            db.createObjectStore(STORES.PLAYBACK, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORES.MANGA)) {
            db.createObjectStore(STORES.MANGA, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          console.warn('[OfflineCache] Could not open IndexedDB:', request.error);
          resolve(null);
        };
      } catch (err) {
        console.warn('[OfflineCache] Exception opening IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private async getStore(storeName: StoreName, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore | null> {
    const db = await this.initDB();
    if (!db) return null;
    try {
      const tx = db.transaction(storeName, mode);
      return tx.objectStore(storeName);
    } catch {
      return null;
    }
  }

  // --- Generic Key-Value Helpers ---

  private async setItem<T>(storeName: StoreName, key: string, value: T): Promise<void> {
    const cleanKey = key.trim().toLowerCase();
    const store = await this.getStore(storeName, 'readwrite');
    if (store) {
      return new Promise((resolve) => {
        const req = store.put({ key: cleanKey, data: value, timestamp: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    }

    // LocalStorage fallback
    try {
      localStorage.setItem(`nls_${storeName}_${cleanKey}`, JSON.stringify({ data: value, timestamp: Date.now() }));
    } catch {
      // Storage quota exceeded or private mode
    }
  }

  private async getItem<T>(storeName: StoreName, key: string): Promise<T | null> {
    const cleanKey = key.trim().toLowerCase();
    const store = await this.getStore(storeName, 'readonly');
    if (store) {
      return new Promise((resolve) => {
        const req = store.get(cleanKey);
        req.onsuccess = () => {
          if (req.result && req.result.data !== undefined) {
            resolve(req.result.data as T);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    }

    // LocalStorage fallback
    try {
      const raw = localStorage.getItem(`nls_${storeName}_${cleanKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.data as T;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async getAllItems<T>(storeName: StoreName): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    if (store) {
      return new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const results = (req.result || []).map((entry: any) => entry.data as T);
          resolve(results);
        };
        req.onerror = () => resolve([]);
      });
    }

    // LocalStorage fallback
    try {
      const prefix = `nls_${storeName}_`;
      const items: T[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const raw = localStorage.getItem(k);
          if (raw) {
            items.push(JSON.parse(raw).data);
          }
        }
      }
      return items;
    } catch {
      return [];
    }
  }

  // --- 1. Thumbnails & Posters Cache ---

  async saveThumbnail(key: string, dataUrl: string): Promise<void> {
    await this.setItem(STORES.THUMBNAILS, key, dataUrl);
  }

  async getThumbnail(key: string): Promise<string | null> {
    return this.getItem<string>(STORES.THUMBNAILS, key);
  }

  /**
   * Automatically fetch an image URL, convert it to Base64 dataURL, and store in cache
   * So when offline, <img src={cachedUrl} /> loads instantly!
   */
  async cacheImageFromUrl(imageUrl: string, cacheKey?: string): Promise<string | null> {
    if (!imageUrl || imageUrl.startsWith('data:')) return imageUrl;

    const key = cacheKey || imageUrl;
    const existing = await this.getThumbnail(key);
    if (existing) return existing;

    try {
      const response = await fetch(imageUrl, {
        mode: 'cors',
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return null;
      const blob = await response.blob();

      return new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          if (base64data && base64data.length > 50) {
            this.saveThumbnail(key, base64data).catch(() => {});
            resolve(base64data);
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // --- 2. Jikan / MAL Anime Metadata Cache ---

  async saveAnimeMetadata(key: string, data: JikanAnimeData): Promise<void> {
    await this.setItem(STORES.METADATA, key, data);
    // Also cache the poster thumbnail in background
    const posterUrl = data.images.webp?.large_image_url || data.images.jpg.large_image_url || data.images.jpg.image_url;
    if (posterUrl) {
      this.cacheImageFromUrl(posterUrl, key).catch(() => {});
    }
  }

  async getAnimeMetadata(key: string): Promise<JikanAnimeData | null> {
    return this.getItem<JikanAnimeData>(STORES.METADATA, key);
  }

  // --- 3. Channels Catalog & Feed Cache ---

  async saveCatalog(channelKey: string, episodes: Episode[], category: string = 'anime'): Promise<void> {
    if (!episodes || episodes.length === 0) return;
    const entry = {
      channel: channelKey,
      category,
      episodes,
      savedAt: new Date().toISOString(),
    };
    await this.setItem(STORES.CATALOGS, channelKey, entry);

    // Pre-cache posters of the first 5 episodes in background
    for (let i = 0; i < Math.min(5, episodes.length); i++) {
      const ep = episodes[i];
      if (ep.thumbnail) {
        this.cacheImageFromUrl(ep.thumbnail, ep.title || ep.file_name).catch(() => {});
      }
    }
  }

  async getCatalog(channelKey: string): Promise<{ episodes: Episode[]; category?: string; savedAt?: string } | null> {
    return this.getItem<{ episodes: Episode[]; category?: string; savedAt?: string }>(STORES.CATALOGS, channelKey);
  }

  async getAllCachedCatalogs(): Promise<Array<{ channel: string; category?: string; episodes: Episode[]; savedAt?: string }>> {
    return this.getAllItems<{ channel: string; category?: string; episodes: Episode[]; savedAt?: string }>(STORES.CATALOGS);
  }

  // --- 4. Playback History & Auto-Resume ---

  async savePlaybackPosition(
    messageId: number,
    currentTime: number,
    duration: number,
    extra?: { title?: string; channel?: string }
  ): Promise<void> {
    if (isNaN(currentTime) || currentTime <= 0) return;
    const key = String(messageId);
    const data = {
      messageId,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration || 0),
      title: extra?.title,
      channel: extra?.channel,
      percent: duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0,
      updatedAt: Date.now(),
    };
    await this.setItem(STORES.PLAYBACK, key, data);
  }

  async getPlaybackPosition(messageId: number): Promise<{ currentTime: number; duration: number; percent: number } | null> {
    return this.getItem<{ currentTime: number; duration: number; percent: number }>(STORES.PLAYBACK, String(messageId));
  }

  async getAllPlaybackHistory(): Promise<Array<{ messageId: number; currentTime: number; duration: number; title?: string; percent: number; updatedAt: number }>> {
    const list = await this.getAllItems<{ messageId: number; currentTime: number; duration: number; title?: string; percent: number; updatedAt: number }>(STORES.PLAYBACK);
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  // --- 5. Manga Scans & Chapters Cache ---

  async saveMangaChapter(chapterKey: string, pages: string[], title: string): Promise<void> {
    const data = {
      chapterKey,
      title,
      pages,
      savedAt: Date.now(),
    };
    await this.setItem(STORES.MANGA, chapterKey, data);
  }

  async getMangaChapter(chapterKey: string): Promise<{ pages: string[]; title: string } | null> {
    return this.getItem<{ pages: string[]; title: string }>(STORES.MANGA, chapterKey);
  }

  // --- Storage Stats & Maintenance ---

  async getCacheStats(): Promise<{
    thumbnailsCount: number;
    catalogsCount: number;
    metadataCount: number;
    playbackCount: number;
    mangaCount: number;
    isOfflineReady: boolean;
  }> {
    const [thumbs, cats, metas, play, manga] = await Promise.all([
      this.getAllItems(STORES.THUMBNAILS),
      this.getAllItems(STORES.CATALOGS),
      this.getAllItems(STORES.METADATA),
      this.getAllItems(STORES.PLAYBACK),
      this.getAllItems(STORES.MANGA),
    ]);

    return {
      thumbnailsCount: thumbs.length,
      catalogsCount: cats.length,
      metadataCount: metas.length,
      playbackCount: play.length,
      mangaCount: manga.length,
      isOfflineReady: cats.length > 0 || thumbs.length > 0,
    };
  }

  async clearCache(): Promise<void> {
    const db = await this.initDB();
    if (db) {
      const stores: StoreName[] = [STORES.THUMBNAILS, STORES.METADATA, STORES.CATALOGS, STORES.MANGA];
      for (const name of stores) {
        try {
          const tx = db.transaction(name, 'readwrite');
          tx.objectStore(name).clear();
        } catch {}
      }
    }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('nls_thumbnails_') || k.startsWith('nls_metadata_') || k.startsWith('nls_catalogs_') || k.startsWith('nls_manga_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}

export const offlineCacheService = new OfflineCacheEngine();
