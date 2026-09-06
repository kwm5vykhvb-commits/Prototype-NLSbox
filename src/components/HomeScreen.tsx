import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  RotateCw,
  X,
  Film,
  AlertCircle,
  Tag,
  Layers,
  Zap,
  ShieldCheck,
  Star,
  Sparkles,
  Info,
  TrendingUp,
  Flame,
  Music,
  Clapperboard,
  FileText,
  Loader2,
  ArrowUp,
  MessageSquare,
} from 'lucide-react';
import { Episode, DownloadTask, JikanAnimeData, HubCategory, ChannelInfo } from '../types';
import { EpisodeCard } from './EpisodeCard';
import { ShimmerSkeleton } from './ShimmerSkeleton';
import { JikanService } from '../services/jikan';
import { AnimeDetailsModal } from './AnimeDetailsModal';
import { MediaClassifier } from '../utils/mediaClassifier';
import { HubSelector } from './HubSelector';
import {
  normalizeText,
  findTypoCorrection,
  fuzzyMatchEpisode,
  getAutocompleteSuggestions,
} from '../utils/searchHelper';

interface HomeScreenProps {
  episodes: Episode[];
  isLoading: boolean;
  activeCategory: HubCategory;
  activeChannel: string;
  searchMode: 'single' | 'multi';
  selectedChannels: string[];
  channelsCountMap: Record<HubCategory, number>;
  isMatureVisible?: boolean;
  onSelectCategory: (category: HubCategory) => void;
  onRefresh: () => Promise<void>;
  onSearch: (query: string) => void;
  onPlayEpisode: (episode: Episode) => void;
  onDownloadEpisode: (episode: Episode) => void;
  activeDownloads: Record<number, DownloadTask>;
  savedDownloads: DownloadTask[];
  onOpenChannelModal?: () => void;
  errorMessage?: string | null;
  savedChannels?: ChannelInfo[];
  onSelectSingleChannel?: (channelId: string) => void;
  onRequestContent?: (query?: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  episodes,
  isLoading,
  activeCategory,
  activeChannel,
  searchMode,
  selectedChannels,
  channelsCountMap,
  isMatureVisible = false,
  onSelectCategory,
  onRefresh,
  onSearch,
  onPlayEpisode,
  onDownloadEpisode,
  activeDownloads,
  savedDownloads,
  onOpenChannelModal,
  errorMessage,
  savedChannels,
  onSelectSingleChannel,
  onRequestContent,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [selectedSubFilter, setSelectedSubFilter] = useState<string>('all');
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Monitor window scroll to display floating button and dismiss dropdown
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 280);
      setIsSearchFocused(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click outside to dismiss search suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset subfilters and search/MAL state when active category changes
  useEffect(() => {
    setSelectedSubFilter('all');
    if (activeCategory !== 'anime') {
      setMatchedAnimeMAL(null);
    }
  }, [activeCategory]);

  // Jikan API States
  const [trendingAnimes, setTrendingAnimes] = useState<JikanAnimeData[]>([]);
  const [matchedAnimeMAL, setMatchedAnimeMAL] = useState<JikanAnimeData | null>(null);
  const [selectedAnimeForModal, setSelectedAnimeForModal] = useState<JikanAnimeData | null>(null);
  const [selectedEpisodeForModal, setSelectedEpisodeForModal] = useState<Episode | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingModalData, setIsLoadingModalData] = useState(false);

