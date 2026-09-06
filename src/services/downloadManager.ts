import { DownloadTask, Episode } from '../types';
import { extractEpisodeMediaIds, getInternalStorageDownloadUrl } from '../utils/download';
import { sanitizeFileName } from '../utils/sanitizeTitle';
import { offlineMediaService } from './offlineMediaService';
import { StorageService } from './storage';

type DownloadListener = (tasks: Record<number, DownloadTask>) => void;
type CompletionListener = (episode: Episode, blob: Blob) => void;
type ErrorListener = (episode: Episode, error: string) => void;

interface ActiveStreamTask {
  task: DownloadTask;
  abortController: AbortController;
  lastBytes: number;
  lastTime: number;
  speedSamples: number[];
}

class RealtimeDownloadManager {
  private activeStreams = new Map<number, ActiveStreamTask>();
  private listeners = new Set<DownloadListener>();
  private completionListeners = new Set<CompletionListener>();
  private errorListeners = new Set<ErrorListener>();

  /**
   * Subscribe to live progress updates of all active downloads
   */
  subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    listener(this.getActiveTasks());
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to download completion events
   */
  onCompleted(listener: CompletionListener): () => void {
    this.completionListeners.add(listener);
    return () => this.completionListeners.delete(listener);
  }

  /**
   * Subscribe to download errors
   */
  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private notify() {
    const tasks = this.getActiveTasks();
    for (const listener of this.listeners) {
      try {
        listener(tasks);
      } catch (err) {
        console.error('[DownloadManager] Listener error:', err);
      }
    }
  }

  getActiveTasks(): Record<number, DownloadTask> {
    const result: Record<number, DownloadTask> = {};
    for (const [id, item] of this.activeStreams.entries()) {
      result[id] = { ...item.task };
    }
    return result;
  }

  isDownloading(messageId: number): boolean {
    const entry = this.activeStreams.get(messageId);
    return !!entry && (entry.task.status === 'downloading' || entry.task.status === 'pending');
  }

  getTask(messageId: number): DownloadTask | undefined {
    const entry = this.activeStreams.get(messageId);
    return entry ? { ...entry.task } : undefined;
  }

  dismissTask(messageId: number): void {
    const entry = this.activeStreams.get(messageId);
    if (entry) {
      if (entry.task.status === 'downloading' || entry.task.status === 'pending') {
        entry.abortController.abort();
      }
      this.activeStreams.delete(messageId);
      this.notify();
    }
  }

  /**
   * Starts a real-time streaming download directly into persistent offline storage.
   * Tracks exact bytes received, real speed (MB/s), and real-time progress.
   */
  async startDownload(
    episode: Episode,
    backendUrl: string = 'https://nlsbox.onrender.com',
    customUserAgent?: string,
    customReferer?: string
  ): Promise<void> {
    const messageId = episode.message_id;
    const existing = this.activeStreams.get(messageId);
    if (existing && (existing.task.status === 'downloading' || existing.task.status === 'pending')) {
      return; // Already actively downloading
    }

    const { channel } = extractEpisodeMediaIds(episode);
    const fileName = sanitizeFileName(episode.file_name, episode.title);

    // Initial estimation of total bytes
    const estimatedTotalBytes = (episode.size_mb || 250) * 1024 * 1024;

    const abortController = new AbortController();
    const downloadUrl = getInternalStorageDownloadUrl(episode, backendUrl);

    const initialTask: DownloadTask = {
      episode,
      progress: 0.1, // Show immediate visual feedback
      downloadedBytes: 0,
      totalBytes: estimatedTotalBytes,
      status: 'downloading',
      speedMbPerSec: 0,
    };

    const streamEntry: ActiveStreamTask = {
      task: initialTask,
      abortController,
      lastBytes: 0,
      lastTime: Date.now(),
      speedSamples: [],
    };

    this.activeStreams.set(messageId, streamEntry);
    this.notify();

    try {
      const headers: Record<string, string> = {
        Accept: '*/*',
      };
      if (customUserAgent) headers['X-Custom-User-Agent'] = customUserAgent;
      if (customReferer) headers['X-Custom-Referer'] = customReferer;

      let response: Response | null = null;

      // Make primary request to backend proxy (server.ts handles channel resolution & anti-buffering)
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (abortController.signal.aborted) break;
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        try {
          const res = await fetch(downloadUrl, {
            method: 'GET',
            headers,
            signal: abortController.signal,
          });

          if (res.ok || res.status === 206) {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json') && !ct.includes('text/html')) {
              response = res;
              break;
            }
          }
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') throw fetchErr;
        }
      }

