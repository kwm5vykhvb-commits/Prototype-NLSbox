import React, { useState } from 'react';
import {
  MessageSquarePlus,
  AlertOctagon,
  Sparkles,
  X,
  Send,
  CheckCircle2,
  Film,
  Clapperboard,
  Gamepad2,
  Music,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { FeedbackService } from '../services/feedbackService';
import { ActivityService } from '../services/activityService';
import { HubCategory } from '../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'request' | 'report';
  initialQuery?: string;
  activeCategory?: HubCategory;
  userEmail?: string | null;
  userId?: string | null;
  channelId?: string | null;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'request',
  initialQuery = '',
  activeCategory = 'anime',
  userEmail = '',
  userId = '',
  channelId = '',
}) => {
  const [type, setType] = useState<'request' | 'report'>(defaultType);
  const [title, setTitle] = useState(initialQuery);
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HubCategory | 'general'>(activeCategory);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Veuillez préciser le titre du contenu ou la description du problème.');
      return;
    }

    setLoading(true);
    setError(null);

    const feedbackPayload: {
      type: 'report' | 'request';
      title: string;
      description: string;
      category: HubCategory | 'general';
      channelId?: string;
      userEmail?: string;
      userId?: string;
    } = {
      type,
      title: title.trim(),
      description: description.trim(),
      category: selectedCategory,
    };

    if (channelId) feedbackPayload.channelId = channelId;
    if (userEmail) feedbackPayload.userEmail = userEmail;
    if (userId) feedbackPayload.userId = userId;

    const result = await FeedbackService.submitFeedback(feedbackPayload);

    setLoading(false);

    if (result) {
      setIsSuccess(true);
      if (userId) {
        ActivityService.logActivity({
          userId,
          userEmail: userEmail || undefined,
          type: 'feedback',
          description: type === 'request' ? `Demande de média : « ${title.trim()} »` : `Signalement : « ${title.trim()} »`,
          details: {
            type,
            category: selectedCategory,
          },
        }).catch(() => {});
      }
      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setDescription('');
        onClose();
      }, 2000);
    } else {
      setError('Impossible d\'envoyer votre demande pour le moment. Veuillez réessayer.');
    }
  };

  const categories: Array<{ id: HubCategory | 'general'; label: string; icon: any }> = [
    { id: 'anime', label: 'Animés', icon: Film },
    { id: 'movie_series', label: 'Films & Séries', icon: Clapperboard },
    { id: 'music', label: 'Musique', icon: Music },
    { id: 'games', label: 'Jeux', icon: Gamepad2 },
    { id: 'document', label: 'Mangas/Docs', icon: FileText },
    { id: 'mature', label: 'Espace +18', icon: ShieldAlert },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#161622] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between bg-[#12121c]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                type === 'request'
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}
            >
              {type === 'request' ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <AlertOctagon className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {type === 'request' ? 'Boîte à souhaits & Demandes' : 'Signaler un problème'}
              </h3>
              <p className="text-[11px] text-gray-400">
                {type === 'request'
                  ? 'Vous ne trouvez pas ce que vous cherchez ? Demandez-le !'
                  : 'Lien mort, problème de lecture ou vidéo inaccessible'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="py-12 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center mb-3 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white mb-1">
              {type === 'request' ? 'Demande bien enregistrée !' : 'Signalement envoyé !'}
            </h4>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {type === 'request'
                ? 'Notre équipe ajoutera ce contenu sur les flux dès que possible.'
                : 'Merci pour votre aide. L\'équipe technique va vérifier et corriger le lien.'}
            </p>
          </div>
        ) : (
          <div className="p-5">
            {/* Mode Switcher */}
            <div className="flex bg-[#101018] p-1 rounded-xl border border-white/5 mb-4">
              <button
                type="button"
                onClick={() => setType('request')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  type === 'request'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Demander un contenu</span>
              </button>
              <button
                type="button"
                onClick={() => setType('report')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  type === 'report'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Signaler un problème</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category Picker */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Catégorie concernée
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {categories.map((c) => {
                    const CatIcon = c.icon;
                    const isSelected = selectedCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCategory(c.id)}
                        className={`p-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                            : 'bg-[#101018] border-white/5 text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        <CatIcon className="w-3.5 h-3.5" />
                        <span className="truncate">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title input */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                  {type === 'request'
                    ? 'Nom du Film / Animé / Série souhaité'
                    : 'Nom du média ou de la vidéo concernée'}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === 'request'
                      ? 'Ex: Solo Leveling Saison 2, Avatar 3...'
                      : 'Ex: Épisode 4 ne se lance pas...'
                  }
                  className="w-full bg-[#101018] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                  Détails supplémentaires (facultatif)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    type === 'request'
                      ? 'Précisez si possible la saison, la langue souhaitée (VF/VOSTFR)...'
                      : 'Expliquez ce qui ne fonctionne pas (coupure, vidéo manquante, etc.)'
                  }
                  className="w-full bg-[#101018] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                  {userEmail ? `Envoyé par : ${userEmail}` : 'Envoi anonyme sécurisé'}
                </span>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{type === 'request' ? 'Envoyer la demande' : 'Envoyer le signalement'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
