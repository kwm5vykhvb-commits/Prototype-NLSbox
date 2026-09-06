import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  Film,
  Tv,
  Calendar,
  Layers,
  Award,
  Users,
  Play,
  Download,
  Search,
  ExternalLink,
  Sparkles,
  Clapperboard,
  BookOpen,
  Info,
  ChevronRight,
  ShieldCheck,
  FolderDown,
} from 'lucide-react';
import { JikanAnimeData, JikanCharacterData, Episode } from '../types';
import { JikanService } from '../services/jikan';
import { triggerDeviceDownload } from '../utils/download';

interface AnimeDetailsModalProps {
  anime: JikanAnimeData | null;
  episode?: Episode | null;
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onPlayEpisode?: (episode: Episode) => void;
  onDownloadEpisode?: (episode: Episode) => void;
  onSearchInChannels?: (animeTitle: string) => void;
}

export const AnimeDetailsModal: React.FC<AnimeDetailsModalProps> = ({
  anime,
  episode,
  isOpen,
  isLoading = false,
  onClose,
  onPlayEpisode,
  onDownloadEpisode,
  onSearchInChannels,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'trailer'>('overview');
  const [characters, setCharacters] = useState<JikanCharacterData[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [charactersError, setCharactersError] = useState<string | null>(null);

  // Fetch characters when anime changes or modal opens
  useEffect(() => {
    if (!isOpen || !anime?.mal_id) {
      setCharacters([]);
      return;
    }

    let isMounted = true;
    setLoadingCharacters(true);
    setCharactersError(null);

    JikanService.getAnimeCharacters(anime.mal_id)
      .then((data) => {
        if (isMounted) {
          setCharacters(data);
          setLoadingCharacters(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setCharactersError('Impossible de charger la liste des personnages');
          setLoadingCharacters(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, anime?.mal_id]);

  // Reset active tab on close
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const poster =
    anime?.images.webp?.large_image_url ||
    anime?.images.jpg.large_image_url ||
    anime?.images.jpg.image_url;

  const mainTitle = anime?.title_english || anime?.title || (episode ? JikanService.extractAnimeTitle(episode.title || episode.file_name) : 'Détails de l\'animé');
  const originalTitle = anime?.title_japanese || anime?.title;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Modal Card */}
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#121218] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10 text-gray-100">
        
        {/* Top Header Background Banner */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden shrink-0 bg-gradient-to-b from-purple-900/30 to-[#121218]">
          {poster && (
            <img
              src={poster}
              alt=""
              className="w-full h-full object-cover opacity-25 blur-md scale-110"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121218] via-[#121218]/70 to-transparent" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white transition-all cursor-pointer z-20 border border-white/10 shadow-lg"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Hero Content inside Banner */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end gap-4 z-10">
            {/* Poster thumbnail */}
            <div className="relative w-24 sm:w-28 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-2xl shrink-0 bg-black">
              {poster ? (
                <img
                  src={poster}
                  alt={mainTitle}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-purple-400">
                  <Film className="w-8 h-8" />
                </div>
              )}
            </div>

            {/* Anime Title & Key Quick Stats */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>MyAnimeList / Jikan API</span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-white leading-tight truncate">
                {mainTitle}
              </h2>
              {originalTitle && originalTitle !== mainTitle && (
                <p className="text-xs text-gray-400 truncate font-mono">
                  {originalTitle}
                </p>
              )}

              {/* Quick meta pills */}
              <div className="flex items-center flex-wrap gap-1.5 mt-2">
                {anime?.score ? (
                  <span className="flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{anime.score.toFixed(2)}/10</span>
                  </span>
                ) : null}

                {anime?.status && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-white/10 text-gray-300">
                    {anime.status}
                  </span>
                )}

                {anime?.episodes && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {anime.episodes} épisodes
                  </span>
                )}

                {anime?.studios && anime.studios.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {anime.studios[0].name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action bar for current Episode if clicked from an episode */}
        {episode && (
          <div className="bg-[#181824] px-4 py-2.5 border-y border-white/5 flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">
                Épisode sélectionné
              </p>
              <p className="text-xs font-semibold text-white truncate">
                {episode.title || episode.file_name}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onPlayEpisode && (
                <button
                  onClick={() => {
                    onPlayEpisode(episode);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-red-600/30 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Regarder</span>
                </button>
              )}
              {onDownloadEpisode && (
                <button
                  onClick={() => {
                    onDownloadEpisode(episode);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 hover:text-white transition-all cursor-pointer border border-purple-500/40 flex items-center gap-1.5 text-xs font-bold shadow-sm active:scale-95"
                  title="Télécharger directement dans la mémoire de l'appareil (rapide et sans limite)"
                >
                  <Download className="w-3.5 h-3.5 text-purple-300" />
                  <span>Télécharger</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex items-center px-4 pt-2 border-b border-white/5 gap-2 bg-[#14141E] shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Synopsis & Infos</span>
          </button>

          <button
            onClick={() => setActiveTab('characters')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'characters'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Personnages & Seiyuu</span>
            {characters.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/30 text-purple-200 ml-0.5">
                {characters.length}
              </span>
            )}
          </button>

          {anime?.trailer?.embed_url && (
            <button
              onClick={() => setActiveTab('trailer')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'trailer'
                  ? 'border-purple-500 text-purple-300'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span>Trailer Officiel</span>
            </button>
          )}
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-purple-300 animate-pulse font-medium">
                Récupération des métadonnées Jikan API...
              </p>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-4">
              {/* Detailed Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#181822] p-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-semibold">
                    <Award className="w-3 h-3 text-amber-400" />
                    <span>Score / Rang</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-1">
                    {anime?.score ? `⭐ ${anime.score.toFixed(1)}/10` : 'N/A'}{' '}
                    {anime?.rank ? <span className="text-[10px] text-gray-400"> (Rang #{anime.rank})</span> : ''}
                  </p>
                </div>

                <div className="bg-[#181822] p-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-semibold">
                    <Tv className="w-3 h-3 text-purple-400" />
                    <span>Format & Épisodes</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-1">
                    {anime?.episodes ? `${anime.episodes} épisodes` : 'En cours'}{' '}
                    {anime?.duration ? <span className="text-[10px] text-gray-400">({anime.duration})</span> : ''}
                  </p>
                </div>

                <div className="bg-[#181822] p-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-semibold">
                    <Calendar className="w-3 h-3 text-emerald-400" />
                    <span>Saison / Diffusion</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-1">
                    {anime?.season && anime?.year ? `${anime.season} ${anime.year}` : anime?.aired?.string || 'N/A'}
                  </p>
                </div>

                <div className="bg-[#181822] p-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-semibold">
                    <Clapperboard className="w-3 h-3 text-indigo-400" />
                    <span>Studio</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-1 truncate">
                    {anime?.studios?.map((s) => s.name).join(', ') || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Genres Chips */}
              {anime?.genres && anime.genres.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase font-bold mr-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-purple-400" />
                    Genres :
                  </span>
                  {anime.genres.map((g) => (
                    <span
                      key={g.mal_id}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-950/40 text-purple-200 border border-purple-500/30"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Synopsis Box */}
              <div className="bg-[#181822] p-4 rounded-2xl border border-white/5 space-y-2">
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Synopsis officiel</span>
                </h4>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {anime?.synopsis || 'Aucun synopsis disponible pour cet animé.'}
                </p>
              </div>

              {/* Channels Direct Search CTA */}
              {onSearchInChannels && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/30 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-purple-400" />
                      <span>Explorer tous les épisodes</span>
                    </h5>
                    <p className="text-[11px] text-gray-300 truncate">
                      Rechercher "{mainTitle}" dans l'ensemble du catalogue
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onSearchInChannels(mainTitle);
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <span>Rechercher</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === 'characters' ? (
            /* Characters & Voice Actors Tab */
            <div className="space-y-3">
              {loadingCharacters ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-purple-300 animate-pulse font-medium">
                    Chargement des personnages depuis Jikan API...
                  </p>
                </div>
              ) : charactersError ? (
                <div className="py-8 text-center text-xs text-red-300">
                  {charactersError}
                </div>
              ) : characters.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {characters.slice(0, 16).map((item) => {
                    const charImg =
                      item.character.images?.webp?.image_url ||
                      item.character.images?.jpg?.image_url;
                    const va = item.voice_actors && item.voice_actors.length > 0 ? item.voice_actors[0] : null;
                    const vaImg = va?.person?.images?.jpg?.image_url;

                    return (
                      <div
                        key={item.character.mal_id}
                        className="bg-[#181822] p-2.5 rounded-xl border border-white/5 flex items-center justify-between gap-2.5 hover:border-purple-500/30 transition-all"
                      >
                        {/* Character Details */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                            {charImg ? (
                              <img
                                src={charImg}
                                alt={item.character.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500">
                                <Users className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {item.character.name}
                            </p>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                item.role === 'Main'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-white/5 text-gray-400'
                              }`}
                            >
                              {item.role === 'Main' ? 'Principal' : 'Secondaire'}
                            </span>
                          </div>
                        </div>

                        {/* Voice Actor Details */}
                        {va && (
                          <div className="flex items-center gap-2 text-right shrink-0 pl-1">
                            <div className="min-w-0 text-right">
                              <p className="text-[11px] font-medium text-gray-300 truncate max-w-[90px]">
                                {va.person.name}
                              </p>
                              <span className="text-[9px] text-gray-500 font-mono">
                                {va.language}
                              </span>
                            </div>
                            <div className="w-9 h-11 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                              {vaImg ? (
                                <img
                                  src={vaImg}
                                  alt={va.person.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                />
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-gray-400">
                  Aucun personnage trouvé pour cet animé.
                </div>
              )}
            </div>
          ) : (
            /* Trailer Video Tab */
            <div className="space-y-3">
              {anime?.trailer?.embed_url ? (
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
                  <iframe
                    src={anime.trailer.embed_url}
                    title={`${mainTitle} Official Trailer`}
                    className="w-full h-full"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-gray-400">
                  Aucun trailer officiel disponible.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with External MAL Link */}
        <div className="px-5 py-3 bg-[#0F0F14] border-t border-white/5 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-purple-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Données officielles MyAnimeList v4</span>
          </div>

          {anime?.mal_id && (
            <a
              href={`https://myanimelist.net/anime/${anime.mal_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-purple-300 hover:text-white font-semibold transition-colors"
            >
              <span>Voir sur MyAnimeList</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