  // Keep a ref to onSearch so useEffect doesn't trigger on parent re-renders
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Load Trending Animes from Jikan API on initial load
  useEffect(() => {
    let isMounted = true;
    JikanService.getTopTrendingAnime()
      .then((data) => {
        if (isMounted && data.length > 0) {
          setTrendingAnimes(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const lastSearchedQuery = useRef('');

  // Manual search trigger: executes only when the user presses Enter or clicks 'Rechercher'
  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearchFocused(false);
    setSelectedSuggestionIndex(-1);
    const trimmed = searchInput.trim();
    lastSearchedQuery.current = trimmed;
    onSearchRef.current(trimmed);

    // Search Jikan API in parallel when search term is active in anime hub
    if (trimmed.length >= 2) {
      JikanService.searchAnime(trimmed, 1)
        .then((results) => {
          if (results && results.length > 0) {
            setMatchedAnimeMAL(results[0]);
          } else {
            setMatchedAnimeMAL(null);
          }
        })
        .catch(() => setMatchedAnimeMAL(null));
    } else {
      setMatchedAnimeMAL(null);
    }
  };

  // Try to match MAL data when episode list changes and query was empty or from first episode
  useEffect(() => {
    if (!searchInput.trim() && episodes.length > 0 && !matchedAnimeMAL) {
      const firstTitle = episodes[0]?.title || episodes[0]?.file_name || '';
      const cleanName = JikanService.extractAnimeTitle(firstTitle);
      if (cleanName && cleanName.length >= 3) {
        JikanService.searchAnime(cleanName, 1)
          .then((results) => {
            if (results && results.length > 0) {
              setMatchedAnimeMAL(results[0]);
            }
          })
          .catch(() => {});
      }
    }
  }, [episodes, searchInput, matchedAnimeMAL]);

  // Cache the default channel feed (when search is empty) to enable instant fuzzy recovery
  const defaultFeedCacheRef = useRef<Episode[]>([]);
  useEffect(() => {
    if (!searchInput.trim() && episodes.length > 0) {
      defaultFeedCacheRef.current = episodes;
    }
  }, [episodes, searchInput]);

  // Extract known titles from both current episodes and cached feed
  const knownTitles = React.useMemo(() => {
    const titles = new Set<string>();
    for (const ep of episodes) {
      const t = JikanService.extractAnimeTitle(ep.title || ep.file_name);
      if (t && t.length >= 3) titles.add(t);
    }
    for (const ep of defaultFeedCacheRef.current) {
      const t = JikanService.extractAnimeTitle(ep.title || ep.file_name);
      if (t && t.length >= 3) titles.add(t);
    }
    return Array.from(titles);
  }, [episodes]);

  // Compute typo suggestion (Did you mean?)
  const typoSuggestion = React.useMemo(() => {
    const trimmed = searchInput.trim();
    if (!trimmed || trimmed.length < 3) return null;

    // Check if matchedAnimeMAL exists and has an official title different from user input
    if (
      matchedAnimeMAL?.title &&
      normalizeText(matchedAnimeMAL.title) !== normalizeText(trimmed)
    ) {
      return { suggestion: matchedAnimeMAL.title, score: 0.95 };
    }

    return findTypoCorrection(trimmed, activeCategory, knownTitles);
  }, [searchInput, activeCategory, knownTitles, matchedAnimeMAL]);

  // Fallback local fuzzy matching if backend returned 0 results but we have items in cache
  const localFuzzyMatches = React.useMemo(() => {
    const trimmed = searchInput.trim();
    if (!trimmed || episodes.length > 0 || defaultFeedCacheRef.current.length === 0) {
      return [];
    }
    return defaultFeedCacheRef.current.filter((ep) => fuzzyMatchEpisode(ep, trimmed));
  }, [searchInput, episodes]);

  // Live Instant Autocomplete Suggestions (100% Client-Side, 0 Telegram API calls while typing)
  // STRICT RULE: If activeCategory === 'mature', keep mature completely untouched (returns empty array)
  const liveSuggestions = React.useMemo(() => {
    if (activeCategory === 'mature') return [];
    if (!searchInput.trim() || searchInput.trim().length < 1) return [];
    return getAutocompleteSuggestions(searchInput, activeCategory, knownTitles, 5);
  }, [searchInput, activeCategory, knownTitles]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (liveSuggestions.length === 0 || !isSearchFocused) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev + 1) % liveSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev - 1 + liveSuggestions.length) % liveSuggestions.length);
    } else if (e.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < liveSuggestions.length) {
        e.preventDefault();
        const chosen = liveSuggestions[selectedSuggestionIndex];
        handleApplySuggestion(chosen);
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
    }
  };

  const getCategoryLabel = (cat: HubCategory): string => {
    switch (cat) {
      case 'anime':
        return 'Anime';
      case 'movie_series':
        return 'Films & Séries';
      case 'games':
        return 'Jeux Vidéo';
      case 'music':
        return 'Musique';
      case 'document':
        return 'Manga & Scans';
      case 'wallpapers':
        return 'Fonds d\'écran';
      default:
        return 'Catalogue';
    }
  };

  const renderHighlightedMatch = (text: string, query: string) => {
    if (!query) return <span>{text}</span>;
    const qNorm = normalizeText(query);
    const tNorm = normalizeText(text);
    const idx = tNorm.indexOf(qNorm);
    if (idx === -1) {
      const firstWordQuery = qNorm.split(' ')[0];
      if (firstWordQuery && firstWordQuery.length >= 2) {
        const wordIdx = tNorm.indexOf(firstWordQuery);
        if (wordIdx !== -1) {
          return (
            <span>
              {text.slice(0, wordIdx)}
              <span className="text-purple-300 font-bold underline decoration-purple-400/60">
                {text.slice(wordIdx, wordIdx + firstWordQuery.length)}
              </span>
              {text.slice(wordIdx + firstWordQuery.length)}
            </span>
          );
        }
      }
      return <span>{text}</span>;
    }
    return (
      <span>
        {text.slice(0, idx)}
        <span className="text-purple-300 font-bold underline decoration-purple-400/60">
          {text.slice(idx, idx + query.length)}
        </span>
        {text.slice(idx + query.length)}
      </span>
    );
  };

  const handleApplySuggestion = (suggestedTitle: string) => {
    setSearchInput(suggestedTitle);
    setIsSearchFocused(false);
    setSelectedSuggestionIndex(-1);
    lastSearchedQuery.current = suggestedTitle;
    onSearchRef.current(suggestedTitle);

    if (suggestedTitle.length >= 2) {
      JikanService.searchAnime(suggestedTitle, 1)
        .then((results) => {
          if (results && results.length > 0) {
            setMatchedAnimeMAL(results[0]);
          } else {
            setMatchedAnimeMAL(null);
          }
        })
        .catch(() => setMatchedAnimeMAL(null));
    }
  };

  const handleRefresh = async () => {
    setIsPullRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsPullRefreshing(false), 400);
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setIsSearchFocused(false);
    setSelectedSuggestionIndex(-1);
    setMatchedAnimeMAL(null);
    if (lastSearchedQuery.current !== '') {
      lastSearchedQuery.current = '';
      onSearchRef.current('');
    }
  };

