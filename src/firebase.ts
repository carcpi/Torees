import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { PublicTower, AdminTower } from './game/towersCatalog';
import { quantizeDamagePercent } from './game/rules';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = 'alejandrocarcini@hotmail.com';

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationTypeValue;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationTypeValue,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

void testConnection();

export async function signInWithGooglePopup() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutFirebase() {
  return signOut(auth);
}

export async function syncPlayerToFirestore(shotsBalance: number, totalShotsFired: number): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const path = `players/${user.uid}`;
  try {
    await setDoc(
      doc(db, 'players', user.uid),
      {
        uid: user.uid,
        displayName: (user.displayName || 'Jugador').slice(0, 80),
        shotsBalance: Math.max(0, Math.min(100000, Math.floor(shotsBalance))),
        totalShotsFired: Math.max(0, Math.min(10000000, Math.floor(totalShotsFired))),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncClaimToFirestore(params: {
  claimId: string;
  towerId: string;
  towerNumber: number;
  towerName: string;
  winnerName: string;
  emailOrWallet: string;
  payoutMethod: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const claimPath = `claims/${params.claimId}`;
  const winnerPath = `winners/win_${params.claimId}`;
  try {
    await setDoc(doc(db, 'claims', params.claimId), {
      uid: user.uid,
      towerId: params.towerId.slice(0, 32),
      towerNumber: params.towerNumber,
      winnerName: params.winnerName.slice(0, 60),
      emailOrWallet: params.emailOrWallet.slice(0, 120),
      payoutMethod: params.payoutMethod,
      status: 'PENDIENTE',
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'winners', `win_${params.claimId}`), {
      uid: user.uid,
      towerId: params.towerId.slice(0, 32),
      towerNumber: params.towerNumber,
      towerName: params.towerName.slice(0, 80),
      winnerName: params.winnerName.slice(0, 60),
      prizeAmount: 1000,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${claimPath} | ${winnerPath}`);
  }
}

export async function syncAdminTowersToFirestore(towers: AdminTower[]): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || user.email !== ADMIN_EMAIL) return;

  for (const tower of towers) {
    const publicPath = `towers/${tower.id}`;
    const secretPath = `tower_secrets/${tower.id}`;
    try {
      const publicPayload: Record<string, unknown> = {
        towerNumber: tower.towerNumber,
        name: tower.name.slice(0, 80),
        material: tower.material,
        character: tower.character,
        current_shots: tower.current_shots,
        damage_percent: quantizeDamagePercent(tower.current_shots, tower.target_shots, tower.status),
        status: tower.status,
        wearTier: tower.wearTier,
        leanLevel: tower.leanLevel,
        detachedBlocks: (tower.detachedBlocks || []).slice(0, 20),
        updatedAt: serverTimestamp(),
      };
      if (tower.winnerName) {
        publicPayload.winnerName = tower.winnerName.slice(0, 60);
      }
      await setDoc(doc(db, 'towers', tower.id), publicPayload);
      await setDoc(doc(db, 'tower_secrets', tower.id), {
        towerId: tower.id,
        target_shots: tower.target_shots,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${publicPath} | ${secretPath}`);
    }
  }
}

export async function fetchPublicTowersFromFirestore(): Promise<Partial<PublicTower>[]> {
  try {
    const q = query(
      collection(db, 'towers'),
      where('status', 'in', ['ACTIVA', 'DERRIBADA']),
      orderBy('towerNumber', 'asc'),
      limit(52)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Partial<PublicTower>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'towers');
  }
}
