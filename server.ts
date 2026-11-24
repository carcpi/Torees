import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { getApps, getApp, initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import {
  generateInitialTowerSeeds,
  INITIAL_WINNERS,
  SHOP_PACKAGES,
  type AdminTower,
  type PublicTower,
  type TowerStatus,
  type WinnerEntry,
} from './src/game/towersCatalog.ts';
import {
  evaluateShotOnTower,
  isValidCryptoPurchaseMethod,
  syncDamageStateForTower,
  validateClaimInput,
  type BlockCrackInfo,
  type WearTier,
} from './src/game/rules.ts';

interface StoredTowerRecord {
  id: string;
  towerNumber: number;
  name: string;
  material: PublicTower['material'];
  character: PublicTower['character'];
  palette: PublicTower['palette'];
  current_shots: number;
  target_shots: number;
  status: TowerStatus;
  wearTier: WearTier;
  leanLevel: number;
  detachedBlocks: number[];
  blockCracks: Record<string, BlockCrackInfo>;
  winnerName?: string;
}

interface ClaimRecord {
  id: string;
  towerId: string;
  towerNumber: number;
  winnerName: string;
  emailOrWallet: string;
  payoutMethod: string;
  status: 'PENDIENTE' | 'VERIFICADO' | 'PAGADO';
  createdAt: string;
}

interface PlayerState {
  shotsBalance: number;
  totalShotsFired: number;
}

interface PersistedState {
  towers: StoredTowerRecord[];
  winners: WinnerEntry[];
  claims: ClaimRecord[];
  players: Record<string, PlayerState>;
  adminCredentialHash?: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'tower_drop_state.json');
const ADMIN_EMAIL = 'alejandrocarcini@hotmail.com';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function getFirebaseProjectId(): string | null {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { projectId?: string };
    if (!raw.projectId || raw.projectId === 'remixed-project-id') return null;
    return raw.projectId;
  } catch {
    return null;
  }
}

const firebaseProjectId = getFirebaseProjectId();
const adminApp = firebaseProjectId
  ? getApps().length
    ? getApp()
    : initAdminApp({ projectId: firebaseProjectId })
  : null;

function loadOrInitState(): PersistedState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as PersistedState;
      if (
        Array.isArray(parsed.towers) &&
        parsed.towers.length === 52 &&
        Array.isArray(parsed.towers[0]?.detachedBlocks)
      ) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load persisted state, initializing fresh catalog:', err);
  }

  const fresh: PersistedState = {
    towers: generateInitialTowerSeeds(),
    winners: [...INITIAL_WINNERS],
    claims: [],
    players: {},
  };
  saveState(fresh);
  return fresh;
}

