import type { TowerStatus } from './towersCatalog.ts';

export type WearTier = 'INTACTA' | 'AGRIETADA' | 'MORDIDA' | 'CRITICA' | 'DERRIBADA';

export interface BlockCrackInfo {
  crack: number; // 0..3
  bite: number;  // 4-bit corner mask 0..15
}

export const TOWER_GRID_ROWS = 9;
export const TOWER_GRID_COLS = 4;

/**
 * List of detachable outer/top block indices (row * 4 + col).
 * Core spine (col 1 & 2, rows 0..7) never detaches until current_shots == target_shots.
 */
export function isOuterBlockIndex(index: number): boolean {
  const row = Math.floor(index / TOWER_GRID_COLS);
  const col = index % TOWER_GRID_COLS;
  return col === 0 || col === TOWER_GRID_COLS - 1 || row === TOWER_GRID_ROWS - 1;
}

export const DETACHABLE_BLOCK_INDICES: number[] = (() => {
  const list: number[] = [];
  for (let r = TOWER_GRID_ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < TOWER_GRID_COLS; c++) {
      const idx = r * TOWER_GRID_COLS + c;
      if (isOuterBlockIndex(idx)) {
        list.push(idx);
      }
    }
  }
  return list;
})();

export function computeWearTier(
  currentShots: number,
  targetShots: number,
  status: TowerStatus
): WearTier {
  if (status === 'DERRIBADA') return 'DERRIBADA';
  if (targetShots <= 0) return 'INTACTA';
  const ratio = Math.max(0, Math.min(0.9999, currentShots / targetShots));
  if (ratio >= 0.72) return 'CRITICA';
  if (ratio >= 0.45) return 'MORDIDA';
  if (ratio >= 0.15) return 'AGRIETADA';
  return 'INTACTA';
}

/**
 * Calibrates detached outer block count strictly proportional to (current_shots / target_shots).
 * Under 4% progress (e.g. 30 / 2200 = 1.36%), 0 full outer blocks detach; core stays firm.
 * Between 50% and 80%, 7 to 16 lateral/top blocks detach leaving the tower thin and unstable.
 */
export function getTargetDetachedCount(ratio: number, status: TowerStatus): number {
  if (status === 'DERRIBADA') return DETACHABLE_BLOCK_INDICES.length;
  const r = Math.max(0, Math.min(0.9999, ratio));
  if (r < 0.04) return 0;
  if (r < 0.25) return Math.floor(((r - 0.04) / 0.21) * 3) + 1;
  if (r < 0.5) return 3 + Math.floor(((r - 0.25) / 0.25) * 4);
  if (r < 0.8) return 7 + Math.floor(((r - 0.5) / 0.3) * 9);
  return Math.min(DETACHABLE_BLOCK_INDICES.length, 16 + Math.floor(((r - 0.8) / 0.2) * 4));
}

/**
 * Calibrates cumulative crack units (max 108 across 36 blocks x 3 levels) proportional to ratio.
 * At 30 / 2200 (~1.36%), yields only 2 superficial crack units.
 */
export function getTargetCrackUnits(ratio: number, status: TowerStatus): number {
  if (status === 'DERRIBADA') return 108;
  const r = Math.max(0, Math.min(0.9999, ratio));
  if (r <= 0) return 0;
  return Math.min(108, Math.max(1, Math.ceil(r * 110)));
}

export function computeLeanFromDetached(detachedBlocks: number[]): number {
  let bias = 0;
  for (const idx of detachedBlocks) {
    const col = idx % TOWER_GRID_COLS;
    if (col === 0) bias -= 0.7;
    else if (col === TOWER_GRID_COLS - 1) bias += 0.7;
    else if (col === 1) bias -= 0.25;
    else bias += 0.25;
  }
  return Math.max(-6, Math.min(6, Number(bias.toFixed(2))));
}

export interface SyncDamageParams {
  towerNumber: number;
  currentShots: number;
  targetShots: number;
  status: TowerStatus;
  existingDetached?: number[];
  existingCracks?: Record<string, BlockCrackInfo>;
  impactRow?: number;
  impactCol?: number;
}

export interface SyncDamageOutput {
  wearTier: WearTier;
  detachedBlocks: number[];
  blockCracks: Record<string, BlockCrackInfo>;
  leanLevel: number;
  newlyDetached: number[];
  newlyCracked: number[];
}

