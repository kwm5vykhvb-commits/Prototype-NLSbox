import { JikanAnimeData, JikanCharacterData, Episode } from '../types';
import { offlineCacheService } from './offlineCacheService';
import { cleanTitleText, sanitizeDisplayTitle } from '../utils/sanitizeTitle';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours cache for anime metadata

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const titleToPosterCache = new Map<string, string>();
const episodeToAnimeCache = new Map<string, JikanAnimeData | null>();

// Initialize in-memory cache from IndexedDB on startup
if (typeof window !== 'undefined') {
  offlineCacheService.getAnimeMetadata('top_airing').then((topData) => {
    if (topData && Array.isArray(topData)) {
      cache.set('top_airing', { data: topData, timestamp: Date.now() });
    }
  }).catch(() => {});
}

export class JikanService {
  /**
   * Clean raw Telegram filename or post title to extract the core anime name
   * Example: "[FS-Fansub] Jujutsu Kaisen - S02E14 [1080p x264 VOSTFR].mkv" => "Jujutsu Kaisen"
   */
  static extractAnimeTitle(rawName: string): string {
    if (!rawName) return '';

    let cleaned = cleanTitleText(rawName);

    // 1. Remove file extensions
    cleaned = cleaned.replace(/\.(mp4|mkv|avi|mov|flv|webm)$/i, '');

    // 2. Remove bracketed groups like [Fansub], [1080p], (VOSTFR), (VF), etc.
    cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
    cleaned = cleaned.replace(/\([^)]*\)/g, ' ');

    // 3. Remove episode / season patterns: S01E02, S1 E2, Ep 04, Episode 12, E01, - 01, etc.
    cleaned = cleaned.replace(/\b(s\d{1,2}\s*e\d{1,3}|season\s*\d{1,2}|saison\s*\d{1,2}|ep(isode)?\s*\d{1,3}|e\d{1,3})\b/gi, ' ');
    cleaned = cleaned.replace(/\s*-\s*\d{1,3}\b/g, ' ');

    // 4. Remove common video quality/audio keywords
    cleaned = cleaned.replace(/\b(1080p|720p|480p|2160p|4k|fhd|hd|hevc|x264|x265|aac|vostfr|vf|raw|multi|fansub|bluray|bdrip|web-dl|webrip)\b/gi, ' ');