function saveState(state: PersistedState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

const dbState = loadOrInitState();

function toPublicTower(t: StoredTowerRecord): PublicTower {
  // Strictly strip target_shots and numeric percentage so exact target remains secret
  return {
    id: t.id,
    towerNumber: t.towerNumber,
    name: t.name,
    material: t.material,
    character: t.character,
    palette: t.palette,
    current_shots: t.current_shots,
    status: t.status,
    wearTier: t.wearTier,
    leanLevel: t.leanLevel,
    detachedBlocks: t.detachedBlocks,
    blockCracks: t.blockCracks,
    ...(t.winnerName ? { winnerName: t.winnerName } : {}),
  };
}

function toAdminTower(t: StoredTowerRecord): AdminTower {
  return {
    ...toPublicTower(t),
    target_shots: t.target_shots,
    remaining_shots: Math.max(0, t.target_shots - t.current_shots),
  };
}

function getOrCreatePlayer(playerId: string): PlayerState {
  const safeId = playerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'guest_default';
  if (!dbState.players[safeId]) {
    dbState.players[safeId] = {
      shotsBalance: 10,
      totalShotsFired: 0,
    };
    saveState(dbState);
  }
  return dbState.players[safeId];
}

function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasscodeHash(passcode: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(passcode, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function timingSafeStringMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signAdminToken(subject: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: subject,
      role: 'admin',
      exp: Date.now() + 1000 * 60 * 60 * 4,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (!timingSafeStringMatch(sig, expectedSig)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Acceso restringido. Inicia sesión como administrador.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!verifyAdminToken(token)) {
    res.status(403).json({ error: 'Sesión de administrador inválida o expirada.' });
    return;
  }
  next();
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/state', (req, res) => {
    const playerId = typeof req.query.playerId === 'string' ? req.query.playerId : 'guest_default';
    const player = getOrCreatePlayer(playerId);
    res.json({
      towers: dbState.towers.map(toPublicTower),
      winners: dbState.winners.slice(0, 20),
      shotsBalance: player.shotsBalance,
      totalShotsFired: player.totalShotsFired,
    });
  });

  app.post('/api/purchase', (req, res) => {
    const { playerId, packageId, paymentMethod, cryptoCurrency } = req.body as {
      playerId?: unknown;
      packageId?: unknown;
      paymentMethod?: unknown;
      cryptoCurrency?: unknown;
    };
    if (typeof playerId !== 'string' || typeof packageId !== 'string') {
      res.status(400).json({ error: 'Parámetros de compra inválidos.' });
      return;
    }
    if (!isValidCryptoPurchaseMethod(paymentMethod, cryptoCurrency)) {
      res.status(400).json({ error: 'Solo se aceptan pagos con criptomonedas vía NOWPayments (USDT, USDC, SOL, BTC).' });
      return;
    }
    const pkg = SHOP_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      res.status(404).json({ error: 'Paquete no encontrado.' });
      return;
    }

    const player = getOrCreatePlayer(playerId);
    player.shotsBalance += pkg.shots;
    saveState(dbState);

    res.json({
      ok: true,
      creditedShots: pkg.shots,
      shotsBalance: player.shotsBalance,
      paymentMethod,
      cryptoCurrency,
    });
  });

  app.post('/api/shoot', (req, res) => {
    const { playerId, towerId, impactRow, impactCol } = req.body as {
      playerId?: unknown;
      towerId?: unknown;
      impactRow?: unknown;
      impactCol?: unknown;
    };
    if (typeof playerId !== 'string' || typeof towerId !== 'string') {
      res.status(400).json({ error: 'Solicitud de disparo inválida.' });
      return;
    }

    const player = getOrCreatePlayer(playerId);
    if (player.shotsBalance <= 0) {
      res.status(402).json({
        error: 'No te quedan tiros disponibles.',
        needsPurchase: true,
        shotsBalance: 0,
      });
      return;
    }

    const tower = dbState.towers.find((t) => t.id === towerId);
    if (!tower) {
      res.status(404).json({ error: 'Torre no encontrada.' });
      return;
    }
    if (tower.status === 'DERRIBADA') {
      res.status(409).json({
        error: 'Esta torre ya fue derribada.',
        tower: toPublicTower(tower),
        shotsBalance: player.shotsBalance,
      });
      return;
    }

    player.shotsBalance -= 1;
    player.totalShotsFired += 1;

    const evalResult = evaluateShotOnTower(tower.current_shots, tower.target_shots, tower.status);
    tower.current_shots = evalResult.nextShots;
    tower.status = evalResult.nextStatus;

    const damageSync = syncDamageStateForTower({
      towerNumber: tower.towerNumber,
      currentShots: tower.current_shots,
      targetShots: tower.target_shots,
      status: tower.status,
      existingDetached: tower.detachedBlocks,
      existingCracks: tower.blockCracks,
      impactRow: typeof impactRow === 'number' ? impactRow : undefined,
      impactCol: typeof impactCol === 'number' ? impactCol : undefined,
    });

    tower.wearTier = damageSync.wearTier;
    tower.detachedBlocks = damageSync.detachedBlocks;
    tower.blockCracks = damageSync.blockCracks;
    tower.leanLevel = damageSync.leanLevel;

    saveState(dbState);

    res.json({
      ok: true,
      collapsed: evalResult.collapsed,
      shotsBalance: player.shotsBalance,
      totalShotsFired: player.totalShotsFired,
      newlyDetached: damageSync.newlyDetached,
      newlyCracked: damageSync.newlyCracked,
      tower: toPublicTower(tower),
    });
  });

  app.post('/api/claim', (req, res) => {
    const { towerId, winnerName, emailOrWallet, payoutMethod } = req.body as {
      towerId?: unknown;
      winnerName?: unknown;
      emailOrWallet?: unknown;
      payoutMethod?: unknown;
    };

    if (
      typeof towerId !== 'string' ||
      typeof winnerName !== 'string' ||
      typeof emailOrWallet !== 'string' ||
      typeof payoutMethod !== 'string'
    ) {
      res.status(400).json({ error: 'Campos de reclamo inválidos.' });
      return;
    }

    const validation = validateClaimInput({ winnerName, emailOrWallet, payoutMethod });
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const tower = dbState.towers.find((t) => t.id === towerId);
    if (!tower || tower.status !== 'DERRIBADA') {
      res.status(400).json({ error: 'Solo puedes reclamar premios de torres recién derribadas.' });
      return;
    }

    const cleanName = winnerName.trim();
    const claimId = `clm_${crypto.randomBytes(6).toString('hex')}`;
    const createdAt = new Date().toISOString();

    dbState.claims.unshift({
      id: claimId,
      towerId: tower.id,
      towerNumber: tower.towerNumber,
      winnerName: cleanName,
      emailOrWallet: emailOrWallet.trim(),
      payoutMethod,
      status: 'PENDIENTE',
      createdAt,
    });

    tower.winnerName = cleanName;
    const winnerEntry: WinnerEntry = {
      id: `win_${claimId}`,
      towerId: tower.id,
      towerNumber: tower.towerNumber,
      towerName: tower.name,
      winnerName: cleanName,
      prizeAmount: 1000,
      createdAt,
    };
    dbState.winners.unshift(winnerEntry);
    saveState(dbState);

    res.json({
      ok: true,
      claimId,
      winner: winnerEntry,
      tower: toPublicTower(tower),
    });
  });

  // Admin Demo routes
  app.get('/api/admin/status', (_req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      res.json({ needsSetup: false, mode: 'env' });
      return;
    }
    if (dbState.adminCredentialHash) {
      res.json({ needsSetup: false, mode: 'claimed' });
      return;
    }
    res.json({ needsSetup: true, mode: 'needs_setup' });
  });

  app.post('/api/admin/setup', (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode || dbState.adminCredentialHash) {
      res.status(409).json({ error: 'La clave de administrador ya fue configurada.' });
      return;
    }

    const { passcode } = req.body as { passcode?: unknown };
    if (typeof passcode !== 'string' || passcode.trim().length < 4 || passcode.trim().length > 64) {
      res.status(400).json({ error: 'La clave debe tener entre 4 y 64 caracteres.' });
      return;
    }

    dbState.adminCredentialHash = hashPasscode(passcode.trim());
    saveState(dbState);

    const token = signAdminToken('admin-passcode');
    res.json({ ok: true, token });
  });

  app.post('/api/admin/login', async (req, res) => {
    const { passcode, firebaseIdToken } = req.body as {
      passcode?: unknown;
      firebaseIdToken?: unknown;
    };

    if (typeof firebaseIdToken === 'string' && firebaseIdToken.length > 0 && adminApp) {
      try {
        const decoded = await getAdminAuth(adminApp).verifyIdToken(firebaseIdToken);
        if (decoded.email === ADMIN_EMAIL && decoded.email_verified === true) {
          const token = signAdminToken(decoded.uid);
          res.json({ ok: true, token });
          return;
        }
        res.status(403).json({ error: 'Tu cuenta Google no tiene permisos de administrador.' });
        return;
      } catch {
        res.status(401).json({ error: 'Token de Firebase inválido.' });
        return;
      }
    }

    if (typeof passcode !== 'string' || passcode.trim().length === 0) {
      res.status(400).json({ error: 'Ingresa la clave de administrador.' });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      if (timingSafeStringMatch(passcode.trim(), envPasscode)) {
        res.json({ ok: true, token: signAdminToken('admin-env') });
        return;
      }
      res.status(401).json({ error: 'Clave incorrecta.' });
      return;
    }

    if (!dbState.adminCredentialHash) {
      res.status(400).json({ error: 'Configura primero la clave de administrador.' });
      return;
    }

    if (!verifyPasscodeHash(passcode.trim(), dbState.adminCredentialHash)) {
      res.status(401).json({ error: 'Clave incorrecta.' });
      return;
    }

    res.json({ ok: true, token: signAdminToken('admin-claimed') });
  });

  app.get('/api/admin/towers', requireAdminAuth, (_req, res) => {
    res.json({
      towers: dbState.towers.map(toAdminTower),
      claims: dbState.claims.slice(0, 30),
    });
  });

  app.patch('/api/admin/towers/:id', requireAdminAuth, (req, res) => {
    const tower = dbState.towers.find((t) => t.id === req.params.id);
    if (!tower) {
      res.status(404).json({ error: 'Torre no encontrada.' });
      return;
    }

    const { target_shots, reset } = req.body as {
      target_shots?: unknown;
      reset?: unknown;
    };

    if (typeof target_shots === 'number' && Number.isInteger(target_shots)) {
      if (target_shots < 1 || target_shots > 1000000) {
        res.status(400).json({ error: 'La meta debe estar entre 1 y 1,000,000.' });
        return;
      }
      tower.target_shots = target_shots;
      if (tower.current_shots >= tower.target_shots) {
        tower.current_shots = Math.max(0, tower.target_shots - 1);
      }
    }

    if (reset === true) {
      tower.current_shots = 0;
      tower.status = 'ACTIVA';
      tower.detachedBlocks = [];
      tower.blockCracks = {};
      delete tower.winnerName;
    }

    const synced = syncDamageStateForTower({
      towerNumber: tower.towerNumber,
      currentShots: tower.current_shots,
      targetShots: tower.target_shots,
      status: tower.status,
      existingDetached: reset === true ? [] : tower.detachedBlocks,
      existingCracks: reset === true ? {} : tower.blockCracks,
    });
    tower.wearTier = synced.wearTier;
    tower.detachedBlocks = synced.detachedBlocks;
    tower.blockCracks = synced.blockCracks;
    tower.leanLevel = synced.leanLevel;

    saveState(dbState);
    res.json({
      ok: true,
      tower: toAdminTower(tower),
    });
  });

  app.post('/api/admin/simulate-win/:id', requireAdminAuth, (req, res) => {
    const { playerId } = req.body as { playerId?: unknown };
    const tower = dbState.towers.find((t) => t.id === req.params.id);
    if (!tower) {
      res.status(404).json({ error: 'Torre no encontrada.' });
      return;
    }

    // Arm the tower to 1 shot before collapse so the winning shot hits current_shots == target_shots
    tower.status = 'ACTIVA';
    delete tower.winnerName;
    tower.current_shots = Math.max(0, tower.target_shots - 1);
    const synced = syncDamageStateForTower({
      towerNumber: tower.towerNumber,
      currentShots: tower.current_shots,
      targetShots: tower.target_shots,
      status: tower.status,
      existingDetached: tower.detachedBlocks,
      existingCracks: tower.blockCracks,
    });
    tower.wearTier = synced.wearTier;
    tower.detachedBlocks = synced.detachedBlocks;
    tower.blockCracks = synced.blockCracks;
    tower.leanLevel = synced.leanLevel;

    let shotsBalance: number | undefined;
    if (typeof playerId === 'string') {
      const player = getOrCreatePlayer(playerId);
      if (player.shotsBalance < 1) {
        player.shotsBalance = 1;
      }
      shotsBalance = player.shotsBalance;
    }

    saveState(dbState);
    res.json({
      ok: true,
      tower: toAdminTower(tower),
      publicTower: toPublicTower(tower),
      shotsBalance,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TOWER DROP 1000 server running on http://0.0.0.0:${PORT}`);
  });
}

void createServer();
