// Cross-browser Fullscreen Utility with iOS / Safari / WebKit and fallback support

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as any;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export async function requestFullscreenSafe(
  element: HTMLElement | null,
  videoElement?: HTMLVideoElement | null
): Promise<boolean> {
  if (!element && !videoElement) return false;

  try {
    const el = element as any;
    if (el) {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen();
        return true;
      }
      if (typeof el.webkitRequestFullscreen === 'function') {
        await el.webkitRequestFullscreen();
        return true;
      }
      if (typeof el.mozRequestFullScreen === 'function') {
        await el.mozRequestFullScreen();
        return true;
      }
      if (typeof el.msRequestFullscreen === 'function') {
        await el.msRequestFullscreen();
        return true;
      }
    }

    // Special fallback for iOS Safari which only supports full screen on the <video> tag
    const vEl = videoElement as any;
    if (vEl && typeof vEl.webkitEnterFullscreen === 'function') {
      vEl.webkitEnterFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('Fullscreen request could not be fulfilled natively:', err);
  }

  return false;
}

export async function exitFullscreenSafe(videoElement?: HTMLVideoElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  try {
    const doc = document as any;
    if (typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
      return true;
    }
    if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
      return true;
    }
    if (typeof doc.mozCancelFullScreen === 'function') {
      await doc.mozCancelFullScreen();
      return true;
    }
    if (typeof doc.msExitFullscreen === 'function') {
      await doc.msExitFullscreen();
      return true;
    }

    // iOS video exit
    const vEl = videoElement as any;
    if (vEl && typeof vEl.webkitExitFullscreen === 'function') {
      vEl.webkitExitFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('Exit fullscreen could not be fulfilled natively:', err);
  }

  return false;
}

export function addFullscreenChangeListener(callback: (isFullscreen: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = () => {
    callback(isFullscreenActive());
  };

  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}
