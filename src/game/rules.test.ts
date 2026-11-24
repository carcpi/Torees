import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quantizeDamagePercent,
  getDamageConditionLabel,
  evaluateShotOnTower,
  validateClaimInput,
  isValidCryptoPurchaseMethod,
  calculateCannonAim,
  computeWearTier,
  syncDamageStateForTower,
} from './rules';
import { generateInitialTowerSeeds, getDefaultTargetShots, SHOP_PACKAGES } from './towersCatalog';

test('first 5 towers have exact mandated target_shots thresholds', () => {
  assert.equal(getDefaultTargetShots(1), 2200);
  assert.equal(getDefaultTargetShots(2), 4000);
  assert.equal(getDefaultTargetShots(3), 5000);
  assert.equal(getDefaultTargetShots(4), 5500);
  assert.equal(getDefaultTargetShots(5), 8000);
});

test('catalog generates 52 unique towers: 50 ACTIVA and 2 DERRIBADA', () => {
  const seeds = generateInitialTowerSeeds();
  assert.equal(seeds.length, 52);
  const active = seeds.filter((s) => s.status === 'ACTIVA');
  const collapsed = seeds.filter((s) => s.status === 'DERRIBADA');
  assert.equal(active.length, 50);
  assert.equal(collapsed.length, 2);

  const names = new Set(seeds.map((s) => s.name));
  assert.equal(names.size, 52);
  for (const s of seeds) {
    assert.ok(s.target_shots >= 2200 && s.target_shots <= 10000, `Tower ${s.towerNumber} target out of range: ${s.target_shots}`);
  }
});

test('proportional damage keeps structure firm at 30/2200 (~1.3%) and detaches lateral blocks at 50%-80%', () => {
  const early = syncDamageStateForTower({
    towerNumber: 1,
    currentShots: 30,
    targetShots: 2200,
    status: 'ACTIVA',
  });
  assert.equal(early.wearTier, 'INTACTA');
  assert.equal(early.detachedBlocks.length, 0);
  const earlyCrackUnits = Object.values(early.blockCracks).reduce((sum, b) => sum + b.crack, 0);
  assert.equal(earlyCrackUnits, 2);

  const mid = syncDamageStateForTower({
    towerNumber: 1,
    currentShots: 1320, // 60%
    targetShots: 2200,
    status: 'ACTIVA',
  });
  assert.equal(mid.wearTier, 'MORDIDA');
  assert.ok(mid.detachedBlocks.length >= 8 && mid.detachedBlocks.length <= 15);

  const late = syncDamageStateForTower({
    towerNumber: 1,
    currentShots: 1760, // 80%
    targetShots: 2200,
    status: 'ACTIVA',
  });
  assert.equal(late.wearTier, 'CRITICA');
  assert.ok(late.detachedBlocks.length >= 16 && late.detachedBlocks.length <= 20);
  assert.equal(computeWearTier(2200, 2200, 'DERRIBADA'), 'DERRIBADA');
});

test('shop has exactly 3 required packages', () => {
  assert.equal(SHOP_PACKAGES.length, 3);
  assert.deepEqual(
    SHOP_PACKAGES.map((p) => [p.name, p.shots, p.priceUsd]),
    [
      ['Paquete Inicial', 5, 5],
      ['Paquete Popular', 22, 20],
      ['Paquete Pro', 35, 30],
    ]
  );
});

test('shop accepts only NOWPayments crypto currencies (USDT, USDC, SOL, BTC)', () => {
  assert.equal(isValidCryptoPurchaseMethod('NOWPayments', 'USDT'), true);
  assert.equal(isValidCryptoPurchaseMethod('NOWPayments', 'USDC'), true);
  assert.equal(isValidCryptoPurchaseMethod('NOWPayments', 'SOL'), true);
  assert.equal(isValidCryptoPurchaseMethod('NOWPayments', 'BTC'), true);
  assert.equal(isValidCryptoPurchaseMethod('AstroPay', 'USDT'), false);
  assert.equal(isValidCryptoPurchaseMethod('NOWPayments', 'DOGE'), false);
});

test('quantizeDamagePercent hides exact target_shots by capping ACTIVA at 95% in 5% buckets', () => {
  assert.equal(quantizeDamagePercent(0, 2200, 'ACTIVA'), 0);
  assert.equal(quantizeDamagePercent(2199, 2200, 'ACTIVA'), 95);
  assert.equal(quantizeDamagePercent(2200, 2200, 'DERRIBADA'), 100);
  assert.equal(getDamageConditionLabel(95, 'ACTIVA'), 'Crítica');
  assert.equal(getDamageConditionLabel(100, 'DERRIBADA'), 'Colapsada');
});

test('evaluateShotOnTower collapses only at exact target_shots threshold', () => {
  const before = evaluateShotOnTower(2198, 2200, 'ACTIVA');
  assert.equal(before.nextShots, 2199);
  assert.equal(before.collapsed, false);
  assert.equal(before.nextStatus, 'ACTIVA');

  const exact = evaluateShotOnTower(2199, 2200, 'ACTIVA');
  assert.equal(exact.nextShots, 2200);
  assert.equal(exact.collapsed, true);
  assert.equal(exact.nextStatus, 'DERRIBADA');
  assert.equal(exact.damagePercent, 100);
});

test('validateClaimInput enforces required fields and NOWPayments/bank allowlist', () => {
  assert.equal(validateClaimInput({ winnerName: 'A', emailOrWallet: 'test@mail.com', payoutMethod: 'NOWPayments_USDT' }).valid, false);
  assert.equal(validateClaimInput({ winnerName: 'Carlos', emailOrWallet: 'x', payoutMethod: 'NOWPayments_USDT' }).valid, false);
  assert.equal(validateClaimInput({ winnerName: 'Carlos', emailOrWallet: 'carlos@mail.com', payoutMethod: 'AstroPay' }).valid, false);
  assert.equal(validateClaimInput({ winnerName: 'Carlos', emailOrWallet: '0x1234abcd', payoutMethod: 'NOWPayments_SOL' }).valid, true);
});

test('calculateCannonAim always fires upward within clamped arc', () => {
  const aim = calculateCannonAim(500, 600, 500, 300, 20);
  assert.ok(aim.vy < 0);
  assert.ok(Math.abs(aim.vx) < 0.01);
});
