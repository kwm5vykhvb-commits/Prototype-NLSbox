import React, { useState, useEffect } from 'react';
import { KeyRound, Shield, Check, X, Eye, EyeOff, Lock, Unlock, AlertCircle } from 'lucide-react';

interface DiscreetUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  isUnlocked: boolean;
  isKillSwitchActive: boolean; // if true, the module is globally suspended by cloud config
  correctPin: string;
  onUnlock: () => void;
  onLock: () => void;
}

export const DiscreetUnlockModal: React.FC<DiscreetUnlockModalProps> = ({
  isOpen,
  onClose,
  isUnlocked,
  isKillSwitchActive,
  correctPin,
  onUnlock,
  onLock,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setError(false);
      setSuccess(false);
      setShowPin(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isKillSwitchActive) return;

    if (pinInput.trim() === correctPin.trim()) {
      setSuccess(true);
      setError(false);
      setTimeout(() => {
        onUnlock();
        onClose();
      }, 700);
    } else {
      setError(true);
      setPinInput('');
      setTimeout(() => setError(false), 2500);
    }
  };

  const handleLockAgain = () => {
    onLock();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm bg-[#16161C] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl relative overflow-hidden text-center">
        {/* Top subtle glow line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-red-600" />

        {/* Icon Header */}
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-purple-400 shadow-inner">
          {isUnlocked ? <Unlock className="w-6 h-6 text-emerald-400" /> : <Shield className="w-6 h-6" />}
        </div>

        <div>
          <h3 className="text-base font-bold text-white tracking-tight">
            {isUnlocked ? 'Gestion du Protocole Privé' : 'Authentification Sécurisée'}
          </h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {isKillSwitchActive
              ? "Ce module est temporairement indisponible."
              : isUnlocked
              ? "Le module étendu est actuellement actif et visible dans vos catégories."
              : 'Veuillez saisir le code d’accès pour afficher ce module.'}
          </p>
        </div>

        {isKillSwitchActive ? (
          <div className="space-y-4 pt-1">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-xs text-gray-400 flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Accès suspendu (Mode maintenance)</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        ) : isUnlocked ? (
          <div className="space-y-2.5 pt-1">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center justify-center gap-1.5 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Module visible dans vos catégories</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleLockAgain}
                className="py-2.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Masquer & Verrouiller</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Garder Actif</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                autoFocus
                maxLength={12}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setError(false);
                }}
                placeholder="Code secret"
                className={`w-full bg-[#111116] text-center text-sm font-mono tracking-widest text-white rounded-2xl px-4 py-3 border transition-all focus:outline-none ${
                  error
                    ? 'border-red-500 ring-2 ring-red-500/20'
                    : success
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-white/10 focus:border-purple-500'
                }`}
              />

              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {error && (
              <p className="text-[11px] text-red-400 font-semibold animate-shake">
                Code secret erroné. Veuillez réessayer.
              </p>
            )}

            {success && (
              <p className="text-[11px] text-emerald-400 font-semibold animate-fade-in flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Code validé, déverrouillage...
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-semibold transition-all border border-white/5 cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={!pinInput.trim() || success}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Déverrouiller</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
