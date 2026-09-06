import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ChannelInfo, HubCategory } from '../types';

export interface SyncedGlobalConfig {
  savedChannels?: ChannelInfo[];
  channels?: ChannelInfo[]; // Direct channels array sent by admin dashboard
  primaryChannelsByCategory?: Partial<Record<HubCategory, string>>;
  backupChannelsByCategory?: Partial<Record<HubCategory, string>>;
  multiChannelsByCategory?: Partial<Record<HubCategory, string[]>>;
  extendedModuleEnabled?: boolean;
  extendedModulePin?: string;
  backendUrl?: string;
  // Caméléon & Data Vault sync
  chameleonMode?: boolean;
  chameleonDecoyType?: 'photos' | 'calculator' | 'notes';
  killSwitch?: boolean;
  // Dynamic User-Agent & Referer for stream player
  customUserAgent?: string;
  customReferer?: string;
  updatedAt?: number;
}

const PRIMARY_DOC_PATH = 'systemConfig/channels';
const FALLBACK_DOC_PATH = 'systemConfig/globalSettings';

export class GlobalSyncService {
  /**
   * Listen to real-time updates from Firebase Firestore for channels, sources, and backend config.
   * Read-only synchronization for client apps.
   */
  static subscribeToGlobalConfig(onUpdate: (config: SyncedGlobalConfig) => void): () => void {
    try {
      const unsubPrimary = onSnapshot(
        doc(db, PRIMARY_DOC_PATH),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as SyncedGlobalConfig;
            onUpdate(data);
          }
        },
        (error) => {
          console.warn('Sync listener primary notice:', error.message);
        }
      );

      const unsubFallback = onSnapshot(
        doc(db, FALLBACK_DOC_PATH),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as SyncedGlobalConfig;
            onUpdate(data);
          }
        },
        (error) => {
          console.warn('Sync listener fallback notice:', error.message);
        }
      );

      return () => {
        unsubPrimary();
        unsubFallback();
      };
    } catch (e) {
      console.warn('Unable to subscribe to global config:', e);
      return () => {};
    }
  }

  /**
   * Fetch the latest config once on app startup.
   */
  static async fetchLatestConfig(): Promise<SyncedGlobalConfig | null> {
    try {
      const snapPrimary = await getDoc(doc(db, PRIMARY_DOC_PATH));
      if (snapPrimary.exists()) {
        return snapPrimary.data() as SyncedGlobalConfig;
      }
      const snapFallback = await getDoc(doc(db, FALLBACK_DOC_PATH));
      if (snapFallback.exists()) {
        return snapFallback.data() as SyncedGlobalConfig;
      }
    } catch (e) {
      console.warn('Could not fetch initial config:', e);
    }
    return null;
  }
}