export function syncDamageStateForTower(params: SyncDamageParams): SyncDamageOutput {
  const {
    towerNumber,
    currentShots,
    targetShots,
    status,
    existingDetached = [],
    existingCracks = {},
    impactRow,
    impactCol,
  } = params;

  const ratio = targetShots > 0 ? Math.max(0, Math.min(1, currentShots / targetShots)) : 0;
  const wearTier = computeWearTier(currentShots, targetShots, status);
  const targetDetached = getTargetDetachedCount(ratio, status);
  const targetCracks = getTargetCrackUnits(ratio, status);

  const detachedSet = new Set<number>(existingDetached.filter((n) => isOuterBlockIndex(n)));
  const newlyDetached: number[] = [];

  if (detachedSet.size > targetDetached) {
    // Trim excess if target_shots was raised by admin
    const kept = Array.from(detachedSet).slice(0, targetDetached);
    detachedSet.clear();
    for (const id of kept) detachedSet.add(id);
  } else if (detachedSet.size < targetDetached) {
    const candidates = DETACHABLE_BLOCK_INDICES.filter((idx) => !detachedSet.has(idx));
    if (typeof impactRow === 'number' && typeof impactCol === 'number') {
      candidates.sort((a, b) => {
        const ra = Math.floor(a / TOWER_GRID_COLS);
        const ca = a % TOWER_GRID_COLS;
        const rb = Math.floor(b / TOWER_GRID_COLS);
        const cb = b % TOWER_GRID_COLS;
        return Math.hypot(ra - impactRow, ca - impactCol) - Math.hypot(rb - impactRow, cb - impactCol);
      });
    } else {
      // Deterministic varied order per towerNumber
      candidates.sort((a, b) => {
        const ha = ((a * 37 + towerNumber * 13) % 41);
        const hb = ((b * 37 + towerNumber * 13) % 41);
        return ha - hb;
      });
    }

    while (detachedSet.size < targetDetached && candidates.length > 0) {
      const pick = candidates.shift()!;
      detachedSet.add(pick);
      newlyDetached.push(pick);
    }
  }

  // Clone cracks map
  const blockCracks: Record<string, BlockCrackInfo> = {};
  let currentCrackUnits = 0;
  for (const [k, v] of Object.entries(existingCracks)) {
    const c = Math.max(0, Math.min(3, v.crack));
    if (c > 0) {
      blockCracks[k] = { crack: c, bite: v.bite & 15 };
      currentCrackUnits += c;
    }
  }

  const newlyCracked: number[] = [];
  if (currentCrackUnits > targetCracks) {
    // Reset cleanly to targetCracks if admin raised target_shots
    for (const k of Object.keys(blockCracks)) delete blockCracks[k];
    currentCrackUnits = 0;
  }

  if (currentCrackUnits < targetCracks) {
    const allIndices = Array.from({ length: TOWER_GRID_ROWS * TOWER_GRID_COLS }, (_, i) => i);
    if (typeof impactRow === 'number' && typeof impactCol === 'number') {
      allIndices.sort((a, b) => {
        const ra = Math.floor(a / TOWER_GRID_COLS);
        const ca = a % TOWER_GRID_COLS;
        const rb = Math.floor(b / TOWER_GRID_COLS);
        const cb = b % TOWER_GRID_COLS;
        const da = (detachedSet.has(a) ? 50 : 0) + Math.hypot(ra - impactRow, ca - impactCol);
        const db = (detachedSet.has(b) ? 50 : 0) + Math.hypot(rb - impactRow, cb - impactCol);
        return da - db;
      });
    } else {
      allIndices.sort((a, b) => ((a * 29 + towerNumber * 7) % 37) - ((b * 29 + towerNumber * 7) % 37));
    }

    let cursor = 0;
    let safety = 0;
    while (currentCrackUnits < targetCracks && safety < 200) {
      safety += 1;
      const idx = allIndices[cursor % allIndices.length];
      cursor += 1;
      const key = String(idx);
      const entry = blockCracks[key] ?? { crack: 0, bite: 0 };
      if (entry.crack < 3) {
        entry.crack += 1;
        // Add corner bite if ratio >= 0.08 or detached
        if (ratio >= 0.08 || detachedSet.has(idx)) {
          const bit = 1 << ((idx + entry.crack + towerNumber) % 4);
          entry.bite = (entry.bite | bit) & 15;
        }
        blockCracks[key] = entry;
        currentCrackUnits += 1;
        newlyCracked.push(idx);
      }
    }
  }

  const detachedBlocks = Array.from(detachedSet);
  const leanLevel = computeLeanFromDetached(detachedBlocks);

  return {
    wearTier,
    detachedBlocks,
    blockCracks,
    leanLevel,
    newlyDetached,
    newlyCracked,
  };
}

