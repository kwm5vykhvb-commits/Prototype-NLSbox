import React from 'react';
import { Home, Download, Settings } from 'lucide-react';

export type NavTab = 'home' | 'downloads' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeDownloadsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  activeDownloadsCount,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#141418]/95 backdrop-blur-lg border-t border-white/8 py-1 px-4">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {/* Accueil */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center py-0.5 px-3 rounded-lg transition-all cursor-pointer ${
            currentTab === 'home'
              ? 'text-red-500 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className="relative">
            <Home className="w-4 h-4" />
            {currentTab === 'home' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5">Accueil</span>
        </button>

        {/* Téléchargements */}
        <button
          onClick={() => onTabChange('downloads')}
          className={`flex flex-col items-center justify-center py-0.5 px-3 rounded-lg transition-all cursor-pointer relative ${
            currentTab === 'downloads'
              ? 'text-purple-400 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className="relative">
            <Download className="w-4 h-4" />
            {activeDownloadsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-gradient-to-r from-red-600 to-purple-600 text-[8px] font-extrabold text-white rounded-full animate-pulse border border-black">
                {activeDownloadsCount}
              </span>
            )}
            {currentTab === 'downloads' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-purple-500 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5">Téléchargements</span>
        </button>

        {/* Paramètres */}
        <button
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center justify-center py-0.5 px-3 rounded-lg transition-all cursor-pointer ${
            currentTab === 'settings'
              ? 'text-indigo-400 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className="relative">
            <Settings className="w-4 h-4" />
            {currentTab === 'settings' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5">Paramètres</span>
        </button>
      </div>
    </nav>
  );
};
