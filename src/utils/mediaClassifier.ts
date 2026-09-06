import { cleanTitleText } from './sanitizeTitle';

export type MediaType =
  | 'all'
  | 'anime'
  | 'movie_series'
  | 'games'
  | 'wallpapers'
  | 'music'
  | 'document'
  | 'mature';

export interface MediaMetadata {
  type: 'anime' | 'movie_series' | 'games' | 'wallpapers' | 'music' | 'document' | 'mature' | 'other';
  extension: string;
  isAudio: boolean;
  isVideo: boolean;
  isDocument: boolean;
  isImage: boolean;
  isGame: boolean;
  isMature: boolean;
  displayTitle: string;
  subtitle?: string;
  artist?: string;
  trackTitle?: string;
  qualityBadge?: string;
  languageBadge?: 'VOSTFR' | 'VF' | 'MULTI' | 'RAW' | null;
}

const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'wma', 'alac', 'aiff']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts', '3gp', 'ogv', 'm2ts', 'vob']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'bmp', 'svg', 'gif', 'tiff', 'ico', 'jfif']);
const GAME_EXTENSIONS = new Set(['apk', 'xapk', 'iso', 'cso', 'nsp', 'xci', 'rom', 'nds', 'gba', 'cia', 'exe', 'bin', 'cue', 'zip', 'rar', '7z']);
const DOC_EXTENSIONS = new Set(['pdf', 'epub', 'cbr', 'cbz', 'txt', 'mobi', 'azw3', 'doc', 'docx']);