/**
 * Quantizes tower damage into coarse 5% increments (capped at 95% while ACTIVA)
 * for internal Firestore schema compatibility without exposing exact target_shots.
 */
export function quantizeDamagePercent(
  currentShots: number,
  targetShots: number,
  status: TowerStatus
): number {
  if (status === 'DERRIBADA') return 100;
  if (targetShots <= 0) return 0;
  const rawRatio = Math.max(0, Math.min(0.9999, currentShots / targetShots));
  const bucket = Math.floor(rawRatio * 20) * 5;
  return Math.min(95, Math.max(0, bucket));
}

export function getDamageConditionLabel(damagePercent: number, status: TowerStatus): string {
  if (status === 'DERRIBADA' || damagePercent >= 100) return 'Colapsada';
  if (damagePercent >= 75) return 'Crítica';
  if (damagePercent >= 45) return 'Inestable';
  if (damagePercent >= 15) return 'Agrietada';
  return 'Sólida';
}

export interface ShotEvaluationResult {
  nextShots: number;
  collapsed: boolean;
  nextStatus: TowerStatus;
  damagePercent: number;
}

export function evaluateShotOnTower(
  currentShots: number,
  targetShots: number,
  currentStatus: TowerStatus
): ShotEvaluationResult {
  if (currentStatus === 'DERRIBADA') {
    return {
      nextShots: currentShots,
      collapsed: false,
      nextStatus: 'DERRIBADA',
      damagePercent: 100,
    };
  }

  const nextShots = currentShots + 1;
  const collapsed = nextShots >= targetShots;
  const nextStatus: TowerStatus = collapsed ? 'DERRIBADA' : 'ACTIVA';

  return {
    nextShots,
    collapsed,
    nextStatus,
    damagePercent: quantizeDamagePercent(nextShots, targetShots, nextStatus),
  };
}

export interface ClaimValidationInput {
  winnerName: string;
  emailOrWallet: string;
  payoutMethod: string;
}

export interface ClaimValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_PAYOUT_METHODS = new Set([
  'NOWPayments_USDT',
  'NOWPayments_USDC',
  'NOWPayments_SOL',
  'NOWPayments_BTC',
  'BankTransfer',
]);

const ALLOWED_CRYPTO_CURRENCIES = new Set(['USDT', 'USDC', 'SOL', 'BTC']);

export function isValidCryptoPurchaseMethod(paymentMethod: unknown, cryptoCurrency: unknown): boolean {
  return (
    paymentMethod === 'NOWPayments' &&
    typeof cryptoCurrency === 'string' &&
    ALLOWED_CRYPTO_CURRENCIES.has(cryptoCurrency)
  );
}

export function validateClaimInput(input: ClaimValidationInput): ClaimValidationResult {
  const name = input.winnerName.trim();
  const contact = input.emailOrWallet.trim();

  if (name.length < 2 || name.length > 60) {
    return { valid: false, error: 'Ingresa un nombre válido (2 a 60 caracteres).' };
  }
  if (contact.length < 4 || contact.length > 120) {
    return { valid: false, error: 'Ingresa un correo o dirección de wallet válida.' };
  }
  if (!ALLOWED_PAYOUT_METHODS.has(input.payoutMethod)) {
    return { valid: false, error: 'Selecciona un método de retiro válido.' };
  }
  return { valid: true };
}

export interface CannonAimResult {
  angle: number;
  vx: number;
  vy: number;
}

export function calculateCannonAim(
  cannonX: number,
  cannonY: number,
  targetX: number,
  targetY: number,
  speed = 26
): CannonAimResult {
  const dx = targetX - cannonX;
  const dy = Math.min(-24, targetY - cannonY); // Always shoot upward
  const rawAngle = Math.atan2(dy, dx);
  // Clamp between -160 deg and -20 deg
  const minAngle = -Math.PI + 0.34;
  const maxAngle = -0.34;
  const angle = Math.max(minAngle, Math.min(maxAngle, rawAngle));

  return {
    angle,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}
