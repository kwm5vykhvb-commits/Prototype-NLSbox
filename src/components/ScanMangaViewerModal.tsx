import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Share2,
  Maximize2,
  Minimize2,
  BookOpen,
  Image as ImageIcon,
  Layers,
  Check,
  CheckCircle2,
  FileText,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  FileArchive,
} from 'lucide-react';
import JSZip from 'jszip';
import { Episode } from '../types';
import { offlineCacheService } from '../services/offlineCacheService';
import { offlineMediaService } from '../services/offlineMediaService';
import { StorageService } from '../services/storage';
import { shareDirectMedia } from '../utils/shareMedia';
import {
  requestFullscreenSafe,
  exitFullscreenSafe,
  isFullscreenActive,
  addFullscreenChangeListener,
} from '../utils/fullscreen';
import {
  getFileViewUrl,
  getInternalStorageDownloadUrl,
  triggerDeviceDownload,
} from '../utils/download';

interface ScanMangaViewerModalProps {
  episode: Episode | null;
  isOffline?: boolean;
  onClose: () => void;
  backendUrl?: string;
}

export const ScanMangaViewerModal: React.FC<ScanMangaViewerModalProps> = ({
  episode,
  isOffline = false,
  onClose,
  backendUrl = 'https://nlsbox.onrender.com',
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [readingMode, setReadingMode] = useState<'paged' | 'webtoon' | 'wallpaper'>('webtoon');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fitMode, setFitMode] = useState<'width' | 'contain'>('width');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [detectedPdfBlobUrl, setDetectedPdfBlobUrl] = useState<string | null>(null);
  const [hasDownloadedInSession, setHasDownloadedInSession] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const webtoonRef = useRef<HTMLDivElement>(null);

  if (!episode) return null;

  const fileName = episode.file_name || '';
  const title = episode.title || '';
  const fileExt = (fileName.split('.').pop() || '').toLowerCase();

  const isPdf =
    fileExt === 'pdf' ||
    fileName.toLowerCase().endsWith('.pdf') ||
    title.toLowerCase().endsWith('.pdf');

  const isArchive =
    fileExt === 'cbz' ||
    fileExt === 'cbr' ||
    fileExt === 'zip' ||
    fileExt === 'rar' ||
    fileName.toLowerCase().endsWith('.cbz') ||
    fileName.toLowerCase().endsWith('.zip') ||
    fileName.toLowerCase().endsWith('.cbr') ||
    fileName.toLowerCase().endsWith('.rar');

  const isSingleImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'jfif', 'avif'].includes(
    fileExt
  );

  const isWallpaper =
    episode.channel?.toLowerCase().includes('wallpaper') ||
    episode.channel?.toLowerCase().includes('fond') ||
    isSingleImage;

  const viewUrl = getFileViewUrl(episode, backendUrl);
  const downloadUrl = getInternalStorageDownloadUrl(episode, backendUrl);

  const isPdfViewerActive = isPdf || !!detectedPdfBlobUrl;
  const activePdfUrl = detectedPdfBlobUrl || viewUrl;

  const isAlreadyDownloaded = React.useMemo(() => {
    try {
      const list = StorageService.getDownloads();
      return list.some((d) => String(d.episode.message_id) === String(episode.message_id));
    } catch {
      return false;
    }
  }, [episode.message_id]);

  // Load real content dynamically based on media format
  useEffect(() => {
    let isMounted = true;
    const createdBlobUrls: string[] = [];
    setCurrentPage(0);
    setZoomLevel(1);
    setErrorMessage(null);
    setDetectedPdfBlobUrl(null);

    // 1. PDF Documents: Rendered directly via embedded viewer
    if (isPdf) {
      setIsLoading(false);
      setPages([]);
      return;
    }

    // 2. Single image or wallpaper: Directly point to the actual stream URL
    if (isSingleImage || isWallpaper) {
      setIsLoading(false);
      setReadingMode('wallpaper');
      setFitMode('contain');
      setPages([viewUrl]);
      return;
    }

    // 3. CBZ / ZIP / CBR Comic Archives or Scan Chapters
    setIsLoading(true);
    setLoadingProgress('Vérification du cache...');

    // Check offline cache first, while strictly rejecting any legacy mock Unsplash data!
    offlineCacheService
      .getMangaChapter(String(episode.message_id))
      .then(async (cached) => {
        if (!isMounted) return;

        // Discard legacy corrupt mock cache if found
        const hasMockData = cached?.pages?.some((p) => p.includes('unsplash.com'));
        if (cached && cached.pages && cached.pages.length > 0 && !hasMockData) {
          setPages(cached.pages);
          setIsCached(true);
          setIsLoading(false);
          return;
        }

        setLoadingProgress('Chargement du chapitre scan...');
        try {
          let blob: Blob | null = null;
          try {
            blob = await offlineMediaService.getMediaBlob(episode.message_id);
          } catch {}

          if (!blob) {
            const response = await fetch(viewUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            blob = await response.blob();
          }

          if (!isMounted) return;

          // Magic-bytes detection to accurately detect file format
          const headerBuffer = await blob.slice(0, 16).arrayBuffer();
          const headerBytes = new Uint8Array(headerBuffer);
          const headerStr = String.fromCharCode(...headerBytes.slice(0, 5));

          // A. Is it a PDF? (%PDF)
          if (headerStr.startsWith('%PDF')) {
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            const pdfUrl = URL.createObjectURL(pdfBlob);
            createdBlobUrls.push(pdfUrl);
            setDetectedPdfBlobUrl(pdfUrl);
            setIsLoading(false);
            return;
          }

          // B. Is it a single image? (JPEG, PNG, WEBP, GIF)
          const isJpg = headerBytes[0] === 0xff && headerBytes[1] === 0xd8;
          const isPng =
            headerBytes[0] === 0x89 &&
            headerBytes[1] === 0x50 &&
            headerBytes[2] === 0x4e &&
            headerBytes[3] === 0x47;
          const isWebp = headerStr.startsWith('RIFF');
          const isGif = headerStr.startsWith('GIF8');

          if (isJpg || isPng || isWebp || isGif) {
            const imgUrl = URL.createObjectURL(blob);
            createdBlobUrls.push(imgUrl);
            setReadingMode('wallpaper');
            setFitMode('contain');
            setPages([imgUrl]);
            setIsLoading(false);
            return;
          }

          // C. Is it a RAR / CBR archive? (Rar!)
          const isRar =
            headerBytes[0] === 0x52 &&
            headerBytes[1] === 0x61 &&
            headerBytes[2] === 0x72 &&
            headerBytes[3] === 0x21;
          if (isRar || fileExt === 'cbr' || fileExt === 'rar') {
            setIsLoading(false);
            setErrorMessage(
              'Ce chapitre est au format manga compressé CBR (archive RAR). Ce format propriétaire nécessite une application de lecture manga dédiée.'
            );
            return;
          }

          // D. Is it a ZIP / CBZ archive? (PK..)
          const isZip = headerBytes[0] === 0x50 && headerBytes[1] === 0x4b;
          if (isZip || isArchive) {
            setLoadingProgress('Extraction des planches du manga...');
            const zip = await JSZip.loadAsync(blob);

            // Filter image files inside archive (ignoring __MACOSX / thumbs / hidden files)
            const imageEntries = Object.keys(zip.files)
              .filter(
                (name) =>
                  !zip.files[name].dir &&
                  !name.includes('__MACOSX') &&
                  !name.startsWith('.') &&
                  /\.(jpe?g|png|webp|gif|bmp|avif|jfif)$/i.test(name)
              )
              .sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
              );

            if (imageEntries.length === 0) {
              setIsLoading(false);
              setErrorMessage(
                "Ce chapitre compressé ne contient pas de planches d'images lisibles directement par le navigateur."
              );
              return;
            }

            const extractedPages: string[] = [];
            for (const entryName of imageEntries) {
              const fileBlob = await zip.file(entryName)!.async('blob');
              const pageUrl = URL.createObjectURL(fileBlob);
              createdBlobUrls.push(pageUrl);
              extractedPages.push(pageUrl);
            }

            if (isMounted) {
              setPages(extractedPages);
              setIsLoading(false);
              offlineCacheService
                .saveMangaChapter(String(episode.message_id), extractedPages, episode.title)
                .catch(() => {});
            }
            return;
          }

          // E. Other format
          setIsLoading(false);
          setErrorMessage(
            "Ce fichier manga n'a pas pu être extrait automatiquement en planches."
          );
        } catch (err: any) {
          if (isMounted) {
            console.warn('Erreur décompression archive:', err);
            setIsLoading(false);
            setErrorMessage(
              "Le fichier n'a pas pu être extrait automatiquement en planches."
            );
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
          setErrorMessage('Impossible de joindre le serveur pour extraire le fichier.');
        }
      });

    return () => {
      isMounted = false;
      createdBlobUrls.forEach((url) => {
        if (url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(url);
          } catch {}
        }
      });
    };
  }, [episode.message_id, isPdf, isArchive, isSingleImage, isWallpaper, viewUrl, retryCount]);

  // Fullscreen listener
  useEffect(() => {
    return addFullscreenChangeListener((active) => {
      setIsFullscreen(active);
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'd') handleNextPage();
      if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'a') handlePrevPage();
      if (e.key === 'f') toggleFullscreen();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, pages.length]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
    setZoomLevel(1);
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(pages.length - 1, prev + 1));
    setZoomLevel(1);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.75, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => setZoomLevel(1);

  const toggleFullscreen = async () => {
    const isCurrentlyFs = isFullscreen || isFullscreenActive();
    if (!isCurrentlyFs) {
      await requestFullscreenSafe(containerRef.current);
      setIsFullscreen(true);
    } else {
      await exitFullscreenSafe();
      setIsFullscreen(false);
    }
  };

  const handleShare = async () => {
    if (!episode) return;
    const res = await shareDirectMedia(episode);
    if (res.copied) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    triggerDeviceDownload(episode, backendUrl);
    setHasDownloadedInSession(true);
  };

  const handleOpenExternal = () => {
    if (isPdfViewerActive) {
      window.open(activePdfUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      ref={containerRef}
      id="scan-manga-viewer"
      className="fixed inset-0 z-50 bg-[#0A0A0E] text-white flex flex-col select-none overflow-hidden"
    >
      {/* 1. Header Toolbar */}
      <div
        id="scan-viewer-toolbar"
        className="shrink-0 h-14 sm:h-16 px-3 sm:px-5 bg-[#121218]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-2 sm:gap-4 z-20"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            id="btn-close-scan-viewer"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-gray-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="Fermer le lecteur"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${
                  isPdfViewerActive
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : isWallpaper
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                }`}
              >
                {isPdfViewerActive ? (
                  <>
                    <FileText className="w-3 h-3 text-red-400" />
                    <span>Document PDF</span>
                  </>
                ) : isWallpaper ? (
                  <>
                    <ImageIcon className="w-3 h-3 text-amber-400" />
                    <span>Image HD</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3 h-3 text-purple-400" />
                    <span>Scan Manga</span>
                  </>
                )}
              </span>

              {isCached && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> En cache
                </span>
              )}

              {episode.size_mb ? (
                <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                  {episode.size_mb} MB
                </span>
              ) : null}
            </div>

            <h2
              className="text-xs sm:text-sm font-bold text-gray-100 truncate mt-0.5 max-w-[180px] sm:max-w-md"
              title={episode.title}
            >
              {episode.title}
            </h2>
          </div>
        </div>

        {/* Toolbar Center: Reading Mode Switcher (only for multi-page manga/images) */}
        {!isPdf && pages.length > 1 && (
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              id="btn-mode-webtoon"
              onClick={() => setReadingMode('webtoon')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                readingMode === 'webtoon'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Mode Défilement Vertical (Webtoon)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Webtoon</span>
            </button>

            <button
              id="btn-mode-paged"
              onClick={() => setReadingMode('paged')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                readingMode === 'paged'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Mode Page par Page"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Page par Page</span>
            </button>
          </div>
        )}

        {/* Toolbar Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Zoom controls for single image / paged manga */}
          {!isPdf && readingMode !== 'webtoon' && (
            <div className="hidden md:flex items-center gap-1 bg-black/40 px-2 py-1 rounded-xl border border-white/5">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.75}
                className="p-1 hover:text-purple-400 disabled:opacity-40 transition-colors cursor-pointer"
                title="Zoom arrière"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono min-w-[34px] text-center font-bold text-gray-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="p-1 hover:text-purple-400 disabled:opacity-40 transition-colors cursor-pointer"
                title="Zoom avant"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {zoomLevel !== 1 && (
                <button
                  onClick={handleResetZoom}
                  className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer ml-0.5"
                  title="Réinitialiser zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Open in native browser tab / External PDF reader (Only for PDFs) */}
          {isPdfViewerActive && (
            <button
              id="btn-open-external"
              onClick={handleOpenExternal}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden lg:inline text-[11px] font-semibold">Plein écran</span>
            </button>
          )}

          {/* Download button */}
          <button
            id="btn-download-file"
            onClick={handleDownload}
            className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition-all cursor-pointer"
            title="Télécharger sur l'appareil"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Share button */}
          <button
            id="btn-share-file"
            onClick={handleShare}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Copier le lien"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Fullscreen toggle */}
          <button
            id="btn-toggle-fullscreen"
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Plein écran"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Main Reader Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[#070709] flex items-center justify-center">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-sm font-semibold text-gray-200">
              {loadingProgress || 'Chargement du fichier...'}
            </p>
            <p className="text-xs text-gray-400 font-mono max-w-sm truncate">{fileName}</p>
          </div>
        )}

        {/* Error / Compatible App Guidance State */}
        {!isLoading && errorMessage && (
          <div className="max-w-lg mx-4 my-auto p-5 sm:p-7 rounded-2xl bg-[#13131A] border border-white/10 shadow-2xl text-center space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
              <BookOpen className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] font-bold uppercase tracking-wider">
                <FileArchive className="w-3.5 h-3.5" />
                <span>Format Manga Compressé (CBR / Archive)</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Lecture via application compatible
              </h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-md mx-auto">
                Ce chapitre est au format manga compressé. Pour une expérience de lecture fluide en haute résolution, téléchargez le fichier et ouvrez-le avec l'application de lecture de votre choix.
              </p>
            </div>

            {/* Download Status or Call to Action */}
            <div className="space-y-3">
              {(isAlreadyDownloaded || hasDownloadedInSession) && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Fichier déjà disponible dans vos Téléchargements</span>
                </div>
              )}

              <button
                onClick={handleDownload}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isAlreadyDownloaded || hasDownloadedInSession
                    ? 'Télécharger à nouveau le fichier'
                    : "Télécharger le fichier sur l'appareil"}{' '}
                  ({episode.size_mb ? `${episode.size_mb} Mo` : 'Fichier'})
                </span>
              </button>
            </div>

            {/* Compatible Applications Guide */}
            <div className="text-left bg-black/40 rounded-xl p-4 border border-white/5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <span>Applications compatibles recommandées :</span>
              </div>
              <ul className="text-xs text-gray-300 space-y-1.5 pl-1">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">•</span>
                  <span><strong className="text-white">Android :</strong> Tachiyomi / Mihon, Perfect Viewer, CDisplayEx, ReadEra</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">•</span>
                  <span><strong className="text-white">iPhone / iPad :</strong> Panels Manga, Chunky Comic Reader, Livres</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">•</span>
                  <span><strong className="text-white">PC & Mac :</strong> CDisplayEx, YACReader, Calibre</span>
                </li>
              </ul>
              <div className="pt-2 border-t border-white/5 text-[11px] text-gray-400 flex items-start gap-1.5 leading-normal">
                <span className="text-amber-400 font-bold">Astuce :</span>
                <span>Après le téléchargement, appuyez simplement sur le fichier dans l'explorateur de votre appareil pour choisir votre lecteur.</span>
              </div>
            </div>

            {/* Retry Button */}
            <div className="pt-1 flex justify-center">
              <button
                onClick={() => {
                  setIsLoading(true);
                  setErrorMessage(null);
                  setRetryCount((c) => c + 1);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réessayer l'extraction</span>
              </button>
            </div>
          </div>
        )}

        {/* CASE A: PDF DOCUMENT (Embedded Native PDF Reader) */}
        {!isLoading && !errorMessage && isPdfViewerActive && (
          <div className="w-full h-full flex flex-col relative bg-[#15151A]">
            <iframe
              key={iframeKey}
              src={activePdfUrl}
              className="w-full h-full border-0 bg-[#16161E]"
              title={title}
            />

            {/* Mobile helper bar below iframe if browser blocks inline PDF */}
            <div className="shrink-0 p-2.5 bg-[#0D0D12] border-t border-white/10 flex items-center justify-between text-xs text-gray-300">
              <span className="truncate max-w-[200px] sm:max-w-md text-gray-400 font-mono">
                {fileName}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIframeKey((k) => k + 1)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center gap-1 cursor-pointer"
                  title="Recharger le document"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>
                <button
                  onClick={handleOpenExternal}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Plein écran natif</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CASE B: WEBTOON MODE (Continuous Vertical Scroll for Manga Pages) */}
        {!isLoading && !errorMessage && !isPdfViewerActive && readingMode === 'webtoon' && pages.length > 0 && (
          <div
            ref={webtoonRef}
            className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center py-4 px-2 sm:px-4 space-y-3"
          >
            <div className="max-w-2xl w-full mx-auto space-y-4">
              {pages.map((pageUrl, idx) => (
                <div
                  key={idx}
                  className="relative rounded-lg overflow-hidden bg-black/40 border border-white/5 shadow-2xl transition-all"
                >
                  <div className="absolute top-2 left-2 z-10 bg-black/70 backdrop-blur-sm text-gray-300 text-[10px] font-mono px-2 py-0.5 rounded border border-white/10">
                    Page {idx + 1} / {pages.length}
                  </div>
                  <img
                    src={pageUrl}
                    alt={`Page ${idx + 1}`}
                    loading={idx <= 2 ? 'eager' : 'lazy'}
                    className="w-full h-auto object-contain block mx-auto transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}

              <div className="py-10 text-center space-y-2 text-gray-400">
                <CheckCircle2 className="w-8 h-8 text-purple-400 mx-auto opacity-70" />
                <p className="text-xs font-semibold">Fin du chapitre</p>
                <button
                  onClick={() => webtoonRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
                >
                  Remonter en haut
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CASE C: PAGED MODE (Traditional Manga Reader) */}
        {!isLoading && !errorMessage && !isPdfViewerActive && readingMode === 'paged' && pages.length > 0 && (
          <div className="w-full h-full relative flex items-center justify-center p-2 sm:p-4">
            {/* Click Navigation Overlay Zones */}
            <div
              onClick={handlePrevPage}
              className="absolute left-0 top-0 bottom-0 w-1/4 z-10 cursor-w-resize hover:bg-white/[0.02] transition-colors"
              title="Page précédente"
            />
            <div
              onClick={handleNextPage}
              className="absolute right-0 top-0 bottom-0 w-1/4 z-10 cursor-e-resize hover:bg-white/[0.02] transition-colors"
              title="Page suivante"
            />

            {/* Page Display */}
            <div
              className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-150"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={pages[currentPage]}
                alt={`Page ${currentPage + 1}`}
                className={`max-h-[82vh] ${
                  fitMode === 'width' ? 'w-auto max-w-full' : 'h-full w-auto'
                } object-contain rounded-md shadow-2xl select-none`}
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Floating Navigation Arrows */}
            {currentPage > 0 && (
              <button
                onClick={handlePrevPage}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-3 rounded-2xl bg-black/60 hover:bg-purple-600 text-white backdrop-blur-md border border-white/10 transition-all shadow-xl cursor-pointer"
                title="Précédent"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {currentPage < pages.length - 1 && (
              <button
                onClick={handleNextPage}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-3 rounded-2xl bg-black/60 hover:bg-purple-600 text-white backdrop-blur-md border border-white/10 transition-all shadow-xl cursor-pointer"
                title="Suivant"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        )}

        {/* CASE D: WALLPAPER / IMAGE HD (Single Image View) */}
        {!isLoading && !errorMessage && !isPdfViewerActive && readingMode === 'wallpaper' && (
          <div className="w-full h-full relative flex items-center justify-center p-3 sm:p-6 overflow-auto">
            <div
              className="relative transition-transform duration-200 cursor-grab active:cursor-grabbing"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={pages[0] || viewUrl}
                alt={title}
                className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Navigation Bar (For multi-page items) */}
      {!isPdfViewerActive && pages.length > 1 && (
        <div
          id="scan-viewer-bottombar"
          className="shrink-0 h-14 sm:h-16 px-4 sm:px-6 bg-[#121218]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-4 z-20"
        >
          <div className="text-xs text-gray-400 font-mono">
            Page <span className="text-white font-bold">{currentPage + 1}</span> / {pages.length}
          </div>

          {/* Page Slider / Jumper */}
          <div className="flex-1 max-w-md mx-2 sm:mx-4 flex items-center gap-3">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={0}
              max={Math.max(0, pages.length - 1)}
              value={currentPage}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCurrentPage(val);
                if (readingMode === 'webtoon' && webtoonRef.current) {
                  const ratio = val / Math.max(1, pages.length - 1);
                  webtoonRef.current.scrollTo({
                    top:
                      ratio * (webtoonRef.current.scrollHeight - webtoonRef.current.clientHeight),
                    behavior: 'smooth',
                  });
                }
              }}
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />

            <button
              onClick={handleNextPage}
              disabled={currentPage === pages.length - 1}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Fit Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFitMode((m) => (m === 'width' ? 'contain' : 'width'))}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white font-semibold border border-white/10 transition-all cursor-pointer"
              title="Adapter à la largeur / hauteur"
            >
              {fitMode === 'width' ? 'Largeur' : 'Ajuster'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
