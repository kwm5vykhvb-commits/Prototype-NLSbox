import { Episode } from '../types';

/**
 * Intelligent Media Title Sanitation Engine
 * Strips Telegram promo URLs, channel watermarks, bot conversion tags,
 * resolution redundancies, hashtags, and technical debris to produce
 * a clean, human-readable display title.
 */

// 1. Comprehensive URL regex (handles full, shortened, or truncated URLs with trailing dots)
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s()[\]{}<>]+(?:\([^\s()[\]{}]*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]|\.{2,})?/gi;
const TELEGRAM_LINK_REGEX = /(?:t\.me|telegram\.me|telegram\.dog)\/[a-zA-Z0-9_+/.]+/gi;
const SHORT_URL_REGEX = /\b(?:bit\.ly|tinyurl\.com|discord\.gg|linktr\.ee|cutt\.ly|is\.gd|rb\.gy)\/[a-zA-Z0-9_+/.]+/gi;

// 2. Channel handles and bot mentions (@Channel, [@Channel], (@Channel))
const TELEGRAM_HANDLE_REGEX = /@[a-zA-Z0-9_]{3,}/g;
const BRACKETED_HANDLE_REGEX = /[\[(]\s*@[a-zA-Z0-9_]{3,}\s*[\])]/gi;

// 3. Promotional keywords and call-to-actions in French & English
const PROMO_PREFIX_REGEX = /\b(?:rejoignez[\s\-](?:nous|notre)|rejoindre(?:\s+notre)?|canal(?:\s+de\s+diffusion|\s+télégram|\s+telegram)?|notre\s+canal|channel|source|crédit|credit|via|uploadé\s+par|upload\s+by|partagé\s+par|shared\s+by|suivez[\s\-](?:nous|notre)|follow\s+us(?:\s+on)?|dispo\s+sur|disponible\s+sur)\s*[:\-–—]?\s*/gi;

// 4. Social & promo hashtags (#anime, #vostfr, etc.)
const HASHTAG_REGEX = /#[a-zA-Z0-9_À-ÿ]+/g;

// 5. Common media extensions embedded into titles
const FILE_EXT_REGEX = /\.(mp4|mkv|avi|mov|flv|webm|ts|m4v|mp3|flac|m4a|aac|wav|ogg|pdf|cbz|cbr|epub|zip|rar|tar|7z)\b/gi;

// 6. Bot conversion and technical artifact tags
const BOT_ARTIFACTS_REGEX = /\b(CONVERTIE|CONVERTED|CONVERT|REENCODE|FAST|BOT|WEB-DL|WEBRIP|BDRIP|BLURAY|HDLIGHT|HDTV|X264|X265|HEVC|H264|H265|AAC|MP3|XVID)\b/gi;

// 7. Redundant resolution strings inside the title text (handled already via badges)
const RESOLUTION_REGEX = /\b(1080p|720p|480p|2160p|4k|fhd|hd|uhd)\b/gi;

/**
 * Clean a title string by completely stripping all promotional links,
 * channel watermarks, bot tags, and formatting artifacts.
 */
