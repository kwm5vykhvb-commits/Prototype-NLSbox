import React from 'react';
import {
  Film,
  Clapperboard,
  Gamepad2,
  Image as ImageIcon,
  Music,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { HubCategory } from '../types';

interface HubSelectorProps {
  activeCategory: HubCategory;
  onSelectCategory: (category: HubCategory) => void;
  channelsCountMap?: Record<HubCategory, number>;
  isMatureVisible?: boolean;
}

export const HubSelector: React.FC<HubSelectorProps> = ({
  activeCategory,
  onSelectCategory,
  isMatureVisible = false,
}) => {
  const hubs: Array<{
    id: HubCategory;
    title: string;
    icon: React.ElementType;
    gradient: string;
    activeBorder: string;
    activeBg: string;
    activeText: string;
  }> = [
    {
      id: 'anime',
      title: 'Animés',
      icon: Film,
      gradient: 'from-red-600 to-purple-600',
      activeBorder: 'border-red-500/80',
      activeBg: 'bg-red-500/15',
      activeText: 'text-red-400',
    },
    {
      id: 'movie_series',
      title: 'Films & Séries',
      icon: Clapperboard,
      gradient: 'from-blue-600 to-indigo-600',
      activeBorder: 'border-blue-500/80',
      activeBg: 'bg-blue-500/15',
      activeText: 'text-blue-400',
    },
    {
      id: 'games',
      title: 'Jeux',
      icon: Gamepad2,
      gradient: 'from-amber-500 to-orange-600',
      activeBorder: 'border-amber-500/80',
      activeBg: 'bg-amber-500/15',
      activeText: 'text-amber-400',
    },
    {
      id: 'wallpapers',
      title: 'Wallpapers',
      icon: ImageIcon,
      gradient: 'from-cyan-500 to-blue-600',
      activeBorder: 'border-cyan-500/80',
      activeBg: 'bg-cyan-500/15',
      activeText: 'text-cyan-400',
    },
    {
      id: 'music',
      title: 'Musique',
      icon: Music,
      gradient: 'from-pink-600 to-purple-600',
      activeBorder: 'border-pink-500/80',
      activeBg: 'bg-pink-500/15',
      activeText: 'text-pink-400',
    },
    {
      id: 'document',
      title: 'Mangas',
      icon: FileText,
      gradient: 'from-emerald-600 to-teal-600',
      activeBorder: 'border-emerald-500/80',
      activeBg: 'bg-emerald-500/15',
      activeText: 'text-emerald-400',
    },
    {
      id: 'mature',
      title: 'Espace +18',
      icon: ShieldAlert,
      gradient: 'from-rose-600 to-red-700',
      activeBorder: 'border-rose-500/80',
      activeBg: 'bg-rose-500/15',
      activeText: 'text-rose-400',
    },
  ];

  const visibleHubs = hubs.filter((hub) => hub.id !== 'mature' || isMatureVisible);

  return (
    <div className="w-full px-3 py-1">
      {/* Sleek Compact Horizontal Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {visibleHubs.map((hub) => {
          const isActive = activeCategory === hub.id;
          const Icon = hub.icon;

          return (
            <button
              key={hub.id}
              onClick={() => onSelectCategory(hub.id)}
              className={`relative shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
                isActive
                  ? `${hub.activeBg} ${hub.activeBorder} ${hub.activeText} shadow-sm scale-[1.02]`
                  : 'bg-[#15151D] border-white/5 text-gray-400 hover:text-gray-200 hover:border-white/10 hover:bg-[#1C1C26]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{hub.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
