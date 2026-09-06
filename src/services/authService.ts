import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DownloadTask, AppSettings } from '../types';

export class AuthService {
  private static isSigningIn = false;

  /**
   * Listen to Firebase auth state changes with guaranteed persistence
   */
  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Record last login in Firestore
        try {
          await setDoc(
            doc(db, 'users', user.uid),
            {
              uid: user.uid,
              email: user.email || null,
              displayName: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
              photoURL: user.photoURL || null,
              lastLogin: Date.now(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn('Could not update user lastLogin:', e);
        }
      }
      callback(user);
    });
  }

  /**
   * Sign in directly with Google (Popup with account chooser)
   */
  static async loginWithGoogle(): Promise<User> {
    if (this.isSigningIn) {
      throw new Error('Une tentative de connexion est déjà en cours.');
    }
    this.isSigningIn = true;

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;

      // Record user profile immediately in Firestore
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
            photoURL: user.photoURL || null,
            lastLogin: Date.now(),
            createdAt: Date.now(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Could not record Google user in Firestore:', e);
      }

      return user;
    } finally {
      this.isSigningIn = false;
    }
  }

  /**
   * Log in existing user with Email & Password
   */
  static async login(email: string, pass: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return cred.user;
  }

  /**
   * Register new user with Email & Password
   */
  static async register(email: string, pass: string, displayName?: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }

    // Save profile record in Firestore
    try {
      await setDoc(
        doc(db, 'users', cred.user.uid),
        {
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: displayName?.trim() || cred.user.email?.split('@')[0] || 'Utilisateur',
          createdAt: Date.now(),
          lastLogin: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Could not create initial user record:', e);
    }

    return cred.user;
  }

  /**
   * Fetch user's cloud saved data (downloads, playlists, preferences)
   */
  static async getUserCloudData(uid: string): Promise<{
    downloads?: DownloadTask[];
    preferences?: Partial<AppSettings>;
  } | null> {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          downloads: data.savedDownloads || undefined,
          preferences: data.savedPreferences || undefined,
        };
      }
    } catch (e) {
      console.warn('Could not fetch user cloud data:', e);
    }
    return null;
  }

  /**
   * Save user's data to cloud so nothing is lost even when changing device
   */
  static async saveUserCloudData(
    uid: string,
    data: {
      downloads?: DownloadTask[];
      preferences?: Partial<AppSettings>;
    }
  ): Promise<void> {
    try {
      const payload: Record<string, any> = {
        updatedAt: Date.now(),
      };
      if (data.downloads !== undefined) {
        // Sanitize localBlobUrl before saving to Firestore (do not store undefined)
        payload.savedDownloads = data.downloads.map((d) => {
          const { localBlobUrl, ...cleanDownload } = d;
          return cleanDownload;
        });
      }
      if (data.preferences !== undefined) {
        payload.savedPreferences = data.preferences;
      }

      await setDoc(doc(db, 'users', uid), payload, { merge: true });
    } catch (e) {
      console.warn('Could not sync user cloud data to Firestore:', e);
    }
  }

  /**
   * Log out
   */
  static async logout(): Promise<void> {
    await signOut(auth);
  }

  /**
   * Check if a specific user is banned
   */
  static async checkUserBanStatus(uid: string): Promise<{
    isBanned: boolean;
    bannedReason?: string;
    bannedAt?: number;
  }> {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.isBanned) {
          return {
            isBanned: true,
            bannedReason: data.bannedReason || 'Infraction aux règles d’utilisation',
            bannedAt: data.bannedAt || data.updatedAt || Date.now(),
          };
        }
      }
    } catch (e) {
      console.warn('Error checking ban status:', e);
    }
    return { isBanned: false };
  }
}

