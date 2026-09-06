import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FolderDown, CheckCircle2, X, Ban } from 'lucide-react';
import { User } from 'firebase/auth';
import { AppSettings, DownloadTask, Episode, CatalogResponse, HubCategory, ChannelInfo, AppNotification } from './types';
import { StorageService, DEFAULT_SETTINGS, DEFAULT_BACKUP_CHANNELS } from './services/storage';
import { GlobalSyncService } from './services/syncService';
import { NlsApiService } from './services/api';
import { AuthService } from './services/authService';
import { NotificationService } from './services/notificationService';
import { ActivityService } from './services/activityService';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { DownloadsScreen } from './components/DownloadsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { ScanMangaViewerModal } from './components/ScanMangaViewerModal';
import { MatureWarningModal } from './components/MatureWarningModal';
import { DiscreetUnlockModal } from './components/DiscreetUnlockModal';
import { ChannelSelectorModal } from './components/ChannelSelectorModal';
import { AuthModal } from './components/AuthModal';
import { NotificationModal } from './components/NotificationModal';
import { FeedbackModal } from './components/FeedbackModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SplashScreen } from './components/SplashScreen';
import { CalculatorDecoy } from './components/CalculatorDecoy';
import { MediaClassifier } from './utils/mediaClassifier';
import { triggerDeviceDownload } from './utils/download';
import { downloadManager } from './services/downloadManager';
import { offlineMediaService } from './services/offlineMediaService';

