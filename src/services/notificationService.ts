import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firebaseError';
import { AppNotification } from '../types';

const NOTIFICATIONS_COLLECTION = 'notifications';
const READ_NOTIFS_STORAGE_KEY = 'nlsbox_read_notifications_v1';

export class NotificationService {
  /**
   * Subscribe to live notifications from Firestore
   */
  static subscribeToNotifications(onUpdate: (notifications: AppNotification[]) => void): () => void {
    try {
      const q = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: AppNotification[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              title: data.title || '',
              message: data.message || '',
              type: data.type || 'info',
              createdAt: data.createdAt || Date.now(),
              active: data.active !== false,
              targetUserId: data.targetUserId || undefined,
            });
          });
          onUpdate(list);
        },
        (error) => {
          if (error.message.includes('permission') || error.message.includes('Missing or insufficient')) {
            try {
              handleFirestoreError(error, OperationType.LIST, NOTIFICATIONS_COLLECTION);
            } catch {}
          }
          console.warn('Notification snapshot warning:', error.message);
        }
      );

      return unsubscribe;
    } catch (e) {
      console.warn('Error creating notification listener:', e);
      return () => {};
    }
  }

  /**
   * Local storage: get array of read notification IDs
   */
  static getReadNotificationIds(): string[] {
    try {
      const raw = localStorage.getItem(READ_NOTIFS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Local storage: mark a notification as read
   */
  static markAsRead(id: string): void {
    try {
      const ids = this.getReadNotificationIds();
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(ids));
      }
    } catch (e) {
      console.warn('Could not save read notification:', e);
    }
  }

  /**
   * Local storage: mark all notifications as read
   */
  static markAllAsRead(allIds: (string | { id: string })[]): void {
    try {
      const ids = (allIds || []).map((item) => (typeof item === 'string' ? item : item.id));
      localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn('Could not mark all as read:', e);
    }
  }
}
