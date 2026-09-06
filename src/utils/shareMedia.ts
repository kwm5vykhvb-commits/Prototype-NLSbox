import { Episode, HubCategory } from '../types';

export interface ShareResult {
  shared: boolean;
  copied: boolean;
  url: string;
}

export async function shareDirectMedia(
  episode: Episode,
  category?: HubCategory
): Promise<ShareResult> {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams();
  params.set('play', '1');
  if (episode.message_id) params.set('msg', String(episode.message_id));
  if (episode.title) params.set('title', episode.title);
  if (episode.file_name) params.set('file', episode.file_name);
  if (episode.download_url) params.set('url', episode.download_url);
  if (episode.channel) params.set('ch', episode.channel);
  if (episode.size_mb) params.set('size', String(episode.size_mb));
  if (episode.thumbnail) params.set('thumb', episode.thumbnail);
  if (category) params.set('cat', category);

  const shareUrl = `${baseUrl}?${params.toString()}`;
  const shareTitle = episode.title || 'Média NLSbox';
  const shareText = `Regarde "${shareTitle}" directement sur NLSbox :`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      return { shared: true, copied: false, url: shareUrl };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { shared: false, copied: false, url: shareUrl };
      }
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(shareUrl);
    return { shared: false, copied: true, url: shareUrl };
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = shareUrl;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return { shared: false, copied: true, url: shareUrl };
  }
}