  // Quick click on a Trending Anime from Jikan carousel
  const handleSelectTrending = (anime: JikanAnimeData) => {
    const titleToSearch = anime.title_english || anime.title;
    setSearchInput(titleToSearch);
    setMatchedAnimeMAL(anime);
    setSelectedAnimeForModal(anime);
    setSelectedEpisodeForModal(null);
    lastSearchedQuery.current = titleToSearch;
    onSearchRef.current(titleToSearch);
  };

  // Open MAL modal from episode card
  const handleOpenEpisodeInfo = async (episode: Episode) => {
    setSelectedEpisodeForModal(episode);
    setIsDetailModalOpen(true);

    const cleanTitle = JikanService.extractAnimeTitle(episode.title || episode.file_name);
    if (!cleanTitle) return;

    // Check if matchedAnimeMAL matches
    if (
      matchedAnimeMAL &&
      (matchedAnimeMAL.title.toLowerCase().includes(cleanTitle.toLowerCase()) ||
        cleanTitle.toLowerCase().includes(matchedAnimeMAL.title.toLowerCase()))
    ) {
      setSelectedAnimeForModal(matchedAnimeMAL);
      return;
    }

    setIsLoadingModalData(true);
    try {
      const results = await JikanService.searchAnime(cleanTitle, 1);
      if (results.length > 0) {
        setSelectedAnimeForModal(results[0]);
      } else {
        setSelectedAnimeForModal(null);
      }
    } catch {
      setSelectedAnimeForModal(null);
    } finally {
      setIsLoadingModalData(false);
    }
  };

  // Detect whether we are presenting fuzzy fallback results
  const isUsingFuzzyFallback = episodes.length === 0 && localFuzzyMatches.length > 0;
  const sourceEpisodes = isUsingFuzzyFallback ? localFuzzyMatches : episodes;