      // If /api/download fails, attempt /api/stream fallback only if it's real media (not synthetic fallback)
      if (!response && downloadUrl.includes('/api/download/')) {
        const streamFallbackUrl = downloadUrl.replace('/api/download/', '/api/stream/');
        try {
          const fallbackRes = await fetch(streamFallbackUrl, {
            method: 'GET',
            headers,
            signal: abortController.signal,
          });
          const isSynthetic = fallbackRes.headers.get('x-stream-fallback') === 'true';
          if (fallbackRes.ok && !isSynthetic) {
            response = fallbackRes;
          }
        } catch (fbErr: any) {
          if (fbErr.name === 'AbortError') throw fbErr;
        }
      }

      if (!response || !response.ok) {
        let errorMsg = 'Serveur distant momentanément indisponible (502)';
        let failureDetail: string | null = null;

        if (response) {
          errorMsg = `Erreur HTTP ${response.status}: Impossible de récupérer le flux`;
          try {
            const errData = await response.json();
            if (errData?.error) {
              failureDetail = errData.error;
            } else if (errData?.detail) {
              failureDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
            }
          } catch {
            try {
              const rawText = await response.text();
              if (rawText && rawText.length < 200) {
                failureDetail = rawText;
              }
            } catch {}
          }

          if (failureDetail) {
            errorMsg = failureDetail;
          }

          const lowerMsg = errorMsg.toLowerCase();
          if (response.status === 404 || lowerMsg.includes('404') || lowerMsg.includes('introuvable') || lowerMsg.includes('not found')) {
            errorMsg = 'Fichier introuvable sur le serveur distant (404)';
          } else if (response.status === 502 || response.status === 504 || lowerMsg.includes('indisponible')) {
            errorMsg = 'Serveur distant momentanément indisponible (502)';
          } else if (response.status === 500) {
            errorMsg = 'Le serveur distant n\'a pas pu fournir le flux média (500)';
          }
        }

        throw new Error(errorMsg);
      }