    // 5. Clean punctuation and excess whitespace
    cleaned = cleaned.replace(/[_\.]+/g, ' ');
    cleaned = cleaned.replace(/[-–—:]+$/g, ' ');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    return cleaned;
  }

  /**
   * Clean display title for better UI reading
   * Example: "[FS]_Solo_Leveling_S01E04_1080p.mp4" => "Solo Leveling S1 E4"
   */
  static formatDisplayTitle(rawTitle: string, rawFilename: string): string {
    return sanitizeDisplayTitle(rawTitle, rawFilename);
  }

  /**
   * Search animes on MyAnimeList via local proxy or Jikan API v4
   */
  static async searchAnime(query: string, limit: number = 5): Promise<JikanAnimeData[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const cacheKey = `search:${trimmed.toLowerCase()}:${limit}`;
    if (cache.has(cacheKey)) {
      const entry = cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }

    // 1. Try local server proxy first
    try {
      const res = await fetch(`/api/jikan/search?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const json = await res.json();
        const results: JikanAnimeData[] = json.data || [];
        if (results.length > 0) {
          cache.set(cacheKey, { data: results, timestamp: Date.now() });
          offlineCacheService.saveAnimeMetadata(cacheKey, results as any).catch(() => {});
          return results;
        }
      }
    } catch {
      // Ignore & fallback
    }

    // 2. Direct Jikan fallback
    try {
      const url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(trimmed)}&limit=${limit}&order_by=score&sort=desc&sfw=true`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const json = await res.json();
        const results: JikanAnimeData[] = json.data || [];
        cache.set(cacheKey, { data: results, timestamp: Date.now() });
        offlineCacheService.saveAnimeMetadata(cacheKey, results as any).catch(() => {});
        return results;
      }
    } catch {
      // ignore
    }

    // 3. Persistent Offline Cache Fallback
    try {
      const cached = await offlineCacheService.getAnimeMetadata(cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        cache.set(cacheKey, { data: cached, timestamp: Date.now() });
        return cached;
      }
    } catch {}

    return [];
  }

  /**
   * Get full details for an Anime by MAL ID
   */
  static async getAnimeById(malId: number): Promise<JikanAnimeData | null> {
    if (!malId) return null;

    const cacheKey = `anime:${malId}`;
    if (cache.has(cacheKey)) {
      const entry = cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }

    // 1. Local proxy
    try {
      const res = await fetch(`/api/jikan/anime/${malId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          cache.set(cacheKey, { data: json.data, timestamp: Date.now() });
          offlineCacheService.saveAnimeMetadata(cacheKey, json.data).catch(() => {});
          return json.data;
        }
      }
    } catch {}

    // 2. Direct Jikan
    try {
      const res = await fetch(`${JIKAN_BASE_URL}/anime/${malId}/full`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          cache.set(cacheKey, { data: json.data, timestamp: Date.now() });
          offlineCacheService.saveAnimeMetadata(cacheKey, json.data).catch(() => {});
          return json.data;
        }
      }
    } catch {}

    // 3. Offline storage fallback
    try {
      const offlineData = await offlineCacheService.getAnimeMetadata(cacheKey);
      if (offlineData) {
        cache.set(cacheKey, { data: offlineData, timestamp: Date.now() });
        return offlineData;
      }
    } catch {}

    return null;
  }

  /**
   * Get Character list and Voice Actors for an anime by MAL ID
   */
  static async getAnimeCharacters(malId: number): Promise<JikanCharacterData[]> {
    if (!malId) return [];

    const cacheKey = `characters:${malId}`;
    if (cache.has(cacheKey)) {
      const entry = cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }

    // 1. Local proxy
    try {
      const res = await fetch(`/api/jikan/characters/${malId}`);
      if (res.ok) {
        const json = await res.json();
        const data: JikanCharacterData[] = json.data || [];
        if (data.length > 0) {
          cache.set(cacheKey, { data, timestamp: Date.now() });
          return data;
        }
      }
    } catch {}

    // 2. Direct Jikan
    try {
      const res = await fetch(`${JIKAN_BASE_URL}/anime/${malId}/characters`);
      if (res.ok) {
        const json = await res.json();
        const data: JikanCharacterData[] = json.data || [];
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }
    } catch {}

    return [];
  }

  /**
   * Match an episode to its anime Jikan data
   */
  static async getAnimeForEpisode(episode: Episode): Promise<JikanAnimeData | null> {
    const raw = episode.title || episode.file_name || '';
    const clean = this.extractAnimeTitle(raw);
    if (!clean || clean.length < 2) return null;

    const cacheKey = clean.toLowerCase();
    if (episodeToAnimeCache.has(cacheKey)) {
      return episodeToAnimeCache.get(cacheKey) || null;
    }

    const results = await this.searchAnime(clean, 1);
    if (results && results.length > 0) {
      const anime = results[0];
      episodeToAnimeCache.set(cacheKey, anime);
      if (anime.images?.webp?.image_url || anime.images?.jpg?.image_url) {
        this.setCachedPoster(raw, anime.images.webp?.image_url || anime.images.jpg.image_url);
      }
      return anime;
    }

    episodeToAnimeCache.set(cacheKey, null);
    return null;
  }

  /**
   * Get Top / Trending anime (Air or Popularity) for quick discover suggestions
   */
  static async getTopTrendingAnime(): Promise<JikanAnimeData[]> {
    const cacheKey = 'top_airing';
    if (cache.has(cacheKey)) {
      const entry = cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }

    // 1. Try local server proxy
    try {
      const res = await fetch('/api/jikan/top');
      if (res.ok) {
        const json = await res.json();
        const results: JikanAnimeData[] = json.data || [];
        if (results.length > 0) {
          cache.set(cacheKey, { data: results, timestamp: Date.now() });
          offlineCacheService.saveAnimeMetadata(cacheKey, results as any).catch(() => {});
          return results;
        }
      }
    } catch {
      // Ignore
    }

    // 2. Direct Jikan fallback
    try {
      const url = `${JIKAN_BASE_URL}/top/anime?filter=airing&limit=10&sfw=true`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const json = await res.json();
        const results: JikanAnimeData[] = json.data || [];
        cache.set(cacheKey, { data: results, timestamp: Date.now() });
        offlineCacheService.saveAnimeMetadata(cacheKey, results as any).catch(() => {});
        return results;
      }
    } catch {
      // ignore
    }

    // 3. Offline storage fallback
    try {
      const offlineTop = await offlineCacheService.getAnimeMetadata(cacheKey);
      if (offlineTop && Array.isArray(offlineTop) && offlineTop.length > 0) {
        cache.set(cacheKey, { data: offlineTop, timestamp: Date.now() });
        return offlineTop;
      }
    } catch {}

    return [];
  }

  /**
   * Fast cache helper to get poster image URL for any episode title
   */
  static getCachedPoster(rawTitle: string): string | undefined {
    const clean = this.extractAnimeTitle(rawTitle).toLowerCase();
    if (titleToPosterCache.has(clean)) {
      return titleToPosterCache.get(clean);
    }
    return undefined;
  }

  /**
   * Asynchronously get poster with IndexedDB offline support
   */
  static async getPosterAsync(rawTitle: string): Promise<string | undefined> {
    const clean = this.extractAnimeTitle(rawTitle).toLowerCase();
    if (titleToPosterCache.has(clean)) {
      return titleToPosterCache.get(clean);
    }
    try {
      const fromDb = await offlineCacheService.getThumbnail(clean);
      if (fromDb) {
        titleToPosterCache.set(clean, fromDb);
        return fromDb;
      }
    } catch {}
    return undefined;
  }

  /**
   * Store poster image for an anime title in cache
   */
  static setCachedPoster(rawTitle: string, posterUrl: string): void {
    const clean = this.extractAnimeTitle(rawTitle).toLowerCase();
    if (clean && posterUrl) {
      titleToPosterCache.set(clean, posterUrl);
      offlineCacheService.saveThumbnail(clean, posterUrl).catch(() => {});
      offlineCacheService.cacheImageFromUrl(posterUrl, clean).catch(() => {});
    }
  }
}