export default function App() {
  // App state
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [downloadToast, setDownloadToast] = useState<{ title: string; fileName: string } | null>(null);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isMatureModalOpen, setIsMatureModalOpen] = useState(false);
  const [isSecretUnlockModalOpen, setIsSecretUnlockModalOpen] = useState(false);
  const [isMatureUnlocked, setIsMatureUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nlsbox_mature_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  // The extended module is visible ONLY if Kill-Switch is NOT active, camouflage is OFF, AND user unlocked via 5 taps + secret PIN
  const isKillSwitchActive = settings.killSwitch === true || settings.chameleonMode === true || settings.extendedModuleEnabled === false;
  const isMatureVisible = !isKillSwitchActive && isMatureUnlocked;

  // Catalog & Search state
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  // Request abort controller reference to prevent race conditions during typing
  const abortControllerRef = useRef<AbortController | null>(null);

  // Downloads state
  const [activeDownloads, setActiveDownloads] = useState<Record<number, DownloadTask>>({});
  const [savedDownloads, setSavedDownloads] = useState<DownloadTask[]>(() => StorageService.getDownloads());

  // Video / Audio Player state
  const [activePlayer, setActivePlayer] = useState<{
    episode: Episode;
    videoUrl: string;
    isOffline: boolean;
  } | null>(null);

  // Scan / Manga / Image HD Viewer state
  const [activeScanManga, setActiveScanManga] = useState<{
    episode: Episode;
    isOffline?: boolean;
  } | null>(null);

  // Real-time Cloud Synchronization (Firebase Firestore)
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState(false);

  // Firebase Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Firebase Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => NotificationService.getReadNotificationIds());
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  // Feedback (Wishlist / Bug Report) state
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackInitialQuery, setFeedbackInitialQuery] = useState('');
  const [feedbackInitialType, setFeedbackInitialType] = useState<'request' | 'report'>('request');

  // Ban check state
  const [bannedStatus, setBannedStatus] = useState<{ isBanned: boolean; reason?: string; bannedAt?: number } | null>(null);

  // Track previous user to detect account changes
  const prevUserUidRef = useRef<string | null>(null);

  // Check ban status when user is authenticated
  useEffect(() => {
    if (!currentUser?.uid) {
      setBannedStatus(null);
      return;
    }

    const checkBan = async () => {
      const res = await AuthService.checkUserBanStatus(currentUser.uid);
      if (res.isBanned) {
        setBannedStatus(res);
      } else {
        setBannedStatus(null);
      }
    };

    checkBan();
    const timer = setInterval(checkBan, 25000);
    return () => clearInterval(timer);
  }, [currentUser?.uid]);

  // Listen to Auth and Notifications changes
  useEffect(() => {
    const unsubAuth = AuthService.onAuthStateChanged((user) => {
      const prevUid = prevUserUidRef.current;
      setCurrentUser(user);
      setIsAuthLoading(false);

      if (!user) {
        prevUserUidRef.current = null;
        setIsAuthModalOpen(true);
      } else {
        // If switched to a different account, reset to fresh home screen
        if (prevUid && prevUid !== user.uid) {
          setCurrentTab('home');
          setActivePlayer(null);
          setActiveScanManga(null);
          setIsNotificationModalOpen(false);
          setIsFeedbackModalOpen(false);
          setIsChannelModalOpen(false);
          setEpisodes([]);
          setLastQuery('');
        }
        prevUserUidRef.current = user.uid;
        setIsAuthModalOpen(false);
      }
    });

    const unsubNotifs = NotificationService.subscribeToNotifications((items) => {
      setNotifications(items);
    });

    return () => {
      unsubAuth();
      unsubNotifs();
    };
  }, []);

  // Synchronize and restore user-specific data from Firebase Cloud so nothing is lost
  useEffect(() => {
    if (!currentUser?.uid) return;

    let isMounted = true;
    AuthService.getUserCloudData(currentUser.uid).then((cloudData) => {
      if (!isMounted || !cloudData) return;

      if (cloudData.downloads && Array.isArray(cloudData.downloads) && cloudData.downloads.length > 0) {
        setSavedDownloads((localDownloads) => {
          const localIds = new Set(localDownloads.map((d) => d.episode.message_id));
          const toAdd = cloudData.downloads!.filter((d) => !localIds.has(d.episode.message_id));
          if (toAdd.length === 0) return localDownloads;
          const merged = [...localDownloads, ...toAdd];
          StorageService.saveDownloads(merged);
          return merged;
        });
      }

      if (cloudData.preferences) {
        setSettings((prev) => {
          // Prevent personal user preferences from overwriting global channels or server configurations
          const {
            savedChannels: _sc,
            backendUrl: _bu,
            primaryChannelsByCategory: _pc,
            backupChannelsByCategory: _bc,
            multiChannelsByCategory: _mc,
            extendedModuleEnabled: _em,
            extendedModulePin: _ep,
            ...personalPrefs
          } = cloudData.preferences as any;
          const next = { ...prev, ...personalPrefs };
          StorageService.saveSettings(next);
          return next;
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid]);

  // Keep user cloud backup up to date whenever saved downloads change
  useEffect(() => {
    if (currentUser?.uid && savedDownloads.length > 0) {
      AuthService.saveUserCloudData(currentUser.uid, { downloads: savedDownloads });
    }
  }, [currentUser?.uid, savedDownloads]);

  // Filter notifications: broadcast notifications for all, plus private targeted replies for this specific user
  const userVisibleNotifications = (notifications || []).filter(
    (n) => !n.targetUserId || (currentUser && n.targetUserId === currentUser.uid)
  );

  const unreadNotifCount = userVisibleNotifications.filter((n) => !(readNotifIds || []).includes(n.id)).length;

  const handleMarkAllNotifsAsRead = () => {
    NotificationService.markAllAsRead(userVisibleNotifications);
    setReadNotifIds(userVisibleNotifications.map((n) => n.id));
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setCurrentTab('home');
    setActivePlayer(null);
    setActiveScanManga(null);
    setIsNotificationModalOpen(false);
    setIsFeedbackModalOpen(false);
    setIsChannelModalOpen(false);
    setEpisodes([]);
    setLastQuery('');
    setIsAuthModalOpen(true);
  };

  // Subscribe to real-time configuration changes from Firebase

  useEffect(() => {
    const unsubscribe = GlobalSyncService.subscribeToGlobalConfig((remoteConfig) => {
      setSettings((current) => {
        let changed = false;
        const next: AppSettings = { ...current };

        // 1. Direct and dynamic channels list (real-time replacement when Chameleon activates/deactivates)
        const incomingChannels = remoteConfig.channels ?? remoteConfig.savedChannels;
        if (Array.isArray(incomingChannels)) {
          next.savedChannels = incomingChannels;
          changed = true;
        }

        // 2. Chameleon Mode & Decoy Type
        if (typeof remoteConfig.chameleonMode === 'boolean' && next.chameleonMode !== remoteConfig.chameleonMode) {
          next.chameleonMode = remoteConfig.chameleonMode;
          changed = true;
        }
        if (remoteConfig.chameleonDecoyType && next.chameleonDecoyType !== remoteConfig.chameleonDecoyType) {
          next.chameleonDecoyType = remoteConfig.chameleonDecoyType;
          changed = true;
        }

        // 3. Kill-Switch Coupling
        if (typeof remoteConfig.killSwitch === 'boolean' && next.killSwitch !== remoteConfig.killSwitch) {
          next.killSwitch = remoteConfig.killSwitch;
          changed = true;
        }

        // 4. Custom User-Agent & Referer for player network dataSource
        if (typeof remoteConfig.customUserAgent === 'string') {
          next.customUserAgent = remoteConfig.customUserAgent;
          changed = true;
        }
        if (typeof remoteConfig.customReferer === 'string') {
          next.customReferer = remoteConfig.customReferer;
          changed = true;
        }

        if (remoteConfig.primaryChannelsByCategory) {
          next.primaryChannelsByCategory = {
            ...current.primaryChannelsByCategory,
            ...remoteConfig.primaryChannelsByCategory,
          };
          changed = true;
        }
        if (remoteConfig.backupChannelsByCategory) {
          next.backupChannelsByCategory = {
            ...current.backupChannelsByCategory,
            ...remoteConfig.backupChannelsByCategory,
          };
          changed = true;
        }
        if (remoteConfig.multiChannelsByCategory) {
          next.multiChannelsByCategory = {
            ...current.multiChannelsByCategory,
            ...remoteConfig.multiChannelsByCategory,
          };
          changed = true;
        }
        if (typeof remoteConfig.extendedModuleEnabled === 'boolean') {
          next.extendedModuleEnabled = remoteConfig.extendedModuleEnabled;
          changed = true;
        }
        if (remoteConfig.extendedModulePin) {
          next.extendedModulePin = remoteConfig.extendedModulePin;
          changed = true;
        }
        if (remoteConfig.backendUrl) {
          next.backendUrl = remoteConfig.backendUrl;
          changed = true;
        }

        if (changed) {
          const currentCat = next.activeCategory || 'anime';
          if (next.primaryChannelsByCategory?.[currentCat]) {
            next.activeChannel = next.primaryChannelsByCategory[currentCat];
          }
          if ((next.searchMode || 'multi') === 'multi') {
            const catMulti = next.multiChannelsByCategory?.[currentCat];
            if (Array.isArray(catMulti) && catMulti.length > 0) {
              next.selectedChannels = catMulti;
            } else {
              const catAll = next.savedChannels.filter((c) => (c.category || 'anime') === currentCat).map((c) => c.id);
              if (catAll.length > 0) next.selectedChannels = catAll;
            }
          } else {
            next.selectedChannels = [next.activeChannel];
          }
          StorageService.saveSettings(next);
          return next;
        }
        return current;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Search or fetch catalog safely across single or multiple channels
  const performSearch = useCallback(
    async (
      query: string = '',
      overrideConfig?: {
        mode?: 'single' | 'multi';
        channel?: string;
        channels?: string[];
      }
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoadingCatalog(true);
      setErrorMessage(null);
      setLastQuery(query);

      if (query && query.trim() && currentUser?.uid) {
        ActivityService.logSearch(
          currentUser.uid,
          query.trim(),
          currentUser.email || undefined,
          currentUser.displayName || undefined
        ).catch(() => {});
      }

      const mode = overrideConfig?.mode || settings.searchMode || 'multi';
      const currentCat = settings.activeCategory || 'anime';
      const singleChannel =
        overrideConfig?.channel ||
        settings.primaryChannelsByCategory?.[currentCat] ||
        settings.activeChannel ||
        'MANGA_PLUS1';

      const categoryMulti = settings.multiChannelsByCategory?.[currentCat];
      const multiChannels =
        overrideConfig?.channels ||
        (Array.isArray(categoryMulti) && categoryMulti.length > 0
          ? categoryMulti
          : settings.selectedChannels && settings.selectedChannels.length > 0
          ? settings.selectedChannels
          : [singleChannel]);

      try {
        if (mode === 'multi' && multiChannels.length > 1) {
          // Multi-Channel search with staggered Anti-Flood protection
          const result = await NlsApiService.searchMultiChannels(
            settings.backendUrl,
            multiChannels,
            query
          );

          if (!controller.signal.aborted) {
            setEpisodes(result.episodes);
            if (result.episodes.length === 0 && Object.values(result.channelResults).some((r) => r.error)) {
              const errorMessages = Object.entries(result.channelResults)
                .filter(([_, r]) => r.error)
                .map(([ch, r]) => `@${ch}: ${r.error}`)
                .join(' | ');
              setErrorMessage(errorMessages);
            }
          }
        } else {
          // Single Channel search (ultra fast) with automatic Failover to Backup Channel
          const targetChannel = mode === 'multi' ? multiChannels[0] : singleChannel;
          try {
            const data: CatalogResponse = await NlsApiService.searchAnimes(
              settings.backendUrl,
              targetChannel,
              query
            );
            if (!controller.signal.aborted) {
              setEpisodes(data.episodes || []);
            }
          } catch (primaryError: any) {
            // Check if backup channel is configured for this category
            const currentCat = settings.activeCategory || 'anime';
            const backupChannel =
              settings.backupChannelsByCategory?.[currentCat] ||
              DEFAULT_BACKUP_CHANNELS[currentCat];

            if (backupChannel && backupChannel !== targetChannel) {
              try {
                const backupData: CatalogResponse = await NlsApiService.searchAnimes(
                  settings.backendUrl,
                  backupChannel,
                  query
                );
                if (!controller.signal.aborted) {
                  setEpisodes(backupData.episodes || []);
                }
              } catch {
                if (!controller.signal.aborted) {
                  setErrorMessage(primaryError?.message || 'Erreur lors du chargement des médias');
                  setEpisodes([]);
                }
              }
            } else {
              if (!controller.signal.aborted) {
                setErrorMessage(primaryError?.message || 'Erreur lors du chargement des médias');
                setEpisodes([]);
              }
            }
          }
        }
      } catch (e: any) {
        if (!controller.signal.aborted) {
          setErrorMessage(e?.message || 'Erreur lors de la recherche');
          setEpisodes([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCatalog(false);
        }
      }
    },
    [settings.backendUrl, settings.activeCategory, settings.activeChannel, settings.searchMode, settings.selectedChannels, settings.backupChannelsByCategory]
  );

  // Initial load
  useEffect(() => {
    performSearch('');
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [performSearch]);

  // 1. Subscribe to real-time streaming download progress updates (Movie Box style)
  useEffect(() => {
    const unsub = downloadManager.subscribe((tasks) => {
      setActiveDownloads(tasks);
    });
    return unsub;
  }, []);

  // 2. Subscribe to download events (completion & error)
  useEffect(() => {
    const unsubComp = downloadManager.onCompleted((completedEpisode) => {
      setSavedDownloads(StorageService.getDownloads());
      setDownloadToast({
        title: completedEpisode.title || completedEpisode.file_name,
        fileName: '✓ Téléchargé avec succès ! Prêt pour visionnage hors-ligne (0 Mo de forfait).',
      });
      setTimeout(() => setDownloadToast(null), 5000);
    });

    const unsubErr = downloadManager.onError((ep, err) => {
      setDownloadToast({
        title: ep.title || ep.file_name,
        fileName: `Erreur de téléchargement: ${err}`,
      });
      setTimeout(() => setDownloadToast(null), 5000);
    });

    return () => {
      unsubComp();
      unsubErr();
    };
  }, []);

  // 3. Sync saved downloads from local IndexedDB media vault on mount
  useEffect(() => {
    offlineMediaService.getAllMediaMeta().then((metas) => {
      if (metas.length > 0) {
        const mapped: DownloadTask[] = metas.map((m) => ({
          episode: {
            message_id: m.messageId,
            title: m.title,
            file_name: m.fileName,
            size_mb: m.sizeMb,
            download_url: `/download/${m.channel}/${m.messageId}`,
            channel: m.channel,
            duration: m.duration,
            thumbnail: m.thumbnail,
          },
          progress: 100,
          downloadedBytes: m.sizeMb * 1024 * 1024,
          totalBytes: m.sizeMb * 1024 * 1024,
          status: 'completed',
          speedMbPerSec: 0,
          completedAt: new Date(m.savedAt).toISOString(),
        }));
        setSavedDownloads(mapped);
        StorageService.saveDownloads(mapped);
      }
    }).catch(() => {});
  }, []);

  // Start Download (Fast, direct native download to device storage + saved catalog tracking)
  const handleStartDownload = useCallback(
    (episode: Episode) => {
      // 1. Immediately trigger the high-speed native device download
      // Handled natively by Safari / Chrome at full network speed (no RAM exhaustion, works screen locked)
      triggerDeviceDownload(episode, settings.backendUrl);

      // 2. Automatically register in savedDownloads so it appears in the Downloads tab
      setSavedDownloads((prev) => {
        const isAlreadySaved = prev.some((d) => d.episode.message_id === episode.message_id);
        if (isAlreadySaved) return prev;

        const newTask: DownloadTask = {
          episode,
          progress: 100,
          downloadedBytes: (episode.size_mb || 0) * 1024 * 1024,
          totalBytes: (episode.size_mb || 0) * 1024 * 1024,
          status: 'completed',
          speedMbPerSec: 0,
        };
        const updated = [newTask, ...prev];
        StorageService.saveDownloads(updated);
        return updated;
      });

      // 3. Log activity
      if (currentUser?.uid) {
        ActivityService.logDownload(
          currentUser.uid,
          episode.title || episode.file_name || 'Média',
          currentUser.email || undefined,
          currentUser.displayName || undefined
        ).catch(() => {});
      }

      // 4. Display friendly floating notification
      setDownloadToast({
        title: episode.title,
        fileName: '⚡ Téléchargement rapide lancé • Enregistrement dans vos Téléchargements',
      });
      setTimeout(() => {
        setDownloadToast(null);
      }, 4000);
    },
    [settings.backendUrl, currentUser]
  );

  // Save Direct Download record to local history
  const handleSaveDirectDownload = useCallback((episode: Episode) => {
    setSavedDownloads((prev) => {
      const isAlreadySaved = prev.some((d) => d.episode.message_id === episode.message_id);
      if (isAlreadySaved) return prev;

      const newTask: DownloadTask = {
        episode,
        progress: 100,
        downloadedBytes: (episode.size_mb || 0) * 1024 * 1024,
        totalBytes: (episode.size_mb || 0) * 1024 * 1024,
        status: 'completed',
        speedMbPerSec: 0,
      };
      const updated = [newTask, ...prev];
      StorageService.saveDownloads(updated);
      return updated;
    });
  }, []);

  // Cancel Download
  const handleCancelDownload = useCallback((messageId: number) => {
    downloadManager.cancelDownload(messageId);
  }, []);

  // Delete saved Download
  const handleDeleteDownload = useCallback(async (messageId: number) => {
    await offlineMediaService.deleteMedia(messageId);
    setSavedDownloads((prev) => {
      const updated = prev.filter((d) => d.episode.message_id !== messageId);
      StorageService.saveDownloads(updated);
      return updated;
    });
  }, []);

  // Clear all saved downloads
  const handleClearAllDownloads = useCallback(async () => {
    await offlineMediaService.clearAllMedia();
    setSavedDownloads([]);
    StorageService.saveDownloads([]);
  }, []);

  // Play Episode / View Scan & Manga
  const handlePlayEpisode = useCallback(
    async (episode: Episode, isOffline: boolean = false) => {
      // Log watch activity
      if (currentUser?.uid) {
        ActivityService.logWatch(
          currentUser.uid,
          episode.title || episode.file_name || 'Média',
          currentUser.email || undefined,
          currentUser.displayName || undefined
        ).catch(() => {});
      }

      // 1. Check if this item is strictly a video or audio FIRST
      const isVideo = MediaClassifier.isVideoFile(episode.title || '', episode.file_name || '');
      const isAudio = MediaClassifier.isAudioFile(episode.title || '', episode.file_name || '');
      const meta = MediaClassifier.analyze(episode.title || '', episode.file_name || '');

      // 2. Identify strictly document/scan or image files
      const isDocExt =
        episode.file_name?.toLowerCase().endsWith('.cbz') ||
        episode.file_name?.toLowerCase().endsWith('.cbr') ||
        episode.file_name?.toLowerCase().endsWith('.pdf') ||
        episode.file_name?.toLowerCase().endsWith('.epub') ||
        episode.title?.toLowerCase().endsWith('.cbz') ||
        episode.title?.toLowerCase().endsWith('.cbr') ||
        episode.title?.toLowerCase().endsWith('.pdf');

      const isImageExt =
        episode.file_name?.toLowerCase().endsWith('.png') ||
        episode.file_name?.toLowerCase().endsWith('.jpg') ||
        episode.file_name?.toLowerCase().endsWith('.jpeg') ||
        episode.file_name?.toLowerCase().endsWith('.webp');

      const isMangaOrImage =
        !isVideo &&
        !isAudio &&
        (meta.isImage ||
          meta.isDocument ||
          isDocExt ||
          isImageExt);

      // Check if file is available in local offline storage vault
      const hasOfflineMedia = await offlineMediaService.hasMedia(episode.message_id);
      let localBlobUrl: string | null = null;
      if (hasOfflineMedia) {
        localBlobUrl = await offlineMediaService.getMediaBlobUrl(episode.message_id);
      }

      // Scan / Manga view
      if (isMangaOrImage) {
        setActiveScanManga({ episode, isOffline: !!localBlobUrl || isOffline });
        return;
      }

      // Video / Audio Playback: if offline file exists, play directly without network!
      if (localBlobUrl) {
        setActivePlayer({
          episode,
          videoUrl: localBlobUrl,
          isOffline: true,
        });
        return;
      }

      const cleanBase = settings.backendUrl.replace(/\/+$/, '');
      const cleanPath = (episode.download_url || '').startsWith('/') ? episode.download_url : `/${episode.download_url || ''}`;
      const videoUrl = isOffline ? cleanPath : `${cleanBase}${cleanPath}`;

      setActivePlayer({
        episode,
        videoUrl,
        isOffline: false,
      });
    },
    [settings.backendUrl, currentUser]
  );

  const handlePlayOnline = useCallback(
    (episode: Episode) => {
      handlePlayEpisode(episode, false);
    },
    [handlePlayEpisode]
  );

  const handleRefreshHome = useCallback(async () => {
    await performSearch(lastQuery);
  }, [performSearch, lastQuery]);

  // Update Settings (locally and sync to user cloud profile)
  const handleUpdateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);
    if (currentUser?.uid) {
      AuthService.saveUserCloudData(currentUser.uid, { preferences: newSettings }).catch(() => {});
    }
  }, [currentUser?.uid]);

  // Reset Defaults
  const handleResetDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    StorageService.saveSettings(DEFAULT_SETTINGS);
    performSearch('');
  }, [performSearch]);

  // Clear all storage
  const handleClearStorage = useCallback(() => {
    setSavedDownloads([]);
    StorageService.saveDownloads([]);
  }, []);

  // Select Single Channel seamlessly
  const handleSelectSingleChannel = useCallback(
    (channelId: string) => {
      const cleanId = channelId.trim().replace(/^@/, '');
      const existing = settings.savedChannels.find((c) => c.id === cleanId);
      const updatedChannels = existing
        ? settings.savedChannels
        : [{ id: cleanId, name: `#${cleanId}`, category: settings.activeCategory || 'anime', description: 'Source personnalisée' }, ...settings.savedChannels];

      const updated: AppSettings = {
        ...settings,
        activeChannel: cleanId,
        searchMode: 'single',
        selectedChannels: [cleanId],
        savedChannels: updatedChannels,
      };
      setSettings(updated);
      StorageService.saveSettings(updated);
      setEpisodes([]);
      performSearch('', { mode: 'single', channel: cleanId });
    },
    [settings, performSearch]
  );

  // User toggle between Source unique and Multi-sources (channels remain completely transparent)
  const handleToggleSearchMode = useCallback(
    (newMode: 'single' | 'multi') => {
      const currentCategory = settings.activeCategory || 'anime';
      const categoryChannels = settings.savedChannels.filter(
        (c) => (c.category || 'anime') === currentCategory
      );

      // Preselected primary channel for this category
      const primaryChannel =
        settings.primaryChannelsByCategory?.[currentCategory] ||
        categoryChannels[0]?.id ||
        settings.activeChannel ||
        'MANGA_PLUS1';

      // Preselected multi channels for this category
      const multiChannels =
        settings.multiChannelsByCategory?.[currentCategory] ||
        categoryChannels.map((c) => c.id);
      const safeMulti = multiChannels.length > 0 ? multiChannels : [primaryChannel];

      const targetChannels = newMode === 'multi' ? safeMulti : [primaryChannel];

      const updated: AppSettings = {
        ...settings,
        searchMode: newMode,
        activeChannel: primaryChannel,
        selectedChannels: targetChannels,
      };

      setSettings(updated);
      StorageService.saveSettings(updated);
      setEpisodes([]);
      performSearch('', {
        mode: newMode,
        channel: primaryChannel,
        channels: targetChannels,
      });
    },
    [settings, performSearch]
  );

  // Core Category switch logic with preselected channels
  const executeSelectCategory = useCallback(
    (category: HubCategory) => {
      const mode = settings.searchMode || 'multi';
      const categoryChannels = settings.savedChannels.filter(
        (c) => (c.category || 'anime') === category
      );

      // Preselected primary channel
      const primaryChannel =
        settings.primaryChannelsByCategory?.[category] ||
        categoryChannels[0]?.id ||
        'MANGA_PLUS1';

      // Preselected multi channels
      const multiChannels =
        settings.multiChannelsByCategory?.[category] ||
        categoryChannels.map((c) => c.id);
      const safeMulti = multiChannels.length > 0 ? multiChannels : [primaryChannel];

      const targetChannels = mode === 'multi' ? safeMulti : [primaryChannel];

      const updated: AppSettings = {
        ...settings,
        activeCategory: category,
        activeChannel: primaryChannel,
        selectedChannels: targetChannels,
      };

      setSettings(updated);
      StorageService.saveSettings(updated);
      setEpisodes([]);
      performSearch('', {
        mode,
        channel: primaryChannel,
        channels: targetChannels,
      });
    },
    [settings, performSearch]
  );

  // Handle Category / Hub switch with 18+ gate
  const handleSelectCategory = useCallback(
    (category: HubCategory) => {
      if (category === 'mature') {
        if (!isMatureVisible) {
          return;
        }
        const isAgreed = sessionStorage.getItem('nlsbox_mature_agreed') === 'true';
        if (!isAgreed) {
          setIsMatureModalOpen(true);
          return;
        }
      }
      executeSelectCategory(category);
    },
    [isMatureVisible, executeSelectCategory]
  );

  // Deep-link direct handler: directly opens and plays shared media inside the app
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search;
    if (!search) return;

    try {
      const params = new URLSearchParams(search);
      const playFlag = params.get('play');
      const msgIdStr = params.get('msg');

      if (playFlag === '1' && msgIdStr) {
        const msgId = Number(msgIdStr);
        if (!isNaN(msgId)) {
          const title = params.get('title') || 'Média partagé';
          const fileName = params.get('file') || title;
          const channel = params.get('ch') || undefined;
          const customUrl = params.get('url');
          const downloadUrl = customUrl || (channel ? `/download/${channel}/${msgId}` : '');
          const sizeMb = Number(params.get('size')) || 0;
          const thumbnail = params.get('thumb') || undefined;
          const category = params.get('cat') as HubCategory | null;

          if (category) {
            handleSelectCategory(category);
          }

          const sharedEpisode: Episode = {
            message_id: msgId,
            title,
            file_name: fileName,
            download_url: downloadUrl,
            channel,
            size_mb: sizeMb,
            thumbnail,
          };

          // Switch tab to home & trigger playback directly in-app
          setCurrentTab('home');
          handlePlayEpisode(sharedEpisode, false);

          // Clean up URL parameters to keep address bar tidy without reload
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (e) {
      console.warn('Failed to parse deep link media params', e);
    }
  }, [handlePlayEpisode, handleSelectCategory]);

  // Auto-fallback if the extended module gets locked or killed while currently active
  useEffect(() => {
    if (!isMatureVisible && settings.activeCategory === 'mature') {
      executeSelectCategory('anime');
    }
  }, [isMatureVisible, settings.activeCategory, executeSelectCategory]);

  // Count channels per hub category (All 7 spaces)
  const channelsCountMap: Record<HubCategory, number> = {
    anime: settings.savedChannels.filter((c) => (c.category || 'anime') === 'anime').length,
    movie_series: settings.savedChannels.filter((c) => c.category === 'movie_series').length,
    games: settings.savedChannels.filter((c) => c.category === 'games').length,
    wallpapers: settings.savedChannels.filter((c) => c.category === 'wallpapers').length,
    music: settings.savedChannels.filter((c) => c.category === 'music').length,
    document: settings.savedChannels.filter((c) => c.category === 'document').length,
    mature: settings.savedChannels.filter((c) => c.category === 'mature').length,
  };

  if (isAuthLoading) {
    return (
      <SplashScreen
        statusText="Démarrage de NLSbox..."
        subText="Connexion et synchronisation des contenus..."
      />
    );
  }

  // Chameleon Camouflage View: Calculator Decoy
  if (settings.chameleonMode === true && settings.chameleonDecoyType === 'calculator') {
    return (
      <CalculatorDecoy
        onSecretUnlock={() => {
          // Secret manual override if allowed
          if (!settings.killSwitch) {
            setIsSecretUnlockModalOpen(true);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E12] text-gray-100 flex flex-col font-sans selection:bg-red-600 selection:text-white antialiased overflow-x-hidden">
      {/* 1. Header Bar with transparent mode toggle */}
      <Header
        activeCategory={settings.activeCategory || 'anime'}
        searchMode={settings.searchMode || 'single'}
        onToggleSearchMode={handleToggleSearchMode}
        isOnline={true}
        onTriggerSecretUnlock={() => setIsSecretUnlockModalOpen(true)}
        isSecretUnlockDisabled={isKillSwitchActive}
        unreadNotifCount={unreadNotifCount}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        onOpenFeedback={() => {
          setFeedbackInitialQuery('');
          setFeedbackInitialType('request');
          setIsFeedbackModalOpen(true);
        }}
        userEmail={currentUser?.email || null}
        onLogout={handleLogout}
      />

      {/* 2. Main Content View */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-0">
        {currentTab === 'home' && (
          <HomeScreen
            episodes={episodes}
            isLoading={isLoadingCatalog}
            activeCategory={settings.activeCategory || 'anime'}
            activeChannel={settings.activeChannel}
            searchMode={settings.searchMode || 'single'}
            selectedChannels={settings.selectedChannels || [settings.activeChannel]}
            channelsCountMap={channelsCountMap}
            isMatureVisible={isMatureVisible}
            onSelectCategory={handleSelectCategory}
            onRefresh={handleRefreshHome}
            onSearch={performSearch}
            onPlayEpisode={handlePlayOnline}
            onDownloadEpisode={handleStartDownload}
            activeDownloads={activeDownloads}
            savedDownloads={savedDownloads}
            errorMessage={errorMessage}
            savedChannels={settings.savedChannels}
            onOpenChannelModal={() => setIsChannelModalOpen(true)}
            onSelectSingleChannel={handleSelectSingleChannel}
            onRequestContent={(query) => {
              setFeedbackInitialQuery(query || '');
              setFeedbackInitialType('request');
              setIsFeedbackModalOpen(true);
            }}
          />
        )}

        {currentTab === 'downloads' && (
          <DownloadsScreen
            activeDownloads={activeDownloads}
            savedDownloads={savedDownloads}
            onPlayEpisode={handlePlayEpisode}
            onCancelDownload={handleCancelDownload}
            onDeleteDownload={handleDeleteDownload}
            onClearAllDownloads={handleClearAllDownloads}
            onSaveDirectDownload={handleSaveDirectDownload}
            backendUrl={settings.backendUrl}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetDefaults={handleResetDefaults}
            onClearStorage={handleClearStorage}
          />
        )}
      </main>

      {/* 3. Bottom App Navigation */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'home' && currentTab === 'home') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          setCurrentTab(tab);
        }}
        activeDownloadsCount={Object.keys(activeDownloads).length}
      />

      {/* 4. Fullscreen Video Player */}
      {activePlayer && (
        <VideoPlayerModal
          episode={activePlayer.episode}
          videoUrl={activePlayer.videoUrl}
          isOffline={activePlayer.isOffline}
          backendUrl={settings.backendUrl}
          customUserAgent={settings.customUserAgent}
          customReferer={settings.customReferer}
          onClose={() => setActivePlayer(null)}
        />
      )}

      {/* 4b. Universal Scan, Manga & HD Image Viewer */}
      {activeScanManga && (
        <ScanMangaViewerModal
          episode={activeScanManga.episode}
          isOffline={activeScanManga.isOffline}
          backendUrl={settings.backendUrl}
          onClose={() => setActiveScanManga(null)}
        />
      )}

      {/* 5. Mature Content 18+ Warning Gate */}
      <MatureWarningModal
        isOpen={isMatureModalOpen}
        onCancel={() => {
          setIsMatureModalOpen(false);
        }}
        onConfirm={() => {
          setIsMatureModalOpen(false);
          executeSelectCategory('mature');
        }}
      />

      {/* 6. Channel Selector & Source Manager Modal */}
      <ChannelSelectorModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        channels={settings.savedChannels}
        activeCategory={settings.activeCategory || 'anime'}
        activeChannel={settings.activeChannel}
        searchMode={settings.searchMode || 'multi'}
        selectedChannels={settings.selectedChannels || [settings.activeChannel]}
        primaryChannelId={
          settings.primaryChannelsByCategory?.[settings.activeCategory || 'anime'] ||
          settings.activeChannel
        }
        onSelectCategory={handleSelectCategory}
        onToggleSearchMode={(newMode) => {
          handleToggleSearchMode(newMode);
        }}
        onSelectSingleChannel={(channelId) => {
          handleSelectSingleChannel(channelId);
          setIsChannelModalOpen(false);
        }}
        onUpdateMultiChannels={(_channels, mode) => {
          handleToggleSearchMode(mode);
          setIsChannelModalOpen(false);
        }}
      />

      {/* 7. Discreet 18+ Module Unlock Modal (triggered by 5 taps on NLS logo) */}
      <DiscreetUnlockModal
        isOpen={isSecretUnlockModalOpen && !isKillSwitchActive}
        onClose={() => setIsSecretUnlockModalOpen(false)}
        isUnlocked={isMatureUnlocked}
        isKillSwitchActive={isKillSwitchActive}
        correctPin={settings.extendedModulePin || '7777'}
        onUnlock={() => {
          setIsMatureUnlocked(true);
          try {
            localStorage.setItem('nlsbox_mature_unlocked', 'true');
          } catch {}
        }}
        onLock={() => {
          setIsMatureUnlocked(false);
          try {
            localStorage.setItem('nlsbox_mature_unlocked', 'false');
          } catch {}
        }}
      />

      {/* 8. User Login / Registration Modal (Firebase Auth) */}
      <AuthModal
        isOpen={isAuthModalOpen && !currentUser}
        onSuccess={() => setIsAuthModalOpen(false)}
      />

      {/* 9. Notification Center Modal (Firebase Real-time announcements) */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        notifications={userVisibleNotifications}
        readIds={readNotifIds}
        readNotificationIds={readNotifIds}
        onMarkAllAsRead={handleMarkAllNotifsAsRead}
      />

      {/* 10. User Feedback & Wishlist Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        activeCategory={settings.activeCategory || 'anime'}
        activeChannel={settings.activeChannel}
        userEmail={currentUser?.email || null}
        userId={currentUser?.uid || null}
        initialQuery={feedbackInitialQuery}
        initialType={feedbackInitialType}
      />

      {/* 11. Banned User Suspension Modal */}
      {bannedStatus?.isBanned && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#16121e] border border-rose-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl animate-scaleUp">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
              <Ban className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">Compte Suspendu</h2>
              <p className="text-xs text-gray-400 mt-1">
                Votre accès à l'application NLSbox a été temporairement suspendu.
              </p>
            </div>
            <div className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-4 text-left space-y-1.5">
              <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">Motif communiqué :</span>
              <p className="text-sm font-semibold text-white">
                {bannedStatus.reason || 'Infraction aux règles de la plateforme'}
              </p>
              {bannedStatus.bannedAt && (
                <p className="text-[10px] text-gray-400 pt-1">
                  Date : {new Date(bannedStatus.bannedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Pour toute contestation ou demande de réexamen, veuillez contacter le support.
            </p>
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-rose-900/30"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}

      {/* 12. Real Device Download Toast Banner */}
      {downloadToast && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-[#1e142b] border border-purple-500/50 rounded-2xl p-4 shadow-2xl flex items-start gap-3 backdrop-blur-lg animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
            <FolderDown className="w-5 h-5 animate-bounce" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Téléchargement vers l'appareil lancé !</span>
            </div>
            <p className="text-xs font-bold text-white truncate mt-0.5">
              {downloadToast.title}
            </p>
            <p className="text-[11px] text-gray-300 mt-1 leading-snug">
              Enregistré dans votre mémoire interne (dossier <strong>Téléchargements</strong>). Vous pouvez le lire directement dans votre téléphone avec VLC ou votre galerie.
            </p>
          </div>
          <button
            onClick={() => setDownloadToast(null)}
            className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 12. Subtle Offline Connectivity Status */}
      <OfflineIndicator />
    </div>
  );
}