  // Filter episodes by category tags and media types with 100% strict isolation
  const filteredEpisodes = sourceEpisodes.filter((ep) => {
    const meta = MediaClassifier.analyze(ep.title, ep.file_name);
    const titleAndFile = `${ep.title} ${ep.file_name}`.toLowerCase();

    // 1. STRICT ISOLATION OF MATURE (+18) CONTENT
    // Non-mature spaces must NEVER display explicit / 18+ content
    if (activeCategory !== 'mature' && meta.isMature) {
      return false;
    }

    // 2. MATURE SPACE ISOLATION
    // When viewing the mature space (+18), show all media from the channel(s) designated for this space.
    // Do not discard episodes just because their filename or channel ID lacks specific keywords.

    // 3. CATEGORY STRICT MATCHING WITH ULTRA-PRECISE VALIDATION
    if (activeCategory === 'anime') {
      // Rejeter tout ce qui n'est pas une vidéo (photos, audios, gifs, doc, apk...)
      // Les fichiers MKV, MP4, AVI, WEBM, etc. sont rigoureusement acceptés
      const isVideo = MediaClassifier.isVideoFile(ep.title, ep.file_name);
      if (!isVideo) return false;

      // Rejeter les résultats de moins de 10 MB (vignettes, extraits, miniatures, gifs)
      if (typeof ep.size_mb === 'number' && ep.size_mb > 0 && ep.size_mb < 10) {
        return false;
      }
    }

    if (activeCategory === 'movie_series') {
      // Rejeter tout ce qui n'est pas une vidéo (photos, audios, gifs, doc, apk...)
      // Les fichiers MKV, MP4, AVI, WEBM, etc. sont rigoureusement acceptés
      const isVideo = MediaClassifier.isVideoFile(ep.title, ep.file_name);
      if (!isVideo) return false;

      // Rejeter les résultats de moins de 10 MB
      if (typeof ep.size_mb === 'number' && ep.size_mb > 0 && ep.size_mb < 10) {
        return false;
      }
    }

    if (activeCategory === 'music') {
      // Aucun fichier qui n'est pas audio ne s'affiche dans le résultat
      const isAudio = MediaClassifier.isAudioFile(ep.title, ep.file_name);
      if (!isAudio) return false;

      // Aucun fichier de plus de 30 MB n'apparaît dans le résultat
      if (typeof ep.size_mb === 'number' && ep.size_mb > 30) {
        return false;
      }
    }

    if (activeCategory === 'document') {
      // Uniquement scans, mangas et documents : rejeter formellement vidéos et audios
      const isVid = MediaClassifier.isVideoFile(ep.title, ep.file_name);
      const isAud = MediaClassifier.isAudioFile(ep.title, ep.file_name);
      if (isVid || isAud) return false;

      const isDoc = MediaClassifier.isDocumentFile(ep.title, ep.file_name);
      const isDocChannel = (ep.channel || '').includes('scan') || (ep.channel || '').includes('pdf') || (ep.channel || '').includes('manga') || (ep.channel || '').includes('book');
      if (!isDoc && !isDocChannel && !titleAndFile.includes('scan') && !titleAndFile.includes('tome') && !titleAndFile.includes('chapitre')) {
        return false;
      }
    }

    if (activeCategory === 'wallpapers') {
      // Uniquement images et fonds d'écran : rejeter vidéos et audios
      const isVid = MediaClassifier.isVideoFile(ep.title, ep.file_name);
      const isAud = MediaClassifier.isAudioFile(ep.title, ep.file_name);
      if (isVid || isAud) return false;

      const isImage = MediaClassifier.isImageFile(ep.title, ep.file_name);
      const isWallpaperChannel = (ep.channel || '').includes('wallpaper') || (ep.channel || '').includes('art') || (ep.channel || '').includes('amoled');
      if (!isImage && !isWallpaperChannel && !titleAndFile.includes('wallpaper') && !titleAndFile.includes('fond') && !titleAndFile.includes('amoled')) {
        return false;
      }
    }

    if (activeCategory === 'games') {
      // Uniquement jeux vidéo, ROMs, émulateurs, APKs et archives décompressables (.zip, .7z, .rar) : rejeter vidéos d'épisodes et audios
      const isVid = MediaClassifier.isVideoFile(ep.title, ep.file_name);
      const isAud = MediaClassifier.isAudioFile(ep.title, ep.file_name);
      if (isVid || isAud) return false;

      const isGame = MediaClassifier.isGameFile(ep.title, ep.file_name);
      const isGameChannel = (ep.channel || '').includes('game') || (ep.channel || '').includes('gaming') || (ep.channel || '').includes('retro') || (ep.channel || '').includes('rom');
      if (
        !isGame &&
        !isGameChannel &&
        !titleAndFile.includes('game') &&
        !titleAndFile.includes('rom') &&
        !titleAndFile.includes('apk') &&
        !titleAndFile.includes('mod') &&
        !titleAndFile.includes('.zip') &&
        !titleAndFile.includes('.7z') &&
        !titleAndFile.includes('.rar')
      ) {
        return false;
      }
    }

    // 4. SUB-FILTERS INSIDE ACTIVE HUB
    if (selectedSubFilter === 'all') return true;
    if (selectedSubFilter === '1080p') return (ep.quality || ep.file_name).includes('1080') || meta.qualityBadge?.includes('1080');
    if (selectedSubFilter === '720p') return (ep.quality || ep.file_name).includes('720') || meta.qualityBadge?.includes('720');
    if (selectedSubFilter === '4k') return (ep.quality || ep.file_name).toLowerCase().includes('4k') || (ep.quality || ep.file_name).toLowerCase().includes('2160') || meta.qualityBadge?.includes('4K');
    if (selectedSubFilter === 'amoled') return titleAndFile.includes('amoled') || titleAndFile.includes('dark') || titleAndFile.includes('noir');
    if (selectedSubFilter === 'roms') return meta.extension === 'iso' || meta.extension === 'rom' || meta.extension === 'nsp' || meta.extension === 'cso' || titleAndFile.includes('rom') || titleAndFile.includes('ps2') || titleAndFile.includes('switch') || titleAndFile.includes('psp');
    if (selectedSubFilter === 'apks') return meta.extension === 'apk' || meta.extension === 'xapk' || titleAndFile.includes('apk') || titleAndFile.includes('mod');
    if (selectedSubFilter === 'pdf') return meta.isDocument || meta.extension === 'pdf' || meta.extension === 'epub' || meta.extension === 'cbr' || meta.extension === 'cbz';
    if (selectedSubFilter === 'vostfr') return titleAndFile.includes('vostfr') || meta.languageBadge === 'VOSTFR';
    if (selectedSubFilter === 'vf') return titleAndFile.includes('vf') || meta.languageBadge === 'VF';
    if (selectedSubFilter === 'audio') return meta.isAudio;
    if (selectedSubFilter === 'uncut') return titleAndFile.includes('uncut') || titleAndFile.includes('18+') || titleAndFile.includes('+18') || titleAndFile.includes('non censuré') || titleAndFile.includes('explicite');

    return true;
  });

