import {
  collection,
  addDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firebaseError';
import { UserFeedback } from '../types';

const FEEDBACK_COLLECTION = 'feedback';

export class FeedbackService {
  /**
   * User: Submit a problem report or content wish
   */
  static async submitFeedback(
    item: Omit<UserFeedback, 'id' | 'createdAt' | 'status'>
  ): Promise<string | null> {
    try {
      // Build safe payload without any undefined values (Firestore rejects undefined)
      const payload: Record<string, any> = {
        type: item.type || 'report',
        title: item.title || '',
        description: item.description || '',
        category: item.category || 'general',
        status: 'pending',
        createdAt: Date.now(),
      };

      if (item.channelId) payload.channelId = item.channelId;
      if (item.userEmail) payload.userEmail = item.userEmail;
      if (item.userId) payload.userId = item.userId;

      const docRef = await addDoc(collection(db, FEEDBACK_COLLECTION), payload);
      return docRef.id;
    } catch (e) {
      if (e instanceof Error && (e.message.includes('permission') || e.message.includes('Missing or insufficient'))) {
        try {
          handleFirestoreError(e, OperationType.CREATE, FEEDBACK_COLLECTION);
        } catch {}
      }
      console.error('Failed to submit feedback:', e);
      return null;
    }
  }
}

