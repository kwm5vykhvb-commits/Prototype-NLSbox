export interface Episode {
  message_id: number;
  title: string;
  file_name: string;
  size_mb: number;
  download_url: string;
  duration?: string;
  quality?: string;
  thumbnail?: string;
  channel?: string;
  date_added?: string;
}

export interface AnimeInfo {
  title?: string;
  cover?: string;
  banner?: string;
  synopsis?: string;
  score?: string;
  genres?: string[];
  total_episodes_official?: number | null;
  year?: number | null;
}

export interface JikanAnimeData {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp?: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  trailer?: {
    youtube_id?: string;
    url?: string;
    embed_url?: string;
  };
  synopsis?: string;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  episodes?: number;
  status?: string;
  airing?: boolean;
  aired?: {
    string?: string;
  };
  duration?: string;
  rating?: string;
  season?: string;
  year?: number;
  studios?: Array<{ mal_id: number; name: string }>;
  genres?: Array<{ mal_id: number; name: string }>;
}

export interface JikanCharacterData {
  character: {
    mal_id: number;
    url: string;
    images: {
      jpg: {
        image_url: string;
      };
      webp?: {
        image_url: string;
        small_image_url: string;
      };
    };
    name: string;
  };
  role: string;
  favorites?: number;
  voice_actors?: Array<{
    person: {
      mal_id: number;
      images: {
        jpg: {
          image_url: string;
        };
      };
      name: string;
    };
    language: string;
  }>;
}

export interface CatalogResponse {
  channel: string;
  query?: string;
  anime_info?: AnimeInfo | null;
  total_found: number;
  episodes: Episode[];
}

export interface DownloadTask {
  episode: Episode;
  progress: number; // 0 to 100
  downloadedBytes: number;
  totalBytes: number;
  status: 'pending' | 'downloading' | 'completed' | 'paused' | 'error';
  speedMbPerSec: number;
  localBlobUrl?: string;
  completedAt?: string;
  error?: string;
}

export type HubCategory =
  | 'anime'
  | 'movie_series'
  | 'music'
  | 'document'
  | 'games'
  | 'wallpapers'
  | 'mature';

export interface ChannelInfo {
  id: string;
  name: string;
  category: HubCategory;
  description?: string;
  coverImage?: string;
  episodesCount?: number;
  isCustom?: boolean;
}

export interface AppSettings {
  backendUrl: string;
  activeCategory: HubCategory;
  activeChannel: string;
  searchMode?: 'single' | 'multi';
  selectedChannels?: string[];
  primaryChannelsByCategory?: Partial<Record<HubCategory, string>>;
  backupChannelsByCategory?: Partial<Record<HubCategory, string>>;
  multiChannelsByCategory?: Partial<Record<HubCategory, string[]>>;
  savedChannels: ChannelInfo[];
  extendedModuleEnabled?: boolean; // Emergency remote Kill-Switch for the extended module (default: true)
  extendedModulePin?: string; // Secret access code triggered on logo tap (default: "7777")
  chameleonMode?: boolean;
  chameleonDecoyType?: 'photos' | 'calculator' | 'notes';
  killSwitch?: boolean;
  customUserAgent?: string;
  customReferer?: string;
  autoPlayNext: boolean;
  defaultVideoSpeed: number;
  preferredQuality: '1080p' | '720p' | '480p' | 'auto';
  theme: 'dark' | 'amoled';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'update' | 'info' | 'alert';
  createdAt: number;
  active?: boolean;
  targetUserId?: string; // If set, this notification is private to this specific user
}

export interface UserFeedback {
  id: string;
  type: 'report' | 'request'; // 'report' = problème / lien mort, 'request' = souhait / demande film, animé
  title: string;
  description: string;
  category?: HubCategory | 'general';
  channelId?: string;
  userEmail?: string;
  userId?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'fulfilled';
  createdAt: number;
  response?: string;
  respondedAt?: number;
}

export interface UserActivity {
  id?: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  type: 'login' | 'search' | 'watch' | 'download' | 'feedback';
  description: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: number;
  lastLogin?: number;
  isBanned?: boolean;
  bannedReason?: string;
  bannedAt?: number;
  lastActivityAt?: number;
  lastActivityDesc?: string;
  activityCount?: number;
}
