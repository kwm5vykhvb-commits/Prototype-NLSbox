import React from 'react';
import {
  RotateCcw,
  Database,
  Trash2,
  Sliders,
  Smartphone,
  PlaySquare,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { AppSettings } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetDefaults: () => void;
  onClearStorage: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onResetDefaults,
  onClearStorage,
}) => {
  return (
    <div className="pb-28 pt-2 px-4 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="py-2 border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Paramètres & Préférences
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Personnalisez votre expérience de streaming et gérez votre espace local
          </p>
        </div>
      </div>

      {/* 1. Application Mobile & PWA */}
      <div className="bg-[#1A1A22] rounded-3xl p-4 sm:p-5 border border-white/8 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-purple-400" />
            Application Mobile & Écran d'accueil (PWA)
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed max-w-lg">
            Installez NLSbox sur votre appareil pour profiter d'une navigation plein écran rapide, fluide et sans barre d'adresse.
          </p>
        </div>
        <div className="shrink-0">
          <PWAInstallButton showLabel />
        </div>
      </div>

      {/* 2. Préférences de Lecture */}
      <div className="bg-[#1A1A22] rounded-3xl p-4 sm:p-5 border border-white/8 shadow-lg space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <PlaySquare className="w-4 h-4 text-indigo-400" />
          Préférences de Lecture
        </h2>

        {/* Qualité préférée */}
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <div className="text-xs font-semibold text-white">Qualité vidéo par défaut</div>
            <div className="text-[11px] text-gray-400">Sélection automatique de la meilleure résolution disponible</div>
          </div>
          <div className="flex gap-1.5">
            {(['auto', '1080p', '720p', '480p'] as const).map((q) => (
              <button
                key={q}
                onClick={() => onUpdateSettings({ ...settings, preferredQuality: q })}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  (settings.preferredQuality || 'auto') === q
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {q.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Vitesse de lecture */}
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <div className="text-xs font-semibold text-white">Vitesse de lecture</div>
            <div className="text-[11px] text-gray-400">Vitesse par défaut au démarrage du lecteur</div>
          </div>
          <div className="flex gap-1.5">
            {([1.0, 1.25, 1.5] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => onUpdateSettings({ ...settings, defaultVideoSpeed: spd })}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  (settings.defaultVideoSpeed || 1.0) === spd
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* AutoPlay Next */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-xs font-semibold text-white">Enchaîner l'épisode suivant</div>
            <div className="text-[11px] text-gray-400">Lancer automatiquement l'épisode consécutif à la fin de la vidéo</div>
          </div>
          <button
            onClick={() => onUpdateSettings({ ...settings, autoPlayNext: !settings.autoPlayNext })}
            className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
              settings.autoPlayNext ? 'bg-indigo-600 justify-end' : 'bg-white/10 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </div>

      {/* 3. Données & Cache Local */}
      <div className="bg-[#1A1A22] rounded-3xl p-4 sm:p-5 border border-white/8 shadow-lg">
        <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-400" />
          Données & Cache Local
        </h2>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          Gérez les données temporaires, les préférences locales et les fichiers médias enregistrés dans votre navigateur.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              if (confirm('Vider le cache de l\'application et rétablir les réglages par défaut ?')) {
                onResetDefaults();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
            Réinitialiser les préférences
          </button>

          <button
            onClick={() => {
              if (confirm('Supprimer tous les téléchargements enregistrés ?')) {
                onClearStorage();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Effacer les téléchargements locaux
          </button>
        </div>
      </div>

      {/* 4. Sécurité & Version */}
      <div className="bg-[#14141B] rounded-2xl p-4 border border-white/5 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>NLSbox • Version 2.4.0 Production</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-400/80 font-medium">
          <Check className="w-3.5 h-3.5" />
          <span>Sécurisé & Synchronisé</span>
        </div>
      </div>
    </div>
  );
};

