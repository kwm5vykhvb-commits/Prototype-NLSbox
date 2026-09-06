import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Check, X, Lock } from 'lucide-react';

interface MatureWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const MatureWarningModal: React.FC<MatureWarningModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const [rememberChoice, setRememberChoice] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-[#16161C] border border-red-500/40 rounded-3xl p-6 space-y-5 shadow-2xl relative overflow-hidden text-center">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600" />

        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-3xl bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-600/20 animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
            Avertissement +18
          </span>
          <h3 className="text-lg font-black text-white mt-2">
            Espace Réservé à un Public Averti
          </h3>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
            Cet espace regroupe les œuvres (films, séries, mangas, animés non censurés) contenant des <strong className="text-red-300">scènes explicites, violentes ou destinées exclusivement aux adultes (18 ans et plus)</strong>.
          </p>
        </div>

        <div className="p-3.5 bg-red-950/30 border border-red-500/20 rounded-2xl text-left flex items-start gap-3 text-xs text-red-200">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-snug">
            En accédant à cet espace, vous certifiez sur l'honneur avoir l'âge légal de la majorité (18 ans révolus) selon la législation de votre pays.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <input
            type="checkbox"
            id="rememberMature"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="rounded border-white/20 bg-[#1C1C24] text-red-600 focus:ring-0 cursor-pointer w-4 h-4"
          />
          <label htmlFor="rememberMature" className="text-xs text-gray-400 cursor-pointer">
            Ne plus me redemander pour cette session
          </label>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all border border-white/5 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Quitter</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (rememberChoice) {
                sessionStorage.setItem('nlsbox_mature_agreed', 'true');
              }
              onConfirm();
            }}
            className="py-3 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/30 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>J'ai 18 ans et +</span>
          </button>
        </div>
      </div>
    </div>
  );
};