export function cleanTitleText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Remove standard, telegram and shortened URLs (including truncated ones ending in '...')
  cleaned = cleaned.replace(URL_REGEX, ' ');
  cleaned = cleaned.replace(TELEGRAM_LINK_REGEX, ' ');
  cleaned = cleaned.replace(SHORT_URL_REGEX, ' ');

  // 2. Remove channel handles and mentions (@channel, [@channel], etc.)
  cleaned = cleaned.replace(BRACKETED_HANDLE_REGEX, ' ');
  cleaned = cleaned.replace(TELEGRAM_HANDLE_REGEX, ' ');

  // 3. Remove promotional call-to-actions (Rejoindre:, Canal Telegram:, etc.)
  cleaned = cleaned.replace(PROMO_PREFIX_REGEX, ' ');

  // 4. Remove hashtags (#anime, #boruto, etc.)
  cleaned = cleaned.replace(HASHTAG_REGEX, ' ');

  // 5. Remove media file extensions embedded in text (.mp4, .mkv, .pdf...)
  cleaned = cleaned.replace(FILE_EXT_REGEX, ' ');

  // 6. Replace underscores and dots with spaces for clean parsing
  cleaned = cleaned.replace(/[_\.]+/g, ' ');

  // 7. Remove bot conversion & technical debris tags
  cleaned = cleaned.replace(BOT_ARTIFACTS_REGEX, ' ');
  cleaned = cleaned.replace(RESOLUTION_REGEX, ' ');

  // 8. Remove bracketed release group tags like [FS], [Subs]
  cleaned = cleaned.replace(/^\[[^\]]*\]\s*/g, ' ');
  cleaned = cleaned.replace(/\s*\[[^\]]*\]$/g, ' ');

  // 9. Remove empty brackets, parentheses, or curlies left after cleaning
  cleaned = cleaned.replace(/\[\s*\]/g, ' ');
  cleaned = cleaned.replace(/\(\s*\)/g, ' ');
  cleaned = cleaned.replace(/\{\s*\}/g, ' ');

  // 10. Harmonize Season and Episode notation:
  // "S01E04" or "S1 E04" -> "S1 E04"
  cleaned = cleaned.replace(/\bS0*(\d{1,2})\s*E0*(\d{1,3})\b/gi, (_m, s, e) => `S${s} E${e}`);

  // 11. Clean dangling punctuation / separators at extremities
  cleaned = cleaned.replace(/^[\s\-–—|:;•~.]+/, '');
  cleaned = cleaned.replace(/[\s\-–—|:;•~.]+$/, '');

  // 12. Collapse multiple whitespace and trim
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // Final trim for any trailing dash left over
  cleaned = cleaned.replace(/[\s\-–—|:;•~]+$/, '').trim();

  return cleaned;
}

/**
 * Return a clean, polished human-friendly display title for UI elements.
 */
export function sanitizeDisplayTitle(rawTitle: string, rawFileName: string = ''): string {
  const base = rawTitle || rawFileName || 'Épisode';
  let cleaned = cleanTitleText(base);

  // If title was only a link (e.g. text was literally just "https://t.me/..."), fallback to filename
  if (!cleaned && rawFileName) {
    cleaned = cleanTitleText(rawFileName.replace(/\.[a-z0-9]+$/i, ''));
  }

  // If still empty, provide generic fallback
  if (!cleaned) {
    return 'Média Vidéo';
  }

  return cleaned;
}

/**
 * Return a sanitized, filesystem-safe filename for downloads (without URLs or handles).
 */
export function sanitizeFileName(rawFileName: string, fallbackTitle: string = ''): string {
  const source = rawFileName || fallbackTitle || 'video.mp4';

  // Extract extension properly even if trailing hashtags or junk was at the end
  const knownExtMatch = source.match(/\.(mp4|mkv|avi|mov|flv|webm|ts|m4v|mp3|flac|m4a|aac|wav|ogg|pdf|cbz|cbr|epub|zip|rar|tar|7z|apk|iso)\b/i);
  const extMatch = knownExtMatch || source.match(/\.([a-z0-9]{2,5})(?:\?.*)?$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';

  // Strip extension from base
  let nameWithoutExt = source.replace(/\.[a-z0-9]{2,5}(?:\?.*)?$/i, '');

  // Clean URLs and Telegram handles
  nameWithoutExt = cleanTitleText(nameWithoutExt);

  // If completely empty after cleaning, use fallback title or default
  if (!nameWithoutExt) {
    nameWithoutExt = cleanTitleText(fallbackTitle) || 'video';
  }

  // Remove illegal characters for filesystems (/ \ : * ? " < > |)
  const safeName = nameWithoutExt
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);

  return `${safeName || 'video'}.${ext}`;
}

/**
 * Sanitizes an Episode object in place or cloned to ensure its title and file_name are pristine.
 */
export function sanitizeEpisode(episode: Episode): Episode {
  if (!episode) return episode;

  const cleanTitle = sanitizeDisplayTitle(episode.title, episode.file_name);
  const cleanName = sanitizeFileName(episode.file_name, episode.title);

  return {
    ...episode,
    title: cleanTitle,
    file_name: cleanName,
  };
}
