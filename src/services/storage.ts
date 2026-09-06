import { AppSettings, ChannelInfo, DownloadTask, Episode, HubCategory } from '../types';
import { sanitizeEpisode } from '../utils/sanitizeTitle';

const SETTINGS_KEY = 'nlsbox_app_settings';
const DOWNLOADS_KEY = 'nlsbox_saved_downloads';

export const DEFAULT_CHANNELS: ChannelInfo[] = [
  // 🎌 Animés
  { id: 'MANGA_PLUS1', name: 'animes', category: 'anime', description: 'Flux certifié anime', isCustom: true },
  { id: 'ANIME_FLIX_VF', name: 'Animes', category: 'anime', description: 'Flux certifié anime', isCustom: true },
  { id: 'animemangawarvf', name: 'Animés', category: 'anime', description: 'Flux certifié anime', isCustom: true },
  { id: 'reincarne', name: 'Isekai', category: 'anime', description: 'Flux certifié anime', isCustom: true },

  // 🎬 Films & Séries
  { id: 'Rev_FilmsEtSeries', name: 'Filmes & Séries', category: 'movie_series', description: 'Flux certifié movie_series', isCustom: true },

  // 🎵 Musique
  { id: 'UrbainMusicUsFr', name: 'URBAINMUSICUSFR', category: 'music', description: 'Exclu & Nouveautés', isCustom: true },
  { id: 'NLS_music', name: 'Music NLS', category: 'music', description: 'Flux certifié music', isCustom: true },

  // 📄 Fichiers & Mangas
  { id: 'MangaScanvf', name: 'Scan VF', category: 'document', description: 'Flux certifié document', isCustom: true },

  // 🎮 Jeux & Divertissement
  { id: 'Rev_FilmsEtSeries', name: 'Jeux Vidéo & Fun', category: 'games', description: 'Flux divertissement certifié', isCustom: true },

  // 🖼️ Wallpapers & Fonds d'écran
  { id: 'wallpprrrr', name: 'WALLPPRRRR', category: 'wallpapers', description: 'Flux certifié wallpapers', isCustom: true },
  { id: 'wallpperz', name: 'Images & Fonds', category: 'wallpapers', description: 'Flux certifié wallpapers', isCustom: true },

  // 🔞 Espace Averti (+18 / Contenu Explicite)
  { id: 'pornodrive', name: 'PORNODRIVE', category: 'mature', description: 'Contenu public averti (+18)', isCustom: true },
  { id: 'Brazzers_prem_tube', name: 'Hot', category: 'mature', description: 'Flux certifié mature', isCustom: true },
];

export const DEFAULT_PRIMARY_CHANNELS: Record<HubCategory, string> = {
  anime: 'MANGA_PLUS1',
  movie_series: 'Rev_FilmsEtSeries',
  music: 'UrbainMusicUsFr',
  document: 'MangaScanvf',
  games: 'Rev_FilmsEtSeries',
  wallpapers: 'wallpprrrr',
  mature: 'pornodrive',
};

export const DEFAULT_BACKUP_CHANNELS: Record<HubCategory, string> = {
  anime: 'ANIME_FLIX_VF',
  movie_series: 'Rev_FilmsEtSeries',
  music: 'NLS_music',
  document: 'MangaScanvf',
  games: 'Rev_FilmsEtSeries',
  wallpapers: 'wallpperz',
  mature: 'Brazzers_prem_tube',
};

export const DEFAULT_MULTI_CHANNELS: Record<HubCategory, string[]> = {
  anime: ['MANGA_PLUS1', 'ANIME_FLIX_VF', 'animemangawarvf', 'reincarne'],
  movie_series: ['Rev_FilmsEtSeries'],
  music: ['UrbainMusicUsFr', 'NLS_music'],
  document: ['MangaScanvf'],
  games: ['Rev_FilmsEtSeries'],
  wallpapers: ['wallpprrrr', 'wallpperz'],
  mature: ['pornodrive', 'Brazzers_prem_tube'],
};

export const DEFAULT_SETTINGS: AppSettings = {
  backendUrl: 'https://nlsbox.onrender.com',
  activeCategory: 'anime',
  activeChannel: 'MANGA_PLUS1',
  searchMode: 'multi',
  selectedChannels: ['MANGA_PLUS1', 'ANIME_FLIX_VF', 'animemangawarvf', 'reincarne'],
  primaryChannelsByCategory: DEFAULT_PRIMARY_CHANNELS,
  backupChannelsByCategory: DEFAULT_BACKUP_CHANNELS,
  multiChannelsByCategory: DEFAULT_MULTI_CHANNELS,
  savedChannels: DEFAULT_CHANNELS,
  extendedModuleEnabled: true,
  extendedModulePin: '7777',
  autoPlayNext: true,
  defaultVideoSpeed: 1.0,
  preferredQuality: '1080p',
  theme: 'dark',
};

export class StorageService {
  static getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          searchMode: parsed.searchMode || 'multi',
          savedChannels: Array.isArray(parsed.savedChannels) && parsed.savedChannels.length > 0
            ? parsed.savedChannels
            : DEFAULT_CHANNELS,
        };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  }

  static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  }

  static getDownloads(): DownloadTask[] {
    try {
      const data = localStorage.getItem(DOWNLOADS_KEY);
      if (data) {
        const list: DownloadTask[] = JSON.parse(data);
        if (Array.isArray(list)) {
          let hasDirtyData = false;
          const sanitized = list.map(d => {
            const cleanEp = sanitizeEpisode(d.episode);
            if (cleanEp.title !== d.episode?.title || cleanEp.file_name !== d.episode?.file_name) {
              hasDirtyData = true;
            }
            return {
              ...d,
              episode: cleanEp,
            };
          });

          // If legacy downloads contained dirty links/tags, rewrite cleanly to localStorage
          if (hasDirtyData) {
            this.saveDownloads(sanitized);
          }

          return sanitized;
        }
      }
    } catch {
      // Fallback
    }
    return [];
  }

  static saveDownloads(downloads: DownloadTask[]): void {
    try {
      // Filter out local blob URLs before stringifying to avoid memory leak or stale blobs
      const sanitized = downloads.map(d => ({
        ...d,
        episode: sanitizeEpisode(d.episode),
        localBlobUrl: undefined, // recreated when needed
      }));
      localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Failed to save downloads to localStorage', e);
    }
  }

  static addDownload(task: DownloadTask): void {
    const sanitizedTask: DownloadTask = {
      ...task,
      episode: sanitizeEpisode(task.episode),
    };
    const list = this.getDownloads();
    const existingIndex = list.findIndex(d => d.episode.message_id === sanitizedTask.episode.message_id);
    if (existingIndex >= 0) {
      list[existingIndex] = sanitizedTask;
    } else {
      list.unshift(sanitizedTask);
    }
    this.saveDownloads(list);
  }

  static removeDownload(messageId: number): void {
    const list = this.getDownloads().filter(d => d.episode.message_id !== messageId);
    this.saveDownloads(list);
  }
}
