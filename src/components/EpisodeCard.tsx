import React, { useState, useEffect } from 'react';
import {
  Play,
  Download,
  Check,
  HardDrive,
  Film,
  Info,
  Music,
  FileText,
  Clapperboard,
  Disc,
  Share2,
  BookOpen,
  Image as ImageIcon,
} from 'lucide-react';
import { Episode, DownloadTask } from '../types';
import { JikanService } from '../services/jikan';
import { MediaClassifier } from '../utils/mediaClassifier';
import { shareDirectMedia } from '../utils/shareMedia';

interface EpisodeCardProps {
  episode: Episode;
  onPlay: (episode: Episode) => void;
  onDownload: (episode: Episode) => void;
  onOpenInfo?: (episode: Episode) => void;
  onShare?: (episode: Episode) => void;
  posterUrl?: string;
  downloadTask?: DownloadTask;
  isDownloaded?: boolean;
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({
  episode,
  onPlay,
  onDownload,
  onOpenInfo,
  onShare,
  posterUrl: passedPoster,
  downloadTask,
  isDownloaded = false,
}) => {
  const isDownloading = downloadTask && downloadTask.status === 'downloading';
  const [isShareCopied, setIsShareCopied] = useState(false);

  // Format size helper
  const formattedSize = episode.size_mb >= 1024
    ? `${(episode.size_mb / 1024).toFixed(2)} Go`
    : `${episode.size_mb.toFixed(1)} Mo`;

  // Media Classification (Zero external API, pure native filename analysis)
  const meta = MediaClassifier.analyze(episode.title, episode.file_name);

  // A file is strictly a video if its extension or metadata matches video standards
  const isVideo = meta.isVideo || MediaClassifier.isVideoFile(episode.title, episode.file_name);
  const isAudio = meta.isAudio || MediaClassifier.isAudioFile(episode.title, episode.file_name);

  // Strictly identify document/scan formats (PDF, CBZ, CBR, EPUB)
  const isDocExt =
    episode.file_name?.toLowerCase().endsWith('.cbz') ||
    episode.file_name?.toLowerCase().endsWith('.cbr') ||
    episode.file_name?.toLowerCase().endsWith('.pdf') ||
    episode.file_name?.toLowerCase().endsWith('.epub') ||
    episode.title?.toLowerCase().endsWith('.cbz') ||
    episode.title?.toLowerCase().endsWith('.cbr') ||
    episode.title?.toLowerCase().endsWith('.pdf');

  const isImageExt =
    episode.file_name?.toLowerCase().endsWith('.png') ||
    episode.file_name?.toLowerCase().endsWith('.jpg') ||
    episode.file_name?.toLowerCase().endsWith('.jpeg') ||
    episode.file_name?.toLowerCase().endsWith('.webp');

  // A file can ONLY be a Manga / Scan if it is strictly NOT a video and NOT an audio!
  const isManga =
    !isVideo &&
    !isAudio &&
    (meta.isDocument ||
      isDocExt ||
      ((episode.channel?.toLowerCase().includes('manga') || episode.channel?.toLowerCase().includes('scan')) && isDocExt));

  // A file is an image only if it is NOT a video and NOT an audio
  const isImageFile =
    !isVideo &&
    !isAudio &&
    !isManga &&
    (meta.isImage ||
      isImageExt ||
      MediaClassifier.isImageFile(episode.title, episode.file_name));

  // Determine the best display poster (only for animes or when explicit poster provided)
  const [poster, setPoster] = useState<string | undefined>(() => {
    if (meta.isAudio || isManga || meta.isDocument) return undefined;
    return passedPoster || episode.thumbnail || JikanService.getCachedPoster(episode.title || episode.file_name);
  });

  useEffect(() => {
    if (meta.isAudio || isManga || meta.isDocument) {
      setPoster(undefined);
      return;
    }
    if (passedPoster) {
      setPoster(passedPoster);
      return;
    }
    if (episode.thumbnail) {
      setPoster(episode.thumbnail);
      return;
    }

    if (meta.type === 'anime' || isVideo) {
      const cached = JikanService.getCachedPoster(episode.title || episode.file_name);
      if (cached) {
        setPoster(cached);
      } else {
        // Background lookup for poster
        const clean = JikanService.extractAnimeTitle(episode.title || episode.file_name);
        if (clean && clean.length >= 3) {
          JikanService.searchAnime(clean, 1).then((results) => {
            if (results && results.length > 0) {
              const url = results[0].images.webp?.image_url || results[0].images.jpg.image_url;
              if (url) {
                JikanService.setCachedPoster(episode.title || episode.file_name, url);
                setPoster(url);
              }
            }
          }).catch(() => {});
        }
      }
    }
  }, [passedPoster, episode.thumbnail, episode.title, episode.file_name, meta.type, isVideo, meta.isAudio, isManga, meta.isDocument]);

  const displayTitle = meta.displayTitle || JikanService.formatDisplayTitle(episode.title, episode.file_name);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await shareDirectMedia(episode);
    if (res.copied) {
      setIsShareCopied(true);
      setTimeout(() => setIsShareCopied(false), 2000);
    }
    if (onShare) {
      onShare(episode);
    }
  };

