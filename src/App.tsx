import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGooglePopup, signOutFirebase, syncPlayerToFirestore } from './firebase';
import type { PublicTower, WinnerEntry } from './game/towersCatalog';
import { soundEngine } from './game/soundEngine';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LobbyView } from './components/LobbyView';
import { TowerStage } from './components/TowerStage';
import { ShopModal } from './components/ShopModal';
import { VictoryClaimModal } from './components/VictoryClaimModal';
import { AdminModal } from './components/AdminModal';

function getOrCreateLocalPlayerId(): string {
  try {
    const key = 'td1000_player_id';
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = `plr_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return 'guest_default';
  }
}

export function AppContent() {
  const [playerId, setPlayerId] = useState<string>(() => getOrCreateLocalPlayerId());
  const [user, setUser] = useState<User | null>(null);
  const [towers, setTowers] = useState<PublicTower[]>([]);
  const [winners, setWinners] = useState<WinnerEntry[]>([]);
  const [shotsBalance, setShotsBalance] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeTowerId, setActiveTowerId] = useState<string | null>(null);
  const [autoFireWin, setAutoFireWin] = useState<boolean>(false);

  const [shopOpen, setShopOpen] = useState<boolean>(false);
  const [shopOutOfShots, setShopOutOfShots] = useState<boolean>(false);
  const [victoryTower, setVictoryTower] = useState<PublicTower | null>(null);
  const [adminOpen, setAdminOpen] = useState<boolean>(false);

  const fetchState = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/state?playerId=${encodeURIComponent(pid)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        towers: PublicTower[];
        winners: WinnerEntry[];
        shotsBalance: number;
      };
      setTowers(data.towers);
      setWinners(data.winners);
      setShotsBalance(data.shotsBalance);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchState(playerId);
    const interval = setInterval(() => {
      void fetchState(playerId);
    }, 10000);
    return () => clearInterval(interval);
  }, [playerId, fetchState]);

  const hasAutostartedRef = useRef(false);

  // Optional ?autostart=1 opens Tower #1 directly once on initial load
  useEffect(() => {
    if (hasAutostartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && towers.length > 0) {
      hasAutostartedRef.current = true;
      setActiveTowerId(towers[0].id);
    }
  }, [towers]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setPlayerId(firebaseUser.uid);
      }
    });
    return () => unsub();
  }, []);

  const activeTower = towers.find((t) => t.id === activeTowerId) || null;

  const handleOpenShop = (outOfShots = false) => {
    setShopOutOfShots(outOfShots);
    setShopOpen(true);
  };

  const handlePurchaseSuccess = (_credited: number, newBalance: number) => {
    soundEngine.playPurchaseChime();
    setShotsBalance(newBalance);
    if (user?.emailVerified) {
      void syncPlayerToFirestore(newBalance, 0).catch(() => {});
    }
  };

  const handleShotResolved = useCallback(
    (updatedTower: PublicTower, newBalance: number, totalShotsFired: number) => {
      setShotsBalance(newBalance);
      setTowers((prev) => prev.map((t) => (t.id === updatedTower.id ? updatedTower : t)));
      if (user?.emailVerified) {
        void syncPlayerToFirestore(newBalance, totalShotsFired).catch(() => {});
      }
    },
    [user]
  );

  const handleTowerCollapsedVictory = useCallback((collapsedTower: PublicTower) => {
    setTowers((prev) => prev.map((t) => (t.id === collapsedTower.id ? collapsedTower : t)));
    setVictoryTower(collapsedTower);
  }, []);

  const handleClaimCompleted = (winner: WinnerEntry, updatedTower: PublicTower) => {
    setWinners((prev) => [winner, ...prev]);
    setTowers((prev) => prev.map((t) => (t.id === updatedTower.id ? updatedTower : t)));
  };

  const handleSimulateWinReady = (tower: PublicTower, updatedShots?: number) => {
    setTowers((prev) => prev.map((t) => (t.id === tower.id ? tower : t)));
    if (typeof updatedShots === 'number') {
      setShotsBalance(updatedShots);
    }
    setActiveTowerId(tower.id);
    setAutoFireWin(true);
  };

  return (
    <>
      {activeTower ? (
        <TowerStage
          tower={activeTower}
          shotsBalance={shotsBalance}
          playerId={playerId}
          autoFireWinningShot={autoFireWin}
          onAutoFireConsumed={() => setAutoFireWin(false)}
          onBackToLobby={() => {
            setActiveTowerId(null);
            setVictoryTower(null);
            void fetchState(playerId);
          }}
          onOpenShop={handleOpenShop}
          onShotResolved={handleShotResolved}
          onTowerCollapsedVictory={handleTowerCollapsedVictory}
        />
      ) : (
        <LobbyView
          towers={towers}
          winners={winners}
          shotsBalance={shotsBalance}
          loading={loading}
          userEmail={user?.email || null}
          onGoogleAuthClick={() => void signInWithGooglePopup()}
          onGoogleSignOut={() => void signOutFirebase()}
          onEnterTower={(tower) => setActiveTowerId(tower.id)}
          onOpenShop={() => handleOpenShop(false)}
          onOpenAdmin={() => setAdminOpen(true)}
        />
      )}

      <ShopModal
        isOpen={shopOpen}
        onClose={() => setShopOpen(false)}
        shotsBalance={shotsBalance}
        onPurchaseSuccess={handlePurchaseSuccess}
        playerId={playerId}
        outOfShotsReason={shopOutOfShots}
      />

      <VictoryClaimModal
        isOpen={Boolean(victoryTower)}
        tower={victoryTower}
        onClose={() => {
          setVictoryTower(null);
          setActiveTowerId(null);
          void fetchState(playerId);
        }}
        onClaimCompleted={handleClaimCompleted}
      />

      <AdminModal
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
        activeTowerId={activeTowerId}
        playerId={playerId}
        onSimulateWinReady={handleSimulateWinReady}
        onTowersUpdated={() => void fetchState(playerId)}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
