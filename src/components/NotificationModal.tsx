import React from 'react';
import { Bell, X, CheckCheck, Sparkles, Info, AlertTriangle, Clock } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  readIds?: string[];
  readNotificationIds?: string[];
  onMarkAllAsRead: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications = [],
  readIds,
  readNotificationIds,
  onMarkAllAsRead,
}) => {
  if (!isOpen) return null;

  const safeReadIds = Array.isArray(readNotificationIds)
    ? readNotificationIds
    : Array.isArray(readIds)
    ? readIds
    : [];

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = Date.now();
    const diffMin = Math.floor((now - timestamp) / 60000);

    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getTypeStyle = (type: AppNotification['type']) => {
    switch (type) {
      case 'update':
        return {
          icon: Sparkles,
          label: 'Nouveauté',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          iconColor: 'text-emerald-400 bg-emerald-500/10',
        };
      case 'alert':
        return {
          icon: AlertTriangle,
          label: 'Alerte',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          iconColor: 'text-rose-400 bg-rose-500/10',
        };
      case 'info':
      default:
        return {
          icon: Info,
          label: 'Info',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          iconColor: 'text-blue-400 bg-blue-500/10',
        };
    }
  };

  const unreadCount = (notifications || []).filter((n) => !safeReadIds.includes(n.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-[#161622] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between bg-[#12121c]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Centre d'annonces</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-600 text-white animate-pulse">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">Restez informé des nouveautés et actualités du hub</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 cursor-pointer"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tout lire</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unread banner for mobile */}
        {unreadCount > 0 && (
          <div className="sm:hidden px-4 py-2 bg-indigo-950/40 border-b border-indigo-500/20 flex items-center justify-between">
            <span className="text-[11px] text-indigo-300 font-medium">{unreadCount} message(s) non lu(s)</span>
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-[11px] font-bold text-indigo-400 flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tout marquer comme lu</span>
            </button>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-gray-500 mb-3">
                <Bell className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-gray-300">Aucune annonce pour le moment</p>
              <p className="text-xs text-gray-500 mt-1">
                Les mises à jour et annonces du système apparaîtront ici.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const typeCfg = getTypeStyle(n.type);
              const Icon = typeCfg.icon;
              const isUnread = !safeReadIds.includes(n.id);

              return (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isUnread
                      ? 'bg-gradient-to-r from-purple-950/30 to-indigo-950/20 border-indigo-500/40 shadow-sm'
                      : 'bg-[#12121a]/60 border-white/5 opacity-85'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${typeCfg.iconColor}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeCfg.badge}`}>
                        {typeCfg.label}
                      </span>
                      {n.targetUserId && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Message Personnel
                        </span>
                      )}
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDate(n.createdAt)}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white mb-1">{n.title}</h4>
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{n.message}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