      const contentLengthHeader = response.headers.get('content-length');
      let totalBytes = estimatedTotalBytes;
      if (contentLengthHeader) {
        const parsedLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(parsedLength) && parsedLength > 0) {
          totalBytes = parsedLength;
          streamEntry.task.totalBytes = parsedLength;
        }
      }

      const contentType = response.headers.get('content-type') || 'video/mp4';

      if (!response.body) {
        throw new Error('Corps de réponse indisponible pour le streaming');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      let lastUpdate = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
        }

        const now = Date.now();
        // Update UI every 200ms for smooth, real-time feedback
        if (now - lastUpdate >= 200 || receivedBytes === totalBytes) {
          const deltaBytes = receivedBytes - streamEntry.lastBytes;
          const deltaTime = Math.max(0.1, (now - streamEntry.lastTime) / 1000);
          const currentSpeedMb = (deltaBytes / (1024 * 1024)) / deltaTime;

          // Rolling average speed
          streamEntry.speedSamples.push(currentSpeedMb);
          if (streamEntry.speedSamples.length > 5) streamEntry.speedSamples.shift();
          const avgSpeed = streamEntry.speedSamples.reduce((a, b) => a + b, 0) / streamEntry.speedSamples.length;

          const progress = totalBytes > 0
            ? Math.min(99.9, Math.max(0.1, (receivedBytes / totalBytes) * 100))
            : 50;

          streamEntry.task = {
            ...streamEntry.task,
            progress,
            downloadedBytes: receivedBytes,
            totalBytes,
            speedMbPerSec: Math.max(0.1, Math.round(avgSpeed * 10) / 10),
          };

          streamEntry.lastBytes = receivedBytes;
          streamEntry.lastTime = now;
          lastUpdate = now;
          this.notify();
        }
      }

      // Download complete! Construct binary Blob
      const blob = new Blob(chunks, { type: contentType });
      const actualSizeMb = blob.size / (1024 * 1024);

      // Save to persistent IndexedDB
      try {
        await offlineMediaService.saveMedia({
          messageId: episode.message_id,
          title: episode.title || fileName,
          fileName,
          sizeMb: actualSizeMb,
          mimeType: contentType,
          channel,
          blob,
          duration: episode.duration,
          thumbnail: episode.thumbnail,
        });
      } catch (dbErr: any) {
        console.warn('[DownloadManager] IndexedDB save error, saving directly to device:', dbErr);
        // Fallback: If device IndexedDB quota is exceeded for large files (movies/anime > 100MB),
        // trigger direct device save using Blob URL so file is never lost
        try {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          }, 60000);
        } catch {}
      }

      // Update task to completed
      const completedTask: DownloadTask = {
        episode: {
          ...episode,
          size_mb: actualSizeMb,
        },
        progress: 100,
        downloadedBytes: blob.size,
        totalBytes: blob.size,
        status: 'completed',
        speedMbPerSec: 0,
      };

      // Also persist to localStorage download list for cross-tab metadata sync
      const existingSaved = StorageService.getDownloads();
      const updatedSaved = [completedTask, ...existingSaved.filter((d) => d.episode.message_id !== messageId)];
      StorageService.saveDownloads(updatedSaved);

      this.activeStreams.delete(messageId);
      this.notify();

      // Trigger completion listeners
      for (const compListener of this.completionListeners) {
        try {
          compListener(completedTask.episode, blob);
        } catch (e) {
          console.error('[DownloadManager] Completion callback error:', e);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`[DownloadManager] Téléchargement #${messageId} annulé.`);
        this.activeStreams.delete(messageId);
      } else {
        const errMsg = err?.message || 'Échec du téléchargement';
        console.warn(`[DownloadManager] Téléchargement #${messageId} interrompu:`, errMsg);

        // Keep task in 'error' status so the user can see what happened, retry, or use direct download
        streamEntry.task = {
          ...streamEntry.task,
          status: 'error',
          error: errMsg,
          speedMbPerSec: 0,
        };

        for (const errListener of this.errorListeners) {
          try {
            errListener(episode, errMsg);
          } catch {}
        }
      }

      this.notify();
    }
  }

  /**
   * Retries an existing failed download task
   */
  retryDownload(
    episode: Episode,
    backendUrl: string = 'https://nlsbox.onrender.com',
    customUserAgent?: string,
    customReferer?: string
  ): void {
    this.dismissTask(episode.message_id);
    this.startDownload(episode, backendUrl, customUserAgent, customReferer);
  }

  /**
   * Cancel an active download and abort connection
   */
  cancelDownload(messageId: number): void {
    const entry = this.activeStreams.get(messageId);
    if (entry) {
      entry.abortController.abort();
      this.activeStreams.delete(messageId);
      this.notify();
    }
  }

  /**
   * Cancel all running downloads
   */
  cancelAll(): void {
    for (const [id, entry] of this.activeStreams.entries()) {
      entry.abortController.abort();
    }
    this.activeStreams.clear();
    this.notify();
  }
}

export const downloadManager = new RealtimeDownloadManager();
