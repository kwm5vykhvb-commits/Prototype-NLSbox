import {
  collection,
  addDoc,
  doc,
  setDoc,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserActivity } from '../types';

const ACTIVITIES_COLLECTION = 'userActivities';

export class ActivityService {
  /**
   * Log an activity for a user in Firestore
   */
  static async logActivity(activity: {
    userId: string;
    userEmail?: string | null;
    userName?: string | null;
    type: UserActivity['type'];
    description: string;
    details?: Record<string, any>;
  }): Promise<void> {
    if (!activity.userId) return;

    try {
      const now = Date.now();
      const payload: Record<string, any> = {
        userId: activity.userId,
        type: activity.type,
        description: activity.description,
        timestamp: now,
      };

      if (activity.userEmail) payload.userEmail = activity.userEmail;
      if (activity.userName) payload.userName = activity.userName;
      if (activity.details) payload.details = activity.details;

      // 1. Add record to userActivities collection
      await addDoc(collection(db, ACTIVITIES_COLLECTION), payload);

      // 2. Update user's summary in users/{userId}
      try {
        await setDoc(
          doc(db, 'users', activity.userId),
          {
            lastActivityAt: now,
            lastActivityDesc: activity.description,
            activityCount: increment(1),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Could not update user lastActivity:', e);
      }
    } catch (e) {
      // Activity logging is non-blocking and shouldn't interrupt the user flow
      console.warn('Could not log user activity:', e);
    }
  }

  /**
   * Helper: Log search action
   */
  static async logSearch(userId: string, searchQuery: string, userEmail?: string, userName?: string): Promise<void> {
    return this.logActivity({
      userId,
      userEmail,
      userName,
      type: 'search',
      description: `Recherche : « ${searchQuery} »`,
      details: { query: searchQuery },
    });
  }

  /**
   * Helper: Log media watch/stream action
   */
  static async logWatch(userId: string, mediaTitle: string, userEmail?: string, userName?: string): Promise<void> {
    return this.logActivity({
      userId,
      userEmail,
      userName,
      type: 'watch',
      description: `Lecture / Visionnage : « ${mediaTitle} »`,
      details: { title: mediaTitle },
    });
  }

  /**
   * Helper: Log media download action
   */
  static async logDownload(userId: string, mediaTitle: string, userEmail?: string, userName?: string): Promise<void> {
    return this.logActivity({
      userId,
      userEmail,
      userName,
      type: 'download',
      description: `Téléchargement : « ${mediaTitle} »`,
      details: { title: mediaTitle },
    });
  }
}