  const isMulti = searchMode === 'multi';

  // Sub-filters adapted to active hub
  const getSubFilters = () => {
    switch (activeCategory) {
      case 'anime':
        return [
          { id: 'all', label: 'Tous' },
          { id: 'vostfr', label: 'VOSTFR' },
          { id: 'vf', label: 'VF' },
          { id: '1080p', label: '1080p FHD' },
          { id: '720p', label: '720p HD' },
        ];
      case 'movie_series':
        return [
          { id: 'all', label: 'Tous' },
          { id: '1080p', label: '1080p' },
          { id: 'vostfr', label: 'VOSTFR' },
          { id: 'vf', label: 'VF' },
        ];
      case 'games':
        return [
          { id: 'all', label: 'Tous les jeux' },
          { id: 'roms', label: 'ROMs & Packs' },
          { id: 'apks', label: 'APKs & Mods' },
        ];
      case 'wallpapers':
        return [
          { id: 'all', label: 'Tous les fonds' },
          { id: '4k', label: '4K Ultra HD' },
          { id: 'amoled', label: 'AMOLED Dark' },
        ];
      case 'music':
        return [
          { id: 'all', label: 'Tous les sons' },
          { id: 'audio', label: 'Audio MP3/FLAC' },
        ];
      case 'document':
        return [
          { id: 'all', label: 'Tous les fichiers' },
          { id: 'pdf', label: 'PDF & Scans' },
        ];
      case 'mature':
        return [
          { id: 'all', label: 'Tous les contenus +18' },
          { id: 'uncut', label: 'Non Censuré / Uncut' },
          { id: 'vostfr', label: 'VOSTFR' },
        ];
    }
  };

  const subFilters = getSubFilters();

