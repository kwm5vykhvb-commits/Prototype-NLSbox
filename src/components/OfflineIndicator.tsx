import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <aside
      aria-label="Statut de connexion"
      className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 max-w-sm z-40 bg-zinc-900/95 border border-amber-500/40 text-amber-200 px-3.5 py-2.5 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
        <WifiOff className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-white text-[11px]">Mode hors-ligne actif</p>
        <p className="text-[10px] text-amber-300/80 truncate">
          Vos vidéos téléchargées restent accessibles.
        </p>
      </div>
    </aside>
  );
};
