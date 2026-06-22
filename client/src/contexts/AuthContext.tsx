import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  UserCredential,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { auth, db, messagingPromise } from '../services/firebase';

type UserRole = 'admin' | 'customer';

export class NotAdminError extends Error {
  readonly code = 'auth/not-admin' as const;
  readonly uid: string;
  constructor(uid: string) {
    super('not-admin');
    this.name = 'NotAdminError';
    this.uid = uid;
  }
}

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  isAnonymous: boolean;
  loginWithGoogle: () => Promise<User>;
  register: (email: string, password: string, name: string) => Promise<User>;
  loginAnonymously: () => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        setRole((tokenResult.claims.role as UserRole) || 'customer');
        setUser(firebaseUser);
        saveFcmToken(firebaseUser.uid);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  async function saveFcmToken(uid: string): Promise<void> {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;
    try {
      const messaging = await messagingPromise;
      if (!messaging) return;
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      swReg.active?.postMessage({
        type: 'FIREBASE_CONFIG',
        config: {
          apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId:             import.meta.env.VITE_FIREBASE_APP_ID,
        },
      });
      const fcmToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
      if (fcmToken) {
        await setDoc(doc(db, 'users', uid), { fcmToken }, { merge: true });
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Admin sign-in via Google.
   * Signs out immediately if the account has not been granted the admin role.
   * Throws NotAdminError so the login page can show the UID.
   */
  async function loginWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const tokenResult = await result.user.getIdTokenResult(true);

    if (tokenResult.claims.role !== 'admin') {
      const uid = result.user.uid;
      await signOut(auth);
      throw new NotAdminError(uid);
    }

    return result.user;
  }

  async function register(email: string, password: string, name: string): Promise<User> {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', newUser.uid), {
      name,
      email,
      role: 'customer',
      createdAt: new Date().toISOString(),
    });
    return newUser;
  }

  function loginAnonymously(): Promise<UserCredential> {
    return signInAnonymously(auth);
  }

  function logout(): Promise<void> {
    return signOut(auth);
  }

  const isAnonymous = user?.isAnonymous ?? false;

  return (
    <AuthContext.Provider value={{ user, role, loading, isAnonymous, loginWithGoogle, register, loginAnonymously, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
