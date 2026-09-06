import React, { useRef, useState } from 'react';
import {
  Tv,
  Layers,
  Zap,
  Film,
  Clapperboard,
  Gamepad2,
  Image as ImageIcon,
  Music,
  FileText,
  ShieldAlert,
  Bell,
  MessageSquarePlus,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { HubCategory } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeCategory: HubCategory;
  searchMode: 'single' | 'multi';
  onToggleSearchMode: (mode: 'single' | 'multi') => void;
  isOnline?: boolean;
  onTriggerSecretUnlock?: () => void;
  isSecretUnlockDisabled?: boolean;
  unreadNotifCount?: number;
  onOpenNotifications?: () => void;
  onOpenFeedback?: () => void;
  userEmail?: string | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeCategory,
  searchMode,
  onToggleSearchMode,
  onTriggerSecretUnlock,
  isSecretUnlockDisabled = false,
  unreadNotifCount = 0,
  onOpenNotifications,
  onOpenFeedback,
  userEmail,
  onLogout,
}) => {
  const isMulti = searchMode === 'multi';

  // Secret 5-tap detection on the logo
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const [tapPulse, setTapPulse] = useState(false);

  const handleLogoTap = () => {
    // If camouflage or kill-switch is active, completely ignore secret taps!
    if (isSecretUnlockDisabled) {
      return;
    }

    const now = Date.now();
    if (now - lastTapTimeRef.current > 2200) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    lastTapTimeRef.current = now;

    // Subtle micro-feedback on tap 4 and 5
    if (tapCountRef.current >= 4) {
      setTapPulse(true);
      setTimeout(() => setTapPulse(false), 300);
    }

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      onTriggerSecretUnlock?.();
    }
  };

  const getCategoryInfo = (cat: HubCategory) => {
    switch (cat) {
      case 'anime':
        return { label: 'Animés', icon: Film, color: 'text-red-400 bg-red-500/10 border-red-500/30' };
      case 'movie_series':
        return { label: 'Films & Séries', icon: Clapperboard, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
      case 'games':
        return { label: 'Jeux & Fun', icon: Gamepad2, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      case 'wallpapers':
        return { label: 'Wallpapers 4K', icon: ImageIcon, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
      case 'music':
        return { label: 'Musique', icon: Music, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' };
      case 'document':
        return { label: 'Mangas / PDF', icon: FileText, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'mature':
        return { label: 'Espace +18', icon: ShieldAlert, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    }
  };

  const catInfo = getCategoryInfo(activeCategory);
  const CatIcon = catInfo.icon;

  return (
    <header className="sticky top-0 z-30 bg-[#121216]/95 backdrop-blur-md border-b border-white/5 px-3 py-2 sm:px-4 sm:py-2.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
        {/* Logo NLSbox (with 5-tap secret trigger) & Active Space Pill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogoTap}
            className={`flex items-center gap-1.5 focus:outline-none cursor-pointer transition-transform select-none ${
              tapPulse ? 'scale-110' : 'active:scale-95'
            }`}
            title="NLSbox Hub"
          >
            <div className="relative flex items-center justify-center">
              <div className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-red-600 via-purple-600 to-indigo-600 shadow-sm flex items-center gap-1">
                <Tv className="w-3.5 h-3.5 text-white" />
                <span className="font-extrabold tracking-wider text-[11px] text-white uppercase">NLS</span>
              </div>
            </div>
            <span className="font-bold text-base text-white tracking-tight flex items-center">
              box
            </span>
          </button>

          {/* Active Space Indicator Badge */}
          <div
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${catInfo.color}`}
          >
            <CatIcon className="w-3 h-3" />
            <span className="max-w-[80px] xs:max-w-none truncate">{catInfo.label}</span>
          </div>
        </div>

        {/* Center / Right: Mode Switcher + Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mode Switcher (Source unique vs Multi-sources) */}
          <div className="flex items-center bg-[#181824] p-0.5 rounded-xl border border-white/10 shadow-inner">
            <button
              type="button"
              onClick={() => onToggleSearchMode('single')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 ${
                !isMulti
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md'
                  : 'text-gray-400 hover:text-gray-200 font-medium'
              }`}
              title="Mode source unique ultra rapide"
            >
              <Zap className={`w-3.5 h-3.5 ${!isMulti ? 'text-amber-300' : 'text-gray-400'}`} />
              <span className="hidden sm:inline">Unique</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleSearchMode('multi')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 ${
                isMulti
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md'
                  : 'text-gray-400 hover:text-gray-200 font-medium'
              }`}
              title="Recherche multi-sources groupée"
            >
              <Layers className={`w-3.5 h-3.5 ${isMulti ? 'text-purple-300' : 'text-gray-400'}`} />
              <span className="hidden sm:inline">Multi</span>
            </button>
          </div>

          {/* PWA Mobile App Install Button */}
          <PWAInstallButton />

          {/* Feedback & Wishlist Button */}
          <button
            type="button"
            onClick={onOpenFeedback}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 hover:text-purple-200 transition-all cursor-pointer flex items-center gap-1.5"
            title="Faire une demande de contenu ou signaler un problème"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-bold hidden md:inline">Demande</span>
          </button>

          {/* Notification Bell with Badge */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Centre d'annonces et notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-600 border-2 border-[#121216] text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>

          {/* User Account / Logout */}
          {userEmail && (
            <div className="flex items-center gap-1 pl-1 border-l border-white/10">
              <div
                className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/5 text-[11px] text-gray-300 max-w-[120px] truncate"
                title={`Connecté en tant que ${userEmail}`}
              >
                <UserIcon className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="truncate">{userEmail.split('@')[0]}</span>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Déconnexion"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
