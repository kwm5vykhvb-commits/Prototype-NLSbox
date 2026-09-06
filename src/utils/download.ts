import { Episode } from '../types';
import { sanitizeFileName } from './sanitizeTitle';

/**
 * Extracts channel and messageId from an episode
 */
export function extractEpisodeMediaIds(episode: Episode): { channel: string; messageId: string | number } {
  let channel = (episode.channel || '').trim().replace(/^@/, '');
  let messageId: string | number = episode.message_id;

  // Render FastAPI returns stream_url (e.g. /download/CHANNEL/MSGID) or download_url
  // The channel encoded in this path is the actual Telegram source channel where the file was uploaded
  const urlToParse = episode.download_url || (episode as any).stream_url || '';
  if (urlToParse) {
    const match = urlToParse.match(/\/download\/([^/]+)\/(\d+)/);
    if (match) {
      channel = match[1];
      if (!messageId) messageId = match[2];
    }
  }

  // Fallback to active catalog default channel if still empty
  if (!channel) {
    channel = 'MANGA_PLUS1';
  }

  return { channel, messageId };
}

/**
 * Generates the local backend download URL which sets Content-Disposition: attachment
 * to force mobile & desktop browsers to save the file into device internal storage (Downloads folder).
 */
export function getInternalStorageDownloadUrl(episode: Episode, backendUrl?: string): string {
  const { channel, messageId } = extractEpisodeMediaIds(episode);
  const fileName = sanitizeFileName(episode.file_name, episode.title);
  const backendParam = backendUrl ? `&backend=${encodeURIComponent(backendUrl)}` : '';
  return `/api/download/${encodeURIComponent(channel)}/${encodeURIComponent(messageId)}?filename=${encodeURIComponent(fileName)}${backendParam}`;
}

/**
 * Generates the local inline view URL for PDFs, images, manga scans, and documents
 */
export function getFileViewUrl(episode: Episode, backendUrl?: string): string {
  const { channel, messageId } = extractEpisodeMediaIds(episode);
  const fileName = sanitizeFileName(episode.file_name, episode.title);
  const backendParam = backendUrl ? `&backend=${encodeURIComponent(backendUrl)}` : '';
  return `/api/view/${encodeURIComponent(channel)}/${encodeURIComponent(messageId)}?filename=${encodeURIComponent(fileName)}${backendParam}`;
}

/**
 * Secure stream/download URL that never leaks the raw remote backend host
 */
export function getDirectRemoteDownloadUrl(episode: Episode, backendUrl?: string): string {
  return getInternalStorageDownloadUrl(episode, backendUrl);
}

/**
 * VLC URL scheme to open stream directly in VLC app through local proxy
 */
export function getVlcStreamUrl(episode: Episode, backendUrl?: string): string {
  const { channel, messageId } = extractEpisodeMediaIds(episode);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const backendParam = backendUrl ? `?backend=${encodeURIComponent(backendUrl)}` : '';
  const streamUrl = `${origin}/api/stream/${encodeURIComponent(channel)}/${encodeURIComponent(messageId)}${backendParam}`;
  return `vlc://${streamUrl}`;
}

/**
 * Android Intent to open stream directly in any native Android video player (MX Player, VLC, Samsung Video, etc.)
 */
export function getAndroidIntentUrl(episode: Episode, backendUrl?: string): string {
  const { channel, messageId } = extractEpisodeMediaIds(episode);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const backendParam = backendUrl ? `?backend=${encodeURIComponent(backendUrl)}` : '';
  const streamUrl = `${origin}/api/stream/${encodeURIComponent(channel)}/${encodeURIComponent(messageId)}${backendParam}`;
  return `intent:${streamUrl}#Intent;type=video/*;action=android.intent.action.VIEW;end`;
}

/**
 * Triggers an actual high-speed browser download that places the video file directly into the device's storage.
 * Bypasses in-memory JavaScript buffers and IndexedDB quotas, allowing max ISP speeds, background downloading,
 * and seamless handling of heavy multi-gigabyte files.
 */
export function triggerDeviceDownload(episode: Episode, backendUrl?: string): boolean {
  try {
    const downloadUrl = getInternalStorageDownloadUrl(episode, backendUrl);
    const fileName = sanitizeFileName(episode.file_name, episode.title);

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 2000);

    return true;
  } catch (err) {
    console.error('[Download] Failed to trigger device download:', err);
    try {
      const fallbackUrl = getInternalStorageDownloadUrl(episode, backendUrl);
      window.location.href = fallbackUrl;
      return true;
    } catch {
      return false;
    }
  }
}
