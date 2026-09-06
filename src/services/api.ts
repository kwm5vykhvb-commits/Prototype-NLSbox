import { CatalogResponse, Episode } from '../types';
import { generateSearchVariants } from '../utils/searchHelper';
import { offlineCacheService } from './offlineCacheService';
import { sanitizeEpisode } from '../utils/sanitizeTitle';

export const DEFAULT_BACKEND_URL = 'https://nlsbox.onrender.com';

// In-memory cache with 5 minutes TTL to prevent repetitive queries to Telegram API
interface CacheEntry {
  data: CatalogResponse;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class NlsApiService {
  /**
   * Helper delay for anti-FloodWait rate limiting
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute single search request securely via local Express proxy
   */
  private static async executeSingleSearch(
    _cleanBase: string,
    cleanChannel: string,
    searchQuery: string
  ): Promise<CatalogResponse> {
    try {
      const proxyUrl = `/api/search?channel=${encodeURIComponent(cleanChannel)}&q=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data && Array.isArray(data.episodes)) {
        return {
          ...data,
          episodes: data.episodes.map((ep: any) =>
            sanitizeEpisode({
              ...ep,
              channel: cleanChannel,
            })
          ),
        };
      }

      if (!response.ok) {
        throw new Error(data?.error || data?.detail || `Erreur serveur ${response.status}`);
      }
    } catch (proxyErr: any) {
      throw new Error(proxyErr?.message || 'Impossible de joindre le serveur de recherche');
    }

    return {
      channel: cleanChannel,
      query: searchQuery,
      total_found: 0,
      episodes: [],
    };
  }

  /**
   * Search animes directly against the FastAPI /search endpoint with anti-flood caching
   * and automatic tolerance/variant recovery (accents, punctuation, stop-words)
   */
  static async searchAnimes(
    baseUrl: string,
    channelId: string,
    query: string = '',
    bypassCache: boolean = false
  ): Promise<CatalogResponse> {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanChannel = channelId.trim().replace(/^@/, '');
    const cacheKey = `${cleanBase}:${cleanChannel}:${query.toLowerCase().trim()}`;

    // Check cache
    if (!bypassCache && queryCache.has(cacheKey)) {
      const entry = queryCache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
      queryCache.delete(cacheKey);
    }

    // 1. First attempt with user's exact query
    let result: CatalogResponse;
    try {
      result = await this.executeSingleSearch(cleanBase, cleanChannel, query);

      // 2. If no results found and query has punctuation, accents or complex terms,
      // try intelligent variants (e.g. normalized accents, stripped apostrophe)
      if ((!result.episodes || result.episodes.length === 0) && query.trim().length >= 3) {
        const variants = generateSearchVariants(query).filter(v => v !== query.trim());
        for (const variant of variants) {
          try {
            const fallbackRes = await this.executeSingleSearch(cleanBase, cleanChannel, variant);
            if (fallbackRes.episodes && fallbackRes.episodes.length > 0) {
              result = fallbackRes;
              break;
            }
          } catch {
            // ignore variant errors
          }
        }
      }

      // Save to in-memory and persistent offline cache
      queryCache.set(cacheKey, { data: result, timestamp: Date.now() });
      if (result.episodes && result.episodes.length > 0) {
        offlineCacheService.saveCatalog(cacheKey, result.episodes).catch(() => {});
      }
      return result;
    } catch (networkErr: any) {
      // Offline fallback: check if we have cached catalog for this channel
      const cached = await offlineCacheService.getCatalog(cacheKey);
      if (cached && cached.episodes && cached.episodes.length > 0) {
        const fallbackCatalog: CatalogResponse = {
          channel: cleanChannel,
          query,
          total_found: cached.episodes.length,
          episodes: cached.episodes.map(sanitizeEpisode),
        };
        queryCache.set(cacheKey, { data: fallbackCatalog, timestamp: Date.now() });
        return fallbackCatalog;
      }
      throw networkErr;
    }
  }

  /**
   * Search multiple channels safely with staggered requests to prevent FloodWait / bans
   */
  static async searchMultiChannels(
    baseUrl: string,
    channelIds: string[],
    query: string = '',
    onProgress?: (currentChannel: string, completedCount: number, total: number) => void
  ): Promise<{
    episodes: Episode[];
    totalFound: number;
    channelResults: Record<string, { count: number; error?: string }>;
  }> {
    const cleanChannels = Array.from(
      new Set(channelIds.map((c) => c.trim().replace(/^@/, '')).filter(Boolean))
    );

    if (cleanChannels.length === 0) {
      return { episodes: [], totalFound: 0, channelResults: {} };
    }

    const allEpisodes: Episode[] = [];
    const channelResults: Record<string, { count: number; error?: string }> = {};

    for (let i = 0; i < cleanChannels.length; i++) {
      const channel = cleanChannels[i];
      if (onProgress) {
        onProgress(channel, i, cleanChannels.length);
      }

      try {
        const response = await this.searchAnimes(baseUrl, channel, query);
        const eps = (response.episodes || []).map((ep) => ({
          ...ep,
          channel: channel,
        }));
        allEpisodes.push(...eps);
        channelResults[channel] = { count: eps.length };
      } catch (err: any) {
        channelResults[channel] = {
          count: 0,
          error: err?.message || 'Erreur lors de la recherche',
        };
      }

      // Anti-Flood Stagger: Pause 220ms between requests if multiple channels
      if (i < cleanChannels.length - 1) {
        await this.sleep(220);
      }
    }

    if (onProgress) {
      onProgress('Terminé', cleanChannels.length, cleanChannels.length);
    }

    // Deduplicate by message_id + channel to avoid duplicates
    const seen = new Set<string>();
    const uniqueEpisodes: Episode[] = [];

    for (const ep of allEpisodes) {
      const key = `${ep.channel || ''}_${ep.message_id}_${ep.file_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEpisodes.push(ep);
      }
    }

    return {
      episodes: uniqueEpisodes,
      totalFound: uniqueEpisodes.length,
      channelResults,
    };
  }

  /**
   * Clear the in-memory query cache
   */
  static clearCache(): void {
    queryCache.clear();
  }

  /**
   * Test live connection with backend
   */
  static async testConnection(baseUrl: string): Promise<{
    ok: boolean;
    status: number | string;
    message?: string;
    timeMs: number;
  }> {
    const start = Date.now();
    const cleanBase = baseUrl.replace(/\/+$/, '');

    try {
      const response = await fetch(`${cleanBase}/`, { method: 'GET' });
      const timeMs = Date.now() - start;
      const data = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        status: response.status,
        message: data?.message || data?.status || 'En ligne',
        timeMs,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        status: 'Échec',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        timeMs: Date.now() - start,
      };
    }
  }
}