  return (
    <div className="pb-28 pt-1">
      {/* 1. Hub Category Selector (Sous-Applications) */}
      <HubSelector
        activeCategory={activeCategory}
        onSelectCategory={onSelectCategory}
        isMatureVisible={isMatureVisible}
      />

      {/* 2. Sticky Search Bar & Quick Filters (Toujours accessible lors du défilement) */}
      <div className="sticky top-[45px] sm:top-[50px] z-20 bg-[#0E0E12]/95 backdrop-blur-md px-3 py-1.5 border-b border-white/10 shadow-lg space-y-1.5">
        {/* Manual Search Bar */}
        <form onSubmit={handleManualSearch} className="flex items-center gap-1.5">
          <div className="relative flex-1" ref={searchContainerRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              id="anime-search-input"
              type="text"
              value={searchInput}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setIsSearchFocused(true);
                setSelectedSuggestionIndex(-1);
              }}
              placeholder={
                isMulti
                  ? 'Rechercher dans tout le catalogue (Multi-sources)...'
                  : 'Rechercher un animé, film, titre...'
              }
              className="w-full bg-[#181822] text-white placeholder-gray-500 text-xs sm:text-sm rounded-xl pl-8.5 pr-8 py-2 border border-white/10 focus:border-purple-500/60 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all shadow-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded-full bg-white/5 transition-colors cursor-pointer"
                title="Effacer la recherche"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Live Instant Autocomplete Dropdown */}
            {isSearchFocused && liveSuggestions.length > 0 && (
              <div
                id="search-live-autocomplete-dropdown"
                className="absolute left-0 right-0 top-full mt-1 bg-[#14141e]/98 backdrop-blur-xl border border-purple-500/40 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-white/5"
              >
                <div className="px-3 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between bg-white/[0.02]">
                  <span className="flex items-center gap-1 text-purple-300">
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    Suggestions • {getCategoryLabel(activeCategory)}
                  </span>
                  <span className="text-[8px] text-gray-400 font-medium">rapide</span>
                </div>
                <div className="py-0.5">
                  {liveSuggestions.map((suggestion, idx) => {
                    const isSelected = idx === selectedSuggestionIndex;
                    return (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleApplySuggestion(suggestion);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600/35 text-white font-bold'
                            : 'text-gray-200 hover:bg-purple-600/20 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 truncate">
                          <Search className="w-3 h-3 text-purple-400/80 shrink-0" />
                          <span className="truncate">
                            {renderHighlightedMatch(suggestion, searchInput)}
                          </span>
                        </div>
                        <span className="text-[9px] text-purple-300/80 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20 shrink-0">
                          ↵
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>Chercher</span>
          </button>
        </form>

        {/* Smart Typo Suggestion Pill (Did you mean?) */}
        {typoSuggestion && normalizeText(typoSuggestion.suggestion) !== normalizeText(searchInput) && (
          <div className="flex items-center justify-between gap-2 text-xs bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-500/40 px-3 py-1.5 rounded-xl shadow-md">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-gray-300 shrink-0">Vouliez-vous dire :</span>
              <button
                type="button"
                onClick={() => handleApplySuggestion(typoSuggestion.suggestion)}
                className="font-bold text-white underline hover:text-purple-300 transition-colors truncate cursor-pointer"
                title="Appliquer cette correction"
              >
                {typoSuggestion.suggestion}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleApplySuggestion(typoSuggestion.suggestion)}
              className="text-[11px] font-bold text-purple-200 hover:text-white px-2 py-0.5 rounded-md bg-purple-600/50 hover:bg-purple-600/80 shrink-0 cursor-pointer transition-all"
            >
              Corriger
            </button>
          </div>
        )}

        {/* Channel Indicator & Sub-Filters Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={onOpenChannelModal}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              isMulti
                ? 'bg-gradient-to-r from-purple-900/60 to-indigo-900/60 text-purple-200 border-purple-500/40 shadow-sm'
                : 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30'
            }`}
            title="Changer de source / mode de recherche"
          >
            {isMulti ? (
              <>
                <Layers className="w-3 h-3 text-purple-300" />
                <span>Multi-Sources</span>
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 text-amber-300" />
                <span>Source Unique</span>
              </>
            )}
          </button>

          {subFilters.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSelectedSubFilter(sub.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                selectedSubFilter === sub.id
                  ? 'bg-gradient-to-r from-red-600 to-purple-600 text-white shadow-sm'
                  : 'bg-[#181822] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              <span>{sub.label}</span>
            </button>
          ))}

          <button
            onClick={handleRefresh}
            disabled={isPullRefreshing || isLoading}
            className="ml-auto p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Rafraîchir"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isPullRefreshing || isLoading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Jikan Trending Carousel (Only in Anime Hub when search is empty) */}
      {activeCategory === 'anime' && !searchInput.trim() && trendingAnimes.length > 0 && (
        <div className="px-4 pt-1 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-200">
              <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500" />
              <span>Tendances Animés (Jikan API)</span>
            </div>
            <span className="text-[10px] text-purple-400 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>En cours de diffusion</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1 pt-0.5">
            {trendingAnimes.map((anime) => {
              const cover =
                anime.images.webp?.large_image_url ||
                anime.images.jpg.large_image_url ||
                anime.images.jpg.image_url;

              return (
                <div
                  key={anime.mal_id}
                  onClick={() => handleSelectTrending(anime)}
                  className="group relative w-24 sm:w-28 shrink-0 cursor-pointer rounded-xl overflow-hidden bg-[#181822] border border-white/5 hover:border-purple-500/50 transition-all hover:scale-102 shadow-md"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-black">
                    <img
                      src={cover}
                      alt={anime.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                    {/* Score badge */}
                    {anime.score && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/80 text-amber-300 border border-amber-500/30 backdrop-blur-sm flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        {anime.score.toFixed(1)}
                      </span>
                    )}

                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                      <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
                        {anime.title}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Jikan Spotlight Banner (When an anime is matched) */}
      {matchedAnimeMAL && (
        <div className="px-4 pb-3">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#1E1528] via-[#171722] to-[#14141E] border border-purple-500/30 p-3 sm:p-4 shadow-xl">
            {/* Background Glow Poster */}
            <div className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden pointer-events-none opacity-20 blur-sm">
              <img
                src={
                  matchedAnimeMAL.images.webp?.large_image_url ||
                  matchedAnimeMAL.images.jpg.large_image_url ||
                  matchedAnimeMAL.images.jpg.image_url
                }
                alt=""
                className="w-full h-full object-cover object-right"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative flex items-start gap-3.5">
              {/* Poster Art */}
              <div
                onClick={() => {
                  setSelectedAnimeForModal(matchedAnimeMAL);
                  setIsDetailModalOpen(true);
                }}
                className="relative w-18 sm:w-20 aspect-[3/4] rounded-xl overflow-hidden shrink-0 border border-purple-500/40 shadow-md cursor-pointer group"
              >
                <img
                  src={
                    matchedAnimeMAL.images.webp?.large_image_url ||
                    matchedAnimeMAL.images.jpg.large_image_url ||
                    matchedAnimeMAL.images.jpg.image_url
                  }
                  alt={matchedAnimeMAL.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors flex items-center justify-center">
                  <Info className="w-5 h-5 text-white opacity-80 group-hover:opacity-100" />
                </div>
              </div>

              {/* Anime Metadata from MAL */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>MyAnimeList Match</span>
                </div>

                <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight truncate">
                  {matchedAnimeMAL.title}
                </h3>

                {matchedAnimeMAL.synopsis && (
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                    {matchedAnimeMAL.synopsis}
                  </p>
                )}

                <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                  {matchedAnimeMAL.score && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{matchedAnimeMAL.score.toFixed(1)}/10</span>
                    </span>
                  )}

                  {matchedAnimeMAL.status && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/10 text-gray-300">
                      {matchedAnimeMAL.status}
                    </span>
                  )}

                  {matchedAnimeMAL.episodes && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {matchedAnimeMAL.episodes} eps
                    </span>
                  )}

                  <button
                    onClick={() => {
                      setSelectedAnimeForModal(matchedAnimeMAL);
                      setIsDetailModalOpen(true);
                    }}
                    className="ml-auto text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 transition-all cursor-pointer"
                  >
                    <Info className="w-3 h-3" />
                    <span>Fiche & Trailer</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Content List / Loading / Error states */}
      <div className="px-4 mt-2">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-purple-300 px-1 animate-pulse">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isMulti
                    ? 'Recherche étendue en cours...'
                    : 'Chargement direct des contenus...'}
                </span>
              </span>
            </div>
            <ShimmerSkeleton count={5} />
          </div>
        ) : filteredEpisodes.length > 0 ? (
          <div className="space-y-3 pt-1">
            {/* Fuzzy Fallback Notice if exact server query had 0 results */}
            {isUsingFuzzyFallback && (
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border border-purple-500/30 rounded-xl text-xs text-purple-200 shadow-md">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Tolérance aux fautes : aucun résultat direct, mais <strong>{filteredEpisodes.length}</strong> fichier(s) correspondant(s) trouvé(s) pour « <em>{searchInput}</em> ».
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <span>
                {searchInput.trim() ? `Résultats pour "${searchInput}"` : 'Contenus disponibles'}
              </span>
              <span className="font-mono text-[11px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                {filteredEpisodes.length} élément(s) {isMulti && `• ${selectedChannels.length} sources`}
              </span>
            </div>

            <div className="space-y-3">
              {filteredEpisodes.map((episode) => {
                const downloadTask = activeDownloads[episode.message_id];
                const isDownloaded = savedDownloads.some((d) => d.episode.message_id === episode.message_id);
                const poster = matchedAnimeMAL
                  ? matchedAnimeMAL.images.webp?.large_image_url || matchedAnimeMAL.images.jpg.large_image_url
                  : undefined;

                return (
                  <EpisodeCard
                    key={`${episode.channel || ''}_${episode.message_id}_${episode.file_name}`}
                    episode={episode}
                    posterUrl={poster}
                    onPlay={onPlayEpisode}
                    onDownload={onDownloadEpisode}
                    onOpenInfo={handleOpenEpisodeInfo}
                    downloadTask={downloadTask}
                    isDownloaded={isDownloaded}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          /* Clean, Soft Empty State (Without artificial pills or fake mock data) */
          <div className="py-14 px-4 text-center max-w-md mx-auto space-y-4">
            <div className="w-13 h-13 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-purple-300 shadow-sm">
              <Film className="w-6 h-6 text-purple-400" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-gray-200">
                {searchInput.trim()
                  ? `Aucun résultat pour « ${searchInput} »`
                  : errorMessage
                  ? 'Catalogue en cours de synchronisation'
                  : 'Aucun contenu disponible'}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {searchInput.trim()
                  ? 'Aucun fichier ne correspond à ce terme. Essayez un autre mot-clé ou modifiez vos filtres.'
                  : errorMessage
                  ? 'Le serveur distant met un peu de temps à répondre. Vous pouvez réactualiser le catalogue.'
                  : 'Aucun contenu n\'est disponible pour le moment. Vous pouvez actualiser la liste.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  setIsPullRefreshing(true);
                  try {
                    await onRefresh();
                  } finally {
                    setIsPullRefreshing(false);
                  }
                }}
                disabled={isPullRefreshing}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isPullRefreshing ? 'animate-spin' : ''}`} />
                <span>{isPullRefreshing ? 'Actualisation...' : 'Actualiser'}</span>
              </button>

              {searchInput.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    onSearch('');
                  }}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 active:scale-95 text-gray-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Effacer</span>
                </button>
              )}

              {onRequestContent && (
                <button
                  type="button"
                  onClick={() => onRequestContent(searchInput.trim())}
                  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>
                    {searchInput.trim()
                      ? `Demander "${searchInput.trim()}"`
                      : 'Faire un souhait / demande'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Jikan Anime Full Details Modal (Metadata, Synopsis, Characters) */}
      <AnimeDetailsModal
        anime={selectedAnimeForModal}
        episode={selectedEpisodeForModal}
        isOpen={isDetailModalOpen}
        isLoading={isLoadingModalData}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedEpisodeForModal(null);
        }}
        onPlayEpisode={onPlayEpisode}
        onDownloadEpisode={onDownloadEpisode}
        onSearchInChannels={(title) => {
          setSearchInput(title);
          lastSearchedQuery.current = title;
          onSearchRef.current(title);
        }}
      />

      {/* 6. Floating 'Scroll to Top' Button (Remonter tout en haut) */}
      {showScrollTop && (
        <button
          onClick={handleScrollToTop}
          className="fixed bottom-20 right-4 sm:right-6 z-30 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-xl shadow-purple-950/70 border border-purple-400/40 hover:brightness-110 active:scale-95 transition-all duration-300 cursor-pointer animate-fade-in"
          title="Remonter tout en haut"
          aria-label="Remonter tout en haut"
        >
          <ArrowUp className="w-4 h-4" />
          <span className="hidden xs:inline">Remonter</span>
        </button>
      )}
    </div>
  );
};
