import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Layers,
  Zap,
} from 'lucide-react';
import { ChannelInfo, HubCategory } from '../types';

interface ChannelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchMode: 'single' | 'multi';
  onToggleSearchMode?: (mode: 'single' | 'multi') => void;
  // Kept optional for backward compatibility with existing callers
  channels?: ChannelInfo[];
  activeCategory?: HubCategory;
  activeChannel?: string;
  selectedChannels?: string[];
  primaryChannelId?: string;
  onSelectCategory?: (category: HubCategory) => void;
  onSelectSingleChannel?: (channelId: string) => void;
  onUpdateMultiChannels?: (selectedChannels: string[], mode: 'single' | 'multi') => void;
}

export const ChannelSelectorModal: React.FC<ChannelSelectorModalProps> = ({
  isOpen,
  onClose,
  searchMode,
  onToggleSearchMode,
  onUpdateMultiChannels,
}) => {
  const [selectedMode, setSelectedMode] = useState<'single' | 'multi'>(searchMode || 'multi');

  useEffect(() => {
    setSelectedMode(searchMode || 'multi');
  }, [isOpen, searchMode]);

  if (!isOpen) return null;

  const handleModeChange = (newMode: 'single' | 'multi') => {
    setSelectedMode(newMode);
  };

  const handleApply = () => {
    if (onToggleSearchMode) {
      onToggleSearchMode(selectedMode);
    } else if (onUpdateMultiChannels) {
      onUpdateMultiChannels([], selectedMode);
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#16161C] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl p-5 space-y-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Mode de Recherche</h3>
              <p className="text-[11px] text-gray-400">Configurez l'étendue et la vitesse de vos résultats</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selection Cards: Multi-Sources vs Source Unique */}
        <div className="space-y-2.5 pt-1">
          <div className="text-[11px] text-gray-400 font-semibold uppercase px-1 tracking-wider">
            Sélectionnez votre mode de recherche
          </div>

          <div className="space-y-2.5">
            {/* Multi-Sources Card */}
            <div
              onClick={() => handleModeChange('multi')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col gap-2 ${
                selectedMode === 'multi'
                  ? 'bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-purple-950/40 border-purple-500/70 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/30'
                  : 'bg-[#1C1C24] border-white/5 hover:border-purple-500/30 hover:bg-[#20202A]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    selectedMode === 'multi' ? 'bg-purple-600 text-white shadow-md' : 'bg-white/5 text-gray-400'
                  }`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white block">Multi-Sources</span>
                      <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                        Par défaut
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedMode === 'multi' ? 'border-purple-400 bg-purple-600' : 'border-gray-500 bg-transparent'
                }`}>
                  {selectedMode === 'multi' && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed pl-0.5">
                Recherche simultanée dans l'ensemble des sources pour un maximum de résultats et de contenus disponibles.
              </p>
            </div>

            {/* Single Source Card */}
            <div
              onClick={() => handleModeChange('single')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col gap-2 ${
                selectedMode === 'single'
                  ? 'bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-purple-950/40 border-purple-500/70 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/30'
                  : 'bg-[#1C1C24] border-white/5 hover:border-purple-500/30 hover:bg-[#20202A]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    selectedMode === 'single' ? 'bg-purple-600 text-white shadow-md' : 'bg-white/5 text-gray-400'
                  }`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white block">Source Unique</span>
                      <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                        Ultra rapide
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedMode === 'single' ? 'border-purple-400 bg-purple-600' : 'border-gray-500 bg-transparent'
                }`}>
                  {selectedMode === 'single' && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed pl-0.5">
                Recherche directe sur la source principale optimisée pour un affichage instantané à vitesse maximale.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2">
          <button
            onClick={handleApply}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Valider le mode {selectedMode === 'multi' ? 'Multi-Sources' : 'Source Unique'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
