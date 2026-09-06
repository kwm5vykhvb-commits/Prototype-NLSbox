import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  FastForward,
  HardDrive,
  Tv,
  AlertCircle,
  ExternalLink,
  Download,
  Copy,
  Check,
  Film,
  Music,
  Disc,
  Repeat,
  Sparkles,
  Share2,
  Lock,
  Unlock,
  PictureInPicture,
  RefreshCw,
  Sliders,
  Ratio,
} from 'lucide-react';
import { Episode } from '../types';
import { MediaClassifier } from '../utils/mediaClassifier';
import { shareDirectMedia } from '../utils/shareMedia';
import { offlineCacheService } from '../services/offlineCacheService';
import {
  getInternalStorageDownloadUrl,
  getDirectRemoteDownloadUrl,
  getVlcStreamUrl,
  getAndroidIntentUrl,
  triggerDeviceDownload,
} from '../utils/download';
import {
  requestFullscreenSafe,
  exitFullscreenSafe,
  isFullscreenActive,
  addFullscreenChangeListener,
} from '../utils/fullscreen';

interface VideoPlayerModalProps {
  episode: Episode | null;
  videoUrl: string;
  isOffline?: boolean;
  onClose: () => void;
  backendUrl?: string;
  customUserAgent?: string;
  customReferer?: string;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  episode,
  videoUrl,
  isOffline = false,
  onClose,
  backendUrl = 'https://nlsbox.onrender.com',
  customUserAgent,
  customReferer,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isDirectShareCopied, setIsDirectShareCopied] = useState(false);

  // Universal Device Adaptations
  const [isLocked, setIsLocked] = useState(false);
  const [aspectMode, setAspectMode] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'rewind' | 'forward' | null>(null);
  const [resumePrompt, setResumePrompt] = useState<{ time: number; formatted: string } | null>(null);
  const [streamSourceType, setStreamSourceType] = useState<'proxy' | 'direct'>('proxy');

  const lastTapRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  // Classify file
  const meta = MediaClassifier.analyze(episode?.title || '', episode?.file_name || '');
  const isAudio = meta.isAudio;
  const isMkv = episode?.file_name.toLowerCase().endsWith('.mkv') || false;

  const directDownloadUrl = React.useMemo(() => {
    if (!episode) return videoUrl;
    return getDirectRemoteDownloadUrl(episode, backendUrl);
  }, [episode, videoUrl, backendUrl]);

  const deviceDownloadUrl = React.useMemo(() => {
    if (!episode) return videoUrl;
    return getInternalStorageDownloadUrl(episode, backendUrl);
  }, [episode, videoUrl, backendUrl]);

  const vlcUrl = React.useMemo(() => {
    if (!episode) return `vlc://${directDownloadUrl}`;
    return getVlcStreamUrl(episode, backendUrl);
  }, [episode, directDownloadUrl, backendUrl]);

  const androidIntentUrl = React.useMemo(() => {
    if (!episode) return '';
    return getAndroidIntentUrl(episode, backendUrl);
  }, [episode, backendUrl]);

  // Active stream URL
  const activeSource = React.useMemo(() => {
    if (isOffline || (videoUrl && (videoUrl.startsWith('blob:') || videoUrl.startsWith('data:')))) {
      return videoUrl;
    }
    if (episode) {
      const match = videoUrl.match(/\/download\/([^/]+)\/(\d+)/);
      const ch = match ? match[1] : (episode.channel || 'animes_vostfr').replace(/^@/, '');
      const msgId = match ? match[2] : episode.message_id;
      const params = new URLSearchParams();
      if (customUserAgent) params.set('ua', customUserAgent);
      if (customReferer) params.set('ref', customReferer);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return `/api/stream/${encodeURIComponent(ch)}/${encodeURIComponent(msgId)}${queryStr}`;
    }
    return videoUrl;
  }, [videoUrl, isOffline, episode, customUserAgent, customReferer]);

  const handleDeviceDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    if (episode) {
      triggerDeviceDownload(episode, backendUrl);
    }
  };

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check saved playback position from offline storage
  useEffect(() => {
    if (!episode) return;
    offlineCacheService.getPlaybackPosition(episode.message_id).then((saved) => {
      if (saved && saved.currentTime > 10 && saved.duration > 30 && saved.currentTime < saved.duration - 15) {
        setResumePrompt({
          time: saved.currentTime,
          formatted: formatTime(saved.currentTime),
        });
      }
    });
  }, [episode]);

  // Periodic position persistence
  useEffect(() => {
    if (!episode || currentTime <= 0) return;
    const interval = setInterval(() => {
      if (currentTime > 5 && duration > 0) {
        offlineCacheService.savePlaybackPosition(episode.message_id, currentTime, duration, {
          title: episode.title,
          channel: episode.channel,
        }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [episode, currentTime, duration]);

  // Auto-hide controls for video
  const resetControlsTimeout = () => {
    if (isLocked) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !hasError && !isAudio) setShowControls(false);
    }, 3500);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, hasError, isAudio, isLocked]);

  // Sync fullscreen state with native document fullscreen changes
  useEffect(() => {
    return addFullscreenChangeListener((active) => {
      setIsFullscreen(active);
    });
  }, []);

  const handleMediaError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleCopyLink = async () => {
    if (!episode) return;
    const res = await shareDirectMedia(episode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDirectShare = async () => {
    if (!episode) return;
    const res = await shareDirectMedia(episode);
    if (res.copied) {
      setIsDirectShareCopied(true);
      setTimeout(() => setIsDirectShareCopied(false), 2500);
    }
  };

  const togglePlay = () => {
    if (isLocked) return;
    const media = isAudio ? audioRef.current : videoRef.current;
    if (media) {
      if (isPlaying) {
        media.pause();
        setIsPlaying(false);
      } else {
        media.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const seekRelative = (seconds: number) => {
    if (isLocked) return;
    const media = isAudio ? audioRef.current : videoRef.current;
    if (media) {
      media.currentTime = Math.max(0, Math.min(media.currentTime + seconds, duration));
      setCurrentTime(media.currentTime);
      resetControlsTimeout();
    }
  };

  const handleZoneTap = (zone: 'left' | 'center' | 'right') => {
    if (isLocked) {
      setShowControls(true);
      setTimeout(() => setShowControls(false), 2000);
      return;
    }
    const now = Date.now();
    if (zone === 'left') {
      if (now - lastTapRef.current.left < 320) {
        seekRelative(-10);
        setDoubleTapFeedback('rewind');
        setTimeout(() => setDoubleTapFeedback(null), 600);
      } else {
        resetControlsTimeout();
      }
      lastTapRef.current.left = now;
    } else if (zone === 'right') {
      if (now - lastTapRef.current.right < 320) {
        seekRelative(10);
        setDoubleTapFeedback('forward');
        setTimeout(() => setDoubleTapFeedback(null), 600);
      } else {
        resetControlsTimeout();
      }
      lastTapRef.current.right = now;
    } else {
      togglePlay();
      resetControlsTimeout();
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {}
  };

  const cycleAspectMode = () => {
    setAspectMode((prev) => {
      if (prev === 'contain') return 'cover';
      if (prev === 'cover') return 'fill';
      return 'contain';
    });
  };

  const retryStream = () => {
    setIsLoading(true);
    setHasError(false);
    setStreamSourceType((prev) => (prev === 'proxy' ? 'direct' : 'proxy'));
    const media = isAudio ? audioRef.current : videoRef.current;
    if (media) {
      media.load();
      media.play().catch(() => {});
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const media = isAudio ? audioRef.current : videoRef.current;
    if (media) {
      media.currentTime = time;
      setCurrentTime(time);
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    const media = isAudio ? audioRef.current : videoRef.current;
    if (media) {
      media.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    const media = isAudio ? audioRef.current : videoRef.current;
    if (media) {
      media.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const media = isAudio ? audioRef.current : videoRef.current;
    if (media) {
      media.volume = val;
      media.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = async () => {
    const isCurrentlyFs = isFullscreen || isFullscreenActive();
    if (!isCurrentlyFs) {
      await requestFullscreenSafe(containerRef.current, videoRef.current);
      setIsFullscreen(true);
    } else {
      await exitFullscreenSafe(videoRef.current);
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!episode) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-lg select-none ${
        isFullscreen ? 'p-0' : 'p-0 sm:p-4'
      }`}
    >
      <div
        ref={containerRef}
        onMouseMove={resetControlsTimeout}
        onTouchStart={resetControlsTimeout}
        className={`relative w-full h-full ${
          isFullscreen
            ? 'sm:max-w-none sm:rounded-none border-none'
            : 'sm:h-auto sm:max-w-4xl sm:rounded-3xl border border-white/10'
        } bg-[#101018] overflow-hidden shadow-2xl flex flex-col justify-between ${
          isAudio ? 'sm:max-w-xl p-6 sm:p-8' : ''
        }`}
        style={
          isAudio
            ? { minHeight: 'auto' }
            : isFullscreen
            ? { minHeight: '100%', height: '100%' }
            : { minHeight: '320px', aspectRatio: '16/9' }
        }
      >
        {/* Top Header Bar */}
        <div className={`p-4 flex items-center justify-between z-20 ${
          isAudio ? 'w-full mb-4 p-0' : 'absolute top-0 left-0 right-0 bg-gradient-to-b from-black/95 via-black/60 to-transparent'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
              isAudio ? 'bg-gradient-to-tr from-pink-600 to-purple-600' : 'bg-red-600/90'
            }`}>
              {isAudio ? <Music className="w-4 h-4 text-white" /> : <Tv className="w-4 h-4 text-white" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-xs sm:text-sm truncate">
                  {meta.displayTitle || episode.title}
                </h2>
                {(isOffline || (videoUrl && videoUrl.startsWith('blob:'))) && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                    Hors-ligne (0 forfait)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-400">
                <span className={`font-semibold uppercase ${isAudio ? 'text-pink-400' : 'text-red-400'}`}>
                  {meta.qualityBadge || episode.quality || 'HD'}
                </span>
                <span>•</span>
                <span className="truncate">{episode.file_name}</span>
                {episode.size_mb ? (
                  <>
                    <span>•</span>
                    <span>{episode.size_mb} MB</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isAudio && (
              <>
                {/* Screen Lock Toggle */}
                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  className={`p-2 rounded-full transition-all cursor-pointer border ${
                    isLocked
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                      : 'bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border-white/10'
                  }`}
                  title={isLocked ? 'Déverrouiller l\'écran' : 'Verrouiller les touches de l\'écran'}
                >
                  {isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />}
                </button>

                {/* Aspect Ratio / Fit mode */}
                <button
                  type="button"
                  onClick={cycleAspectMode}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/10 transition-all cursor-pointer"
                  title={`Format d'image: ${aspectMode === 'contain' ? 'Ajusté (16:9)' : aspectMode === 'cover' ? 'Remplir écran (Plein écran)' : 'Étiré'}`}
                >
                  <Ratio className="w-4 h-4" />
                </button>

                {/* Picture-in-Picture */}
                <button
                  type="button"
                  onClick={togglePiP}
                  className="hidden sm:inline-flex p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/10 transition-all cursor-pointer"
                  title="Mode Image dans l'image (PiP)"
                >
                  <PictureInPicture className="w-4 h-4" />
                </button>

                {/* Source Retry */}
                <button
                  type="button"
                  onClick={retryStream}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/10 transition-all cursor-pointer"
                  title="Basculer la source de streaming (Proxy / Direct)"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
                </button>
              </>
            )}

            {episode && (
              <button
                type="button"
                onClick={handleDirectShare}
                className={`p-2 rounded-full transition-all cursor-pointer border ${
                  isDirectShareCopied
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
                    : 'bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border-white/10'
                }`}
                title={isDirectShareCopied ? 'Lien direct copié !' : "Partager ce média (s'ouvre directement dans l'app)"}
              >
                {isDirectShareCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. AUDIO PLAYER VIEW */}
        {isAudio ? (
          <div className="w-full flex flex-col items-center justify-center space-y-6 my-auto">
            {/* Native Audio Element */}
            <audio
              ref={audioRef}
              src={activeSource}
              autoPlay
              loop={isLooping}
              onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
              onLoadedMetadata={() => {
                setIsLoading(false);
                if (audioRef.current) {
                  setDuration(audioRef.current.duration);
                  audioRef.current.playbackRate = playbackRate;
                }
              }}
              onWaiting={() => setIsLoading(true)}
              onPlaying={() => {
                setIsLoading(false);
                setIsPlaying(true);
              }}
              onError={handleMediaError}
              onEnded={() => {
                if (!isLooping) setIsPlaying(false);
              }}
            />

            {/* Vinyl Record Disc Visual */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-gradient-to-tr from-[#12121e] via-[#221c35] to-[#12121e] p-3 shadow-2xl border-4 border-white/10 flex items-center justify-center">
              {/* Vinyl Grooves */}
              <div className="absolute inset-4 rounded-full border border-white/5 border-dashed"></div>
              <div className="absolute inset-8 rounded-full border border-white/5"></div>
              <div className="absolute inset-12 rounded-full border border-white/5 border-dashed"></div>

              {/* Center Album Label */}
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 flex flex-col items-center justify-center text-white shadow-xl ${
                isPlaying ? 'animate-spin-slow' : ''
              }`}>
                <Disc className="w-7 h-7 text-white/90" />
                <span className="text-[8px] font-extrabold uppercase mt-0.5 tracking-wider">AUDIO</span>
              </div>
            </div>

            {/* Title & Artist Info */}
            <div className="text-center max-w-md px-2 space-y-1">
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight line-clamp-1">
                {meta.trackTitle || meta.displayTitle || episode.title}
              </h3>
              <p className="text-xs text-pink-300 font-medium">
                {meta.artist ? `Artiste : ${meta.artist}` : 'Piste Audio Haute Définition'}
              </p>
            </div>

            {/* Audio Waveform Bars Simulation */}
            <div className="flex items-center justify-center gap-1.5 h-8 w-full max-w-xs">
              {[40, 70, 30, 90, 60, 100, 50, 80, 45, 95, 35, 85, 65, 40].map((height, idx) => (
                <div
                  key={idx}
                  className="w-1.5 rounded-full bg-gradient-to-t from-pink-500 to-purple-500 transition-all duration-300"
                  style={{
                    height: isPlaying ? `${Math.max(15, (height * (isPlaying ? 1 : 0.2)))}%` : '15%',
                    opacity: isPlaying ? 0.9 : 0.3,
                  }}
                />
              ))}
            </div>

            {/* Audio Progress Scrubber */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeekChange}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>

            {/* Audio Control Buttons */}
            <div className="w-full flex items-center justify-between gap-2 pt-2">
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                  isLooping ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40' : 'text-gray-400 hover:text-white'
                }`}
                title={isLooping ? 'Boucle active' : 'Activer la boucle'}
              >
                <Repeat className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => seekRelative(-10)}
                  className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer"
                  title="-10s"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button
                  onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-pink-500/30 transition-all cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-0.5 fill-current" />}
                </button>

                <button
                  onClick={() => seekRelative(10)}
                  className="p-2 text-gray-300 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer"
                  title="+10s"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={cyclePlaybackRate}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title="Vitesse de lecture"
              >
                {playbackRate}x
              </button>
            </div>

            {/* Secondary actions (Volume & Download) */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="p-1.5 text-gray-400 hover:text-white">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={deviceDownloadUrl}
                  onClick={handleDeviceDownload}
                  download={episode.file_name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                  title="Télécharger directement dans le stockage de l'appareil"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Télécharger vers l'appareil</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* 2. VIDEO PLAYER VIEW */
          <>
            <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
              {!hasError ? (
                <>
                  <video
                    ref={videoRef}
                    src={activeSource}
                    autoPlay
                    playsInline
                    onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
                    onLoadedMetadata={() => {
                      setIsLoading(false);
                      if (videoRef.current) {
                        setDuration(videoRef.current.duration);
                        videoRef.current.playbackRate = playbackRate;
                        // Auto resume if prompted
                        if (resumePrompt) {
                          videoRef.current.currentTime = resumePrompt.time;
                          setCurrentTime(resumePrompt.time);
                          setResumePrompt(null);
                        }
                      }
                    }}
                    onWaiting={() => setIsLoading(true)}
                    onPlaying={() => {
                      setIsLoading(false);
                      setIsPlaying(true);
                    }}
                    onError={handleMediaError}
                    onEnded={() => setIsPlaying(false)}
                    className={`w-full h-full ${
                      aspectMode === 'cover'
                        ? 'object-cover'
                        : aspectMode === 'fill'
                        ? 'object-fill'
                        : 'object-contain'
                    } transition-all`}
                  />

                  {/* 3-Zone Touch & Double-Tap Seeking Layer */}
                  <div className="absolute inset-0 z-10 flex">
                    {/* Left 35% Zone (-10s) */}
                    <div
                      onClick={() => handleZoneTap('left')}
                      className="w-[35%] h-full cursor-pointer flex items-center justify-center"
                    >
                      {doubleTapFeedback === 'rewind' && (
                        <div className="animate-ping p-4 rounded-full bg-black/60 text-white flex flex-col items-center gap-1 backdrop-blur-md border border-white/20">
                          <RotateCcw className="w-8 h-8 text-purple-400" />
                          <span className="text-xs font-black">-10s</span>
                        </div>
                      )}
                    </div>

                    {/* Center 30% Zone (Play / Pause) */}
                    <div
                      onClick={() => handleZoneTap('center')}
                      className="w-[30%] h-full cursor-pointer flex items-center justify-center"
                    />

                    {/* Right 35% Zone (+10s) */}
                    <div
                      onClick={() => handleZoneTap('right')}
                      className="w-[35%] h-full cursor-pointer flex items-center justify-center"
                    >
                      {doubleTapFeedback === 'forward' && (
                        <div className="animate-ping p-4 rounded-full bg-black/60 text-white flex flex-col items-center gap-1 backdrop-blur-md border border-white/20">
                          <RotateCw className="w-8 h-8 text-purple-400" />
                          <span className="text-xs font-black">+10s</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Locked Overlay Badge */}
                  {isLocked && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Écran verrouillé (Appuyez sur le cadenas pour déverrouiller)</span>
                    </div>
                  )}

                  {/* Auto-Resume Prompt Banner */}
                  {resumePrompt && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-md border border-purple-500/40 text-white text-xs flex items-center gap-3 shadow-2xl">
                      <span>Reprendre à <strong className="text-purple-400">{resumePrompt.formatted}</strong> ?</span>
                      <button
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = resumePrompt.time;
                            setCurrentTime(resumePrompt.time);
                          }
                          setResumePrompt(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 font-bold cursor-pointer"
                      >
                        Reprendre
                      </button>
                      <button
                        onClick={() => setResumePrompt(null)}
                        className="text-gray-400 hover:text-gray-200 cursor-pointer text-xs"
                      >
                        Ignorer
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center max-w-lg space-y-4 my-auto">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600/20 to-purple-600/20 border border-red-500/30 flex items-center justify-center mx-auto text-red-400 shadow-xl">
                    <Film className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="text-white font-bold text-sm sm:text-base">
                      {isMkv ? 'Vidéo au format MKV détectée' : 'Lecture directe disponible'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {isMkv
                        ? 'Ce fichier animé est encodé en .MKV (Matroska). Les navigateurs web mobiles requièrent un lecteur natif ou VLC pour le lire avec sous-titres.'
                        : 'Le navigateur n\'a pas pu décoder ce flux en direct. Vous pouvez l\'ouvrir instantanément dans votre lecteur vidéo externe ou le télécharger.'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {/* Primary: Real device internal storage download */}
                    <a
                      href={deviceDownloadUrl}
                      onClick={handleDeviceDownload}
                      download={episode.file_name}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
                      title="Enregistrer le fichier directement dans la mémoire de votre téléphone (dossier Téléchargements)"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger vers l'appareil ({episode.size_mb || '0'} Mo)</span>
                    </a>

                    {/* VLC 1-click launcher */}
                    <a
                      href={vlcUrl}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1f1f2e] hover:bg-[#28283d] text-orange-400 border border-orange-500/30 text-xs font-bold transition-all cursor-pointer"
                      title="Lancer le flux immédiatement dans l'application VLC"
                    >
                      <Tv className="w-4 h-4" />
                      <span>Ouvrir dans VLC</span>
                    </a>

                    {/* Android Intent launcher for MX Player / System Gallery */}
                    {androidIntentUrl && (
                      <a
                        href={androidIntentUrl}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                        title="Ouvrir avec le lecteur vidéo natif de votre smartphone (MX Player, Galerie, etc.)"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Lecteur Android / MX</span>
                        <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
                      </a>
                    )}

                    {/* Copy NLSbox share link */}
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-semibold transition-all border border-white/10 cursor-pointer"
                      title="Copier le lien de lecture NLSbox à partager"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Lien NLSbox copié !</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Partager le lien NLSbox</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Loading Spinner overlay */}
              {isLoading && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                  <div className="w-10 h-10 border-3 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {/* Bottom Video Controls Bar */}
            {!hasError && (
              <div
                className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-300 z-20 ${
                  showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                {/* Progress Scrubber */}
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-[10px] sm:text-xs font-mono text-gray-400 min-w-[38px]">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeekChange}
                    className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <span className="text-[10px] sm:text-xs font-mono text-gray-400 min-w-[38px] text-right">
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Buttons Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
                    </button>

                    <button
                      onClick={() => seekRelative(-10)}
                      className="p-1.5 text-gray-300 hover:text-white transition-colors cursor-pointer"
                      title="-10s"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => seekRelative(10)}
                      className="p-1.5 text-gray-300 hover:text-white transition-colors cursor-pointer"
                      title="+10s"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={toggleFullscreen}
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-gray-200 border border-white/10 transition-colors cursor-pointer"
                      title="Basculer en plein écran"
                    >
                      <span>Plein écran</span>
                      <Maximize className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={cyclePlaybackRate}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-gray-200 hover:text-white border border-white/10 transition-colors cursor-pointer"
                      title="Vitesse de lecture"
                    >
                      {playbackRate}x
                    </button>

                    <button
                      onClick={toggleMute}
                      className="p-1.5 text-gray-300 hover:text-white transition-colors cursor-pointer"
                      title={isMuted ? 'Activer le son' : 'Couper le son'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={toggleFullscreen}
                      className="p-1.5 text-gray-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