  return (
    <div className="group relative bg-[#181822] hover:bg-[#1E1E2A] rounded-xl p-2 sm:p-2.5 border border-white/5 hover:border-purple-500/40 transition-all duration-200 shadow-md">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Media Thumbnail / Icon */}
        <div
          onClick={() => onPlay(episode)}
          className={`relative w-14 h-18 sm:w-16 sm:h-20 rounded-lg overflow-hidden shrink-0 flex items-center justify-center cursor-pointer border border-white/10 shadow-sm transition-transform group-hover:scale-[1.02] ${
            meta.isAudio
              ? 'bg-gradient-to-br from-purple-900 via-pink-900 to-indigo-950 text-pink-300'
              : meta.isDocument
              ? 'bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-950 text-teal-300'
              : 'bg-gradient-to-br from-[#121216] via-purple-950/40 to-black'
          }`}
        >
          {poster ? (
            <img
              src={poster}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : meta.isAudio ? (
            <div className="flex flex-col items-center justify-center text-center p-1 space-y-0.5">
              <Disc className="w-5 h-5 text-pink-400 animate-spin-slow" />
              <span className="text-[8px] font-bold text-pink-300 uppercase tracking-wider">{meta.extension || 'MP3'}</span>
            </div>
          ) : meta.isDocument ? (
            <div className="flex flex-col items-center justify-center text-center p-1 space-y-0.5">
              <FileText className="w-5 h-5 text-teal-400" />
              <span className="text-[8px] font-bold text-teal-300 uppercase">{meta.extension || 'DOC'}</span>
            </div>
          ) : meta.type === 'movie_series' ? (
            <div className="flex flex-col items-center justify-center text-center p-1 space-y-0.5 text-indigo-400">
              <Clapperboard className="w-5 h-5" />
              <span className="text-[8px] font-bold uppercase">FILM</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-purple-400/50 space-y-0.5">
              <Film className="w-5 h-5" />
              <span className="text-[8px] font-mono">Anime</span>
            </div>
          )}

          {/* Dark overlay with Play / Read / View icon */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-all">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform ${
                meta.isAudio
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-pink-500/40'
                  : isManga
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/40'
                  : isImageFile
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-500/40'
                  : meta.isDocument
                  ? 'bg-teal-600 text-white shadow-teal-600/40'
                  : 'bg-red-600/90 text-white shadow-red-600/40'
              }`}
            >
              {isManga ? (
                <BookOpen className="w-3 h-3" />
              ) : isImageFile ? (
                <ImageIcon className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3 ml-0.5 fill-current" />
              )}
            </div>
          </div>

          {/* Duration badge if available */}
          {episode.duration && (
            <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold px-1 py-0.2 rounded bg-black/80 text-white backdrop-blur-sm">
              {episode.duration}
            </span>
          )}
        </div>

        {/* Media Details */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => {
            if (meta.type === 'anime' && onOpenInfo && !isManga && !isImageFile) {
              onOpenInfo(episode);
            } else {
              onPlay(episode);
            }
          }}
        >
          <div className="space-y-0.5">
            <h3 className="text-xs sm:text-sm font-bold text-gray-100 group-hover:text-purple-200 line-clamp-2 leading-snug transition-colors">
              {displayTitle}
            </h3>
            <p className="text-[10px] text-gray-400 truncate font-mono">
              {meta.subtitle || episode.file_name}
            </p>
          </div>

          {/* Metadata Badges */}
          <div className="flex items-center flex-wrap gap-1 mt-1.5">
            {/* Category Type Badge */}
            {meta.isAudio ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/30">
                <Music className="w-2.5 h-2.5" />
                Audio
              </span>
            ) : isManga ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <BookOpen className="w-2.5 h-2.5" />
                Manga / Scan
              </span>
            ) : isImageFile ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <ImageIcon className="w-2.5 h-2.5" />
                Image HD
              </span>
            ) : meta.isDocument ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <FileText className="w-2.5 h-2.5" />
                Fichier
              </span>
            ) : meta.type === 'movie_series' ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <Clapperboard className="w-2.5 h-2.5" />
                Film
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Film className="w-2.5 h-2.5" />
                Animé
              </span>
            )}

            {/* Language Tag */}
            {meta.languageBadge && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {meta.languageBadge}
              </span>
            )}

            {/* Size Badge */}
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-black/40 text-purple-300 border border-purple-500/20">
              <HardDrive className="w-2.5 h-2.5 text-purple-400" />
              {formattedSize}
            </span>

            {/* Quality Badge */}
            {meta.qualityBadge && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-white/5 text-gray-300 border border-white/10">
                {meta.qualityBadge}
              </span>
            )}

            {/* Offline Ready Badge */}
            {isDownloaded && (
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Check className="w-2.5 h-2.5 text-emerald-400" />
                Hors-ligne
              </span>
            )}
          </div>
        </div>

        {/* Actions Buttons */}
        <div className="shrink-0 flex items-center gap-1">
          {meta.type === 'anime' && onOpenInfo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenInfo(episode);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-purple-600/30 text-gray-400 hover:text-purple-300 transition-all cursor-pointer border border-white/5 hover:border-purple-500/40"
              title="Fiche MyAnimeList & Personnages"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Share Direct App Link Button */}
          <button
            onClick={handleShare}
            className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
              isShareCopied
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 hover:bg-white/15 text-gray-400 hover:text-purple-300 border-white/5 hover:border-purple-500/40'
            }`}
            title={isShareCopied ? 'Lien direct copié !' : "Partager le lien direct dans l'app"}
          >
            {isShareCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>

          {isDownloading ? (
            <div className="flex flex-col items-center">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/10"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-purple-500 transition-all duration-300"
                    strokeDasharray={`${downloadTask.progress}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-[8px] font-extrabold text-purple-300 font-mono">
                  {downloadTask.downloadedBytes === 0 ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    `${Math.round(downloadTask.progress)}%`
                  )}
                </span>
              </div>
            </div>
          ) : isDownloaded ? (
            <button
              onClick={() => onPlay(episode)}
              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
              title="Lire hors-ligne"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onDownload(episode)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-all cursor-pointer border border-white/5 hover:border-purple-500/40 active:scale-95"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