export class MediaClassifier {
  /**
   * Extract extension from filename or title, handling common tags
   */
  static getExtension(filename: string): string {
    if (!filename) return '';
    const clean = filename.trim();
    // Match common file extension pattern (even if followed by tags like [VOSTFR])
    const dotMatch = clean.match(/\.([a-z0-9]+)(?:\s*\[[^\]]*\]|\s*\([^)]*\))?$/i);
    if (dotMatch) {
      return dotMatch[1].toLowerCase();
    }
    // Match embedded known extension with leading dot
    const embeddedMatch = clean.match(/\.(mkv|mp4|avi|mov|webm|flv|wmv|m4v|ts|3gp|mp3|flac|m4a|aac|wav|ogg|opus|wma|jpg|jpeg|png|webp|gif|pdf|epub|cbr|cbz|apk|xapk|iso|rom|zip|7z|rar|tar|gz)\b/i);
    if (embeddedMatch) {
      return embeddedMatch[1].toLowerCase();
    }
    const fallback = clean.match(/\.([a-z0-9]+)$/i);
    return fallback ? fallback[1].toLowerCase() : '';
  }

  /**
   * Ultra-precise validator: check if a file is strictly a video (MP4, MKV, AVI, etc.)
   * Rejects photos, images, audio, gifs, documents, apk...
   */
  static isVideoFile(title: string, filename: string): boolean {
    const ext = this.getExtension(filename) || this.getExtension(title);
    if (ext) {
      if (VIDEO_EXTENSIONS.has(ext)) return true;
      if (IMAGE_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext) || DOC_EXTENSIONS.has(ext) || GAME_EXTENSIONS.has(ext)) {
        return false;
      }
    }
    const combined = `${title || ''} ${filename || ''}`.toLowerCase();
    // Explicitly reject images, gifs, audio, apk, doc
    if (combined.includes('.gif') || combined.includes('.jpg') || combined.includes('.jpeg') || combined.includes('.png') || combined.includes('.webp') || combined.includes('.mp3') || combined.includes('.flac') || combined.includes('.pdf') || combined.includes('.apk')) {
      return false;
    }
    // Detect video tags
    if (
      combined.includes('.mkv') ||
      combined.includes('.mp4') ||
      combined.includes('.avi') ||
      combined.includes('1080p') ||
      combined.includes('720p') ||
      combined.includes('480p') ||
      combined.includes('2160p') ||
      combined.includes('bluray') ||
      combined.includes('web-dl') ||
      combined.includes('webrip') ||
      combined.includes('vostfr') ||
      combined.includes('x264') ||
      combined.includes('x265') ||
      combined.includes('hevc')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Ultra-precise validator: check if a file is strictly an audio file (MP3, FLAC, M4A, etc.)
   * Rejects videos, images, documents, apk...
   */
  static isAudioFile(title: string, filename: string): boolean {
    const ext = this.getExtension(filename) || this.getExtension(title);
    if (ext) {
      if (AUDIO_EXTENSIONS.has(ext)) return true;
      if (VIDEO_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext) || DOC_EXTENSIONS.has(ext) || GAME_EXTENSIONS.has(ext)) {
        return false;
      }
    }
    const combined = `${title || ''} ${filename || ''}`.toLowerCase();
    if (combined.includes('.mp3') || combined.includes('.flac') || combined.includes('.m4a') || combined.includes('.aac') || combined.includes('.wav') || combined.includes('.ogg') || combined.includes('.opus')) {
      return true;
    }
    if ((combined.includes('ost') || combined.includes('soundtrack') || combined.includes('album') || combined.includes('320kbps')) &&
        !this.isVideoFile(title, filename)) {
      return true;
    }
    return false;
  }

  /**
   * Ultra-precise validator: check if a file is strictly an image or wallpaper (JPG, PNG, WEBP, etc.)
   */
  static isImageFile(title: string, filename: string): boolean {
    const ext = this.getExtension(filename) || this.getExtension(title);
    if (ext && IMAGE_EXTENSIONS.has(ext)) return true;
    const combined = `${title || ''} ${filename || ''}`.toLowerCase();
    return combined.includes('.jpg') || combined.includes('.jpeg') || combined.includes('.png') || combined.includes('.webp') || combined.includes('.bmp');
  }

  /**
   * Ultra-precise validator: check if a file is strictly a document or manga scan (PDF, CBZ, CBR, EPUB, etc.)
   */
  static isDocumentFile(title: string, filename: string): boolean {
    const ext = this.getExtension(filename) || this.getExtension(title);
    if (ext && DOC_EXTENSIONS.has(ext)) return true;
    const combined = `${title || ''} ${filename || ''}`.toLowerCase();
    return combined.includes('.pdf') || combined.includes('.cbz') || combined.includes('.cbr') || combined.includes('.epub') || combined.includes('.mobi');
  }

  /**
   * Ultra-precise validator: check if a file is a game, ROM, APK, or decompressible archive (ZIP, 7Z, RAR, etc.)
   */
  static isGameFile(title: string, filename: string): boolean {
    const ext = this.getExtension(filename) || this.getExtension(title);
    if (ext && GAME_EXTENSIONS.has(ext)) return true;
    const combined = `${title || ''} ${filename || ''}`.toLowerCase();
    return (
      combined.includes('.apk') ||
      combined.includes('.xapk') ||
      combined.includes('.iso') ||
      combined.includes('.rom') ||
      combined.includes('.nsp') ||
      combined.includes('.cso') ||
      combined.includes('.zip') ||
      combined.includes('.7z') ||
      combined.includes('.rar') ||
      combined.includes('.tar') ||
      combined.includes('.gz')
    );
  }

  /**
   * Classify any Telegram file into a clean media category with metadata
   */
  static analyze(title: string, filename: string): MediaMetadata {
    const rawClean = cleanTitleText(title || filename || '');
    const raw = rawClean || (title || filename || '').trim();
    const ext = this.getExtension(filename) || this.getExtension(title);
    const lower = raw.toLowerCase();

    const isAudio = AUDIO_EXTENSIONS.has(ext);
    const isVideo = VIDEO_EXTENSIONS.has(ext);
    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isGameExt = GAME_EXTENSIONS.has(ext);
    const isDoc = DOC_EXTENSIONS.has(ext);

    // Mature / 18+ content detection
    const isMature =
      lower.includes('+18') ||
      lower.includes('18+') ||
      lower.includes('mature') ||
      lower.includes('uncut') ||
      lower.includes('hentai') ||
      lower.includes('ecchi') ||
      lower.includes('explicite') ||
      lower.includes('nsfw') ||
      lower.includes('non censuré') ||
      lower.includes('sans censure');

    // Gaming detection
    const isGame =
      isGameExt ||
      lower.includes('apk') ||
      lower.includes('mod apk') ||
      lower.includes('rom') ||
      lower.includes('ps2') ||
      lower.includes('psp') ||
      lower.includes('switch') ||
      lower.includes('gameplay') ||
      lower.includes('emulateur') ||
      lower.includes('emulator') ||
      lower.includes('game');

    // Wallpaper detection
    const isWallpaper =
      isImage ||
      lower.includes('wallpaper') ||
      lower.includes('fond d\'écran') ||
      lower.includes('amoled') ||
      lower.includes('art 4k') ||
      (lower.includes('4k') && (isImage || lower.includes('art') || lower.includes('wall')));

    // Language detection
    let languageBadge: 'VOSTFR' | 'VF' | 'MULTI' | 'RAW' | null = null;
    if (lower.includes('vostfr') || lower.includes('sub')) languageBadge = 'VOSTFR';
    else if (lower.includes('vf') || lower.includes('french') || lower.includes('vff')) languageBadge = 'VF';
    else if (lower.includes('multi')) languageBadge = 'MULTI';
    else if (lower.includes('raw')) languageBadge = 'RAW';

    // Quality detection
    let qualityBadge: string | undefined;
    if (lower.includes('2160p') || lower.includes('4k') || lower.includes('ultra hd')) qualityBadge = '4K UHD';
    else if (lower.includes('1080p') || lower.includes('fhd')) qualityBadge = '1080p FHD';
    else if (lower.includes('720p') || lower.includes('hd')) qualityBadge = '720p HD';
    else if (lower.includes('480p')) qualityBadge = '480p SD';
    else if (isAudio) {
      if (lower.includes('320k') || lower.includes('320 kbps')) qualityBadge = '320 kbps';
      else if (ext === 'flac') qualityBadge = 'FLAC Lossless';
      else qualityBadge = ext ? ext.toUpperCase() : 'MP3';
    } else if (ext) {
      qualityBadge = ext.toUpperCase();
    }

    // 1. Mature Content (+18)
    if (isMature) {
      const clean = cleanTitleText(raw);
      return {
        type: 'mature',
        extension: ext,
        isAudio,
        isVideo,
        isDocument: isDoc,
        isImage,
        isGame,
        isMature: true,
        displayTitle: clean || raw,
        subtitle: 'Contenu Public Averti (+18)',
        qualityBadge: qualityBadge || 'Uncut +18',
        languageBadge,
      };
    }

    // 2. Wallpapers & Images
    if (isWallpaper && (isImage || !isVideo)) {
      const clean = cleanTitleText(raw);
      return {
        type: 'wallpapers',
        extension: ext,
        isAudio: false,
        isVideo: false,
        isDocument: false,
        isImage: true,
        isGame: false,
        isMature: false,
        displayTitle: clean || raw,
        subtitle: 'Fond d\'écran 4K / Illustration',
        qualityBadge: qualityBadge || (ext ? ext.toUpperCase() : '4K'),
      };
    }

    // 3. Games & Entertainment
    if (isGame && !isVideo) {
      const clean = cleanTitleText(raw);
      return {
        type: 'games',
        extension: ext,
        isAudio: false,
        isVideo: false,
        isDocument: false,
        isImage: false,
        isGame: true,
        isMature: false,
        displayTitle: clean || raw,
        subtitle: 'Jeux Vidéo / ROM / Divertissement',
        qualityBadge: qualityBadge || (ext ? ext.toUpperCase() : 'GAME'),
      };
    }

    // 4. Audio / Music
    if (isAudio) {
      let clean = cleanTitleText(raw);
      clean = clean.replace(/\[[^\]]*\]/g, ' ');
      clean = clean.replace(/\([^)]*(audio|video|official|lyrics|prod|feat|hd|320)[^)]*\)/gi, ' ');
      clean = clean.replace(/[_\.]+/g, ' ').trim();

      let artist: string | undefined;
      let trackTitle: string | undefined;

      if (clean.includes(' - ')) {
        const parts = clean.split(' - ');
        artist = parts[0].trim();
        trackTitle = parts.slice(1).join(' - ').trim();
      }

      return {
        type: 'music',
        extension: ext,
        isAudio: true,
        isVideo: false,
        isDocument: false,
        isImage: false,
        isGame: false,
        isMature: false,
        displayTitle: trackTitle ? `${artist} - ${trackTitle}` : clean || raw,
        subtitle: artist ? `Artiste : ${artist}` : 'Fichier Audio / OST',
        artist,
        trackTitle: trackTitle || clean,
        qualityBadge,
      };
    }

    // 5. Documents & Mangas Scans
    if (isDoc) {
      const clean = cleanTitleText(raw);
      return {
        type: 'document',
        extension: ext,
        isAudio: false,
        isVideo: false,
        isDocument: true,
        isImage: false,
        isGame: false,
        isMature: false,
        displayTitle: clean || raw,
        subtitle: `Scan Manga / Document (${ext ? ext.toUpperCase() : 'PDF'})`,
        qualityBadge: ext ? ext.toUpperCase() : 'PDF',
      };
    }

    // 6. Video / Film / Series / Anime
    const isAnimePattern =
      lower.includes('vostfr') ||
      lower.includes('anime') ||
      lower.includes('saison') ||
      lower.includes('season') ||
      /\b(s\d{1,2}\s*e\d{1,3}|ep\s*\d{1,3}|episode\s*\d{1,3})\b/i.test(lower) ||
      lower.includes('shonen') ||
      lower.includes('isekai') ||
      lower.includes('fansub');

    const cleanVideo = cleanTitleText(raw);

    if (isAnimePattern) {
      return {
        type: 'anime',
        extension: ext,
        isAudio: false,
        isVideo: true,
        isDocument: false,
        isImage: false,
        isGame: false,
        isMature: false,
        displayTitle: cleanVideo || raw,
        subtitle: 'Animé Japonais',
        qualityBadge: qualityBadge || '1080p',
        languageBadge,
      };
    }

    // Movie / Series
    const isSeries = /\b(s\d{1,2}|saison\s*\d{1,2}|e\d{1,2})\b/i.test(raw);

    return {
      type: 'movie_series',
      extension: ext,
      isAudio: false,
      isVideo: true,
      isDocument: false,
      isImage: false,
      isGame: false,
      isMature: false,
      displayTitle: cleanVideo || raw,
      subtitle: isSeries ? 'Série TV' : 'Film / Vidéo',
      qualityBadge: qualityBadge || 'HD',
      languageBadge,
    };
  }
}
