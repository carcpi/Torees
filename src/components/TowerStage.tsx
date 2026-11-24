import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { Plus, Volume2, VolumeX, Crosshair } from 'lucide-react';
import {
  CHARACTERS,
  MATERIALS,
  type CharacterId,
  type MaterialId,
  type PublicTower,
} from '../game/towersCatalog';
import { calculateCannonAim, TOWER_GRID_COLS, TOWER_GRID_ROWS } from '../game/rules';
import { soundEngine } from '../game/soundEngine';

interface TowerStageProps {
  tower: PublicTower;
  shotsBalance: number;
  playerId: string;
  autoFireWinningShot: boolean;
  onAutoFireConsumed: () => void;
  onBackToLobby: () => void;
  onOpenShop: (outOfShots: boolean) => void;
  onShotResolved: (updatedTower: PublicTower, newBalance: number, totalShotsFired: number) => void;
  onTowerCollapsedVictory: (collapsedTower: PublicTower) => void;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  vAngle: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'debris' | 'confetti' | 'smoke';
}

interface ActiveProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  active: boolean;
  willCollapse: boolean;
}

const PARTICLE_POOL_SIZE = 320;

export const TowerStage: React.FC<TowerStageProps> = ({
  tower,
  shotsBalance,
  playerId,
  autoFireWinningShot,
  onAutoFireConsumed,
  onBackToLobby,
  onOpenShop,
  onShotResolved,
  onTowerCollapsedVictory,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [muted, setMuted] = useState(soundEngine.isMuted());
  const [isCollapsing, setIsCollapsing] = useState(false);

  // Refs for latest props inside 60Hz loop without tearing down Matter.js world
  const towerRef = useRef(tower);
  towerRef.current = tower;
  const shotsBalanceRef = useRef(shotsBalance);
  shotsBalanceRef.current = shotsBalance;
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;

  const callbacksRef = useRef({
    onOpenShop,
    onShotResolved,
    onTowerCollapsedVictory,
  });
  callbacksRef.current = {
    onOpenShop,
    onShotResolved,
    onTowerCollapsedVictory,
  };

  // Simulation mutable refs accessible by both pointer handler & auto-win trigger
  const simApiRef = useRef<{
    fireAt: (clientX: number, clientY: number, isViewportCoords?: boolean) => void;
    triggerSimulatedShot: () => void;
    syncTower: (nextTower: PublicTower) => void;
  } | null>(null);

  useEffect(() => {
    document.body.dataset.state = isCollapsing ? 'gameover' : 'playing';
    return () => {
      document.body.dataset.state = 'lobby';
    };
  }, [isCollapsing]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // Offscreen background cache so gradients aren't recomputed at 60Hz
    const bgCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d');

    const rebuildBackgroundCache = () => {
      if (!bgCtx) return;
      bgCanvas.width = Math.max(1, Math.floor(width * dpr));
      bgCanvas.height = Math.max(1, Math.floor(height * dpr));
      bgCtx.save();
      bgCtx.scale(dpr, dpr);
      const pal = towerRef.current.palette;
      const gY = height - 154;
      const cX = width / 2;

      const skyGrad = bgCtx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, pal.skyTop);
      skyGrad.addColorStop(1, pal.skyBottom);
      bgCtx.fillStyle = skyGrad;
      bgCtx.fillRect(0, 0, width, height);

      const glowGrad = bgCtx.createRadialGradient(cX, gY, 20, cX, gY, Math.max(width, height) * 0.48);
      glowGrad.addColorStop(0, `${pal.horizonGlow}33`);
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      bgCtx.fillStyle = glowGrad;
      bgCtx.fillRect(0, 0, width, height);

      bgCtx.fillStyle = pal.platformColor;
      bgCtx.fillRect(0, gY, width, height - gY);
      bgCtx.strokeStyle = 'rgba(255,255,255,0.16)';
      bgCtx.lineWidth = 2;
      bgCtx.beginPath();
      bgCtx.moveTo(0, gY);
      bgCtx.lineTo(width, gY);
      bgCtx.stroke();
      bgCtx.restore();
    };

    let groundY = height - 154;
    let cannonY = height - 72;
    let centerX = width / 2;
    const rows = TOWER_GRID_ROWS;
    const cols = TOWER_GRID_COLS;
    const blockW = Math.max(36, Math.min(50, Math.floor(width * 0.038)));
    const blockH = Math.max(24, Math.min(34, Math.floor(height * 0.04)));
    let towerTopY = groundY - rows * (blockH + 1);

    interface TowerBlock {
      index: number;
      body: Matter.Body;
      row: number;
      col: number;
      homeDx: number;
      homeY: number;
      spring?: Matter.Constraint;
      isOuterOrCorner: boolean;
      detached: boolean;
      crackLevel: number;
      biteCorners: number;
    }

    interface ChippedFragment {
      body: Matter.Body;
      fill: string;
      stroke: string;
      w: number;
      h: number;
    }

    const blocks: TowerBlock[] = [];
    const chippedFragments: ChippedFragment[] = [];
    const anchorConstraints: Matter.Constraint[] = [];
    let leanBias = tower.leanLevel ?? 0;

    // Matter.js Physics Setup
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.35 },
    });
    const world = engine.world;
    const mat = MATERIALS[tower.material];

    const floorBody = Matter.Bodies.rectangle(centerX, groundY + 40, width * 3, 80, {
      isStatic: true,
      friction: 0.9,
      restitution: 0.15,
    });
    const leftWall = Matter.Bodies.rectangle(-40, height / 2, 80, height * 3, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(width + 40, height / 2, 80, height * 3, { isStatic: true });
    Matter.Composite.add(world, [floorBody, leftWall, rightWall]);

    const startCollapsed = tower.status === 'DERRIBADA';
    const persistedDetachedSet = new Set<number>(tower.detachedBlocks ?? []);
    const persistedCracks = tower.blockCracks ?? {};
    const initialClampedLean = Math.max(-6, Math.min(6, leanBias));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const homeDx = (c - (cols - 1) / 2) * (blockW + 2);
        const homeY = groundY - blockH / 2 - r * (blockH + 1);
        const heightRatio = r / Math.max(1, rows - 1);
        const leanedX = centerX + homeDx + initialClampedLean * heightRatio * 4.5;
        const leanedY = homeY + Math.abs(initialClampedLean) * heightRatio * 0.65;
        const isOuterOrCorner = c === 0 || c === cols - 1 || r === rows - 1;
        const isPersistedDetached = !startCollapsed && persistedDetachedSet.has(idx);
        const isDetachedOnInit = startCollapsed || isPersistedDetached;

        let initX = leanedX;
        let initY = leanedY;
        let initAngle = 0;
        if (startCollapsed) {
          initX = centerX + homeDx + (Math.random() - 0.5) * 210;
          initY = groundY - 20 - Math.random() * 75;
          initAngle = (Math.random() - 0.5) * 1.6;
        } else if (isPersistedDetached) {
          // Rest fallen outer blocks naturally on the ground beside the tower
          const sideSign = c < cols / 2 ? -1 : 1;
          const spread = 85 + ((idx * 29) % 95);
          initX = centerX + sideSign * spread;
          initY = groundY - blockH / 2 - ((idx % 3) * 4);
          initAngle = sideSign * (0.22 + ((idx * 17) % 10) * 0.04);
        }

        const body = Matter.Bodies.rectangle(
          initX,
          initY,
          blockW,
          blockH,
          {
            density: mat.density,
            restitution: mat.restitution,
            friction: mat.friction,
            frictionAir: 0.025,
            angle: initAngle,
          }
        );
        let spring: Matter.Constraint | undefined;
        Matter.Composite.add(world, body);

        if (!isDetachedOnInit) {
          spring = Matter.Constraint.create({
            pointA: { x: leanedX, y: leanedY },
            bodyB: body,
            stiffness: 0.075,
            damping: 0.18,
            length: 0,
          });
          anchorConstraints.push(spring);
          Matter.Composite.add(world, spring);
        }

        const savedCrack = persistedCracks[String(idx)];
        blocks.push({
          index: idx,
          body,
          row: r,
          col: c,
          homeDx,
          homeY,
          spring,
          isOuterOrCorner,
          detached: isDetachedOnInit,
          crackLevel: startCollapsed ? 3 : savedCrack?.crack ?? (isPersistedDetached ? 3 : 0),
          biteCorners: startCollapsed ? (1 | 4) : savedCrack?.bite ?? (isPersistedDetached ? (1 | 4) : 0),
        });
      }
    }

    const charHomeY = towerTopY - 22;
    const initialCharX = startCollapsed ? centerX + 120 : centerX + initialClampedLean * 4.5;
    const initialCharY = startCollapsed ? groundY - 24 : charHomeY + Math.abs(initialClampedLean) * 0.65;
    const charBody = Matter.Bodies.circle(
      initialCharX,
      initialCharY,
      24,
      {
        density: 0.002,
        restitution: 0.3,
        friction: 0.6,
        frictionAir: 0.02,
        angle: startCollapsed ? 1.2 : 0,
      }
    );
    Matter.Composite.add(world, charBody);

    let charSpring: Matter.Constraint | null = null;
    if (!startCollapsed) {
      charSpring = Matter.Constraint.create({
        pointA: { x: initialCharX, y: initialCharY },
        bodyB: charBody,
        stiffness: 0.06,
        damping: 0.16,
        length: 0,
      });
      anchorConstraints.push(charSpring);
      Matter.Composite.add(world, charSpring);
    }

    const resizeCanvas = () => {
      const prevCenterX = centerX;
      const prevGroundY = groundY;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      centerX = width / 2;
      groundY = height - 154;
      cannonY = height - 72;
      towerTopY = groundY - rows * (blockH + 1);

      const dx = centerX - prevCenterX;
      const dy = groundY - prevGroundY;
      if (dx !== 0 || dy !== 0) {
        Matter.Body.setPosition(floorBody, { x: centerX, y: groundY + 40 });
        Matter.Body.setPosition(rightWall, { x: width + 40, y: height / 2 });
        for (const b of blocks) {
          b.homeY += dy;
          Matter.Body.translate(b.body, { x: dx, y: dy });
          if (b.spring && b.spring.pointA) {
            b.spring.pointA.x += dx;
            b.spring.pointA.y += dy;
          }
        }
        for (const frag of chippedFragments) {
          Matter.Body.translate(frag.body, { x: dx, y: dy });
        }
        Matter.Body.translate(charBody, { x: dx, y: dy });
        if (charSpring && charSpring.pointA) {
          charSpring.pointA.x += dx;
          charSpring.pointA.y += dy;
        }
      }
      rebuildBackgroundCache();
    };
    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    // Zero-GC Particle Pool
    const particles: Particle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 4,
      angle: 0,
      vAngle: 0,
      life: 0,
      maxLife: 1,
      color: '#FFFFFF',
      kind: 'debris',
    }));
    let particleCursor = 0;

    const spawnParticle = (
      x: number,
      y: number,
      vx: number,
      vy: number,
      size: number,
      color: string,
      maxLife: number,
      kind: Particle['kind']
    ) => {
      const p = particles[particleCursor];
      particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.size = size;
      p.angle = Math.random() * Math.PI * 2;
      p.vAngle = (Math.random() - 0.5) * 0.25;
      p.life = 0;
      p.maxLife = maxLife;
      p.color = color;
      p.kind = kind;
    };

    const spawnMaterialBurst = (x: number, y: number, count: number, material: MaterialId) => {
      const colors = MATERIALS[material].debrisColors;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 8.5;
        spawnParticle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 3,
          4 + Math.random() * 6,
          colors[i % colors.length],
          0.45 + Math.random() * 0.55,
          'debris'
        );
      }
    };

    const spawnConfettiBurst = (count: number) => {
      const confettiPalette = ['#F59E0B', '#10B981', '#38BDF8', '#F43F5E', '#A855F7', '#FDE047'];
      for (let i = 0; i < count; i++) {
        spawnParticle(
          centerX + (Math.random() - 0.5) * width * 0.65,
          height * 0.22 + (Math.random() - 0.5) * 80,
          (Math.random() - 0.5) * 10,
          -4 - Math.random() * 9,
          6 + Math.random() * 6,
          confettiPalette[i % confettiPalette.length],
          1.8 + Math.random() * 1.4,
          'confetti'
        );
      }
    };

    // Cannon & Projectile state
    let aimAngle = -Math.PI / 2;
    let cannonRecoil = 0;
    let trauma = 0;
    let hitstopTimer = 0;
    let flashTimer = 0;
    let panicTimer = 0;
    let collapsedTriggered = startCollapsed;
    let collapseFinishTimer = 0;
    let pendingVictoryTower: PublicTower | null = null;
    let shotInFlight = false;

    const projectile: ActiveProjectile = {
      x: centerX,
      y: height - 42,
      vx: 0,
      vy: 0,
      targetX: centerX,
      targetY: groundY - 120,
      active: false,
      willCollapse: false,
    };

    const triggerCollapseSequence = (impactX: number, impactY: number, finalTower: PublicTower) => {
      collapsedTriggered = true;
      setIsCollapsing(true);
      pendingVictoryTower = finalTower;
      collapseFinishTimer = 2.4;
      engine.timing.timeScale = 0.28;
      trauma = 1.0;
      hitstopTimer = 0.06;
      flashTimer = 0.14;
      panicTimer = 3.0;

      // Remove stabilizing anchor constraints so real Matter.js gravity drops the entire tower
      for (const c of anchorConstraints) {
        Matter.Composite.remove(world, c);
      }
      anchorConstraints.length = 0;

      // Explosive radial shockwave across every block and top character
      for (const b of blocks) {
        const dx = b.body.position.x - impactX;
        const dy = b.body.position.y - impactY;
        const dist = Math.max(30, Math.hypot(dx, dy));
        const forceMag = 0.045 + (b.row / rows) * 0.03;
        Matter.Body.applyForce(b.body, b.body.position, {
          x: (dx / dist) * forceMag + (Math.random() - 0.5) * 0.025,
          y: -0.025 - Math.random() * 0.02,
        });
        Matter.Body.setAngularVelocity(b.body, (Math.random() - 0.5) * 0.25);
      }

      Matter.Body.applyForce(charBody, charBody.position, {
        x: (Math.random() > 0.5 ? 1 : -1) * 0.05,
        y: -0.08,
      });
      Matter.Body.setAngularVelocity(charBody, 0.18);

      soundEngine.playCollapseSequence();
      spawnMaterialBurst(impactX, impactY, 48, towerRef.current.material);
      spawnConfettiBurst(110);
    };

    const spawnPhysicalChunks = (impactX: number, impactY: number, count: number) => {
      const currMat = MATERIALS[towerRef.current.material];
      for (let i = 0; i < count; i++) {
        if (chippedFragments.length >= 42) {
          const oldest = chippedFragments.shift();
          if (oldest) {
            Matter.Composite.remove(world, oldest.body);
          }
        }
        const cw = 12 + Math.random() * 12;
        const ch = 9 + Math.random() * 9;
        const chunkBody = Matter.Bodies.rectangle(
          impactX + (Math.random() - 0.5) * 20,
          impactY + (Math.random() - 0.5) * 14,
          cw,
          ch,
          {
            density: currMat.density * 0.85,
            restitution: currMat.restitution + 0.08,
            friction: currMat.friction,
            frictionAir: 0.015,
          }
        );
        const outDir = impactX >= centerX ? 1 : -1;
        Matter.Body.setVelocity(chunkBody, {
          x: outDir * (2.5 + Math.random() * 4.5) + (Math.random() - 0.5) * 3,
          y: -3 - Math.random() * 4,
        });
        Matter.Body.setAngularVelocity(chunkBody, (Math.random() - 0.5) * 0.35);
        Matter.Composite.add(world, chunkBody);
        chippedFragments.push({
          body: chunkBody,
          fill: i % 2 === 0 ? currMat.blockFill : currMat.blockFillAlt,
          stroke: currMat.blockStroke,
          w: cw,
          h: ch,
        });
      }
    };

    const applyTowerLean = () => {
      const clampedLean = Math.max(-6, Math.min(6, leanBias));
      for (const b of blocks) {
        if (b.detached || !b.spring || !b.spring.pointA) continue;
        const heightRatio = b.row / Math.max(1, rows - 1);
        b.spring.pointA.x = centerX + b.homeDx + clampedLean * heightRatio * 4.5;
        b.spring.pointA.y = b.homeY + Math.abs(clampedLean) * heightRatio * 0.65;
      }
      if (charSpring && charSpring.pointA) {
        charSpring.pointA.x = centerX + clampedLean * 4.5;
      }
    };

    const syncTowerStateToScene = (nextTower: PublicTower, newlyDetached: number[] = []) => {
      if (nextTower.status === 'DERRIBADA' && !collapsedTriggered) {
        triggerCollapseSequence(centerX, groundY - 120, nextTower);
        return;
      }

      leanBias = nextTower.leanLevel ?? 0;
      const targetCracks = nextTower.blockCracks ?? {};
      const detachIds = new Set<number>([...(nextTower.detachedBlocks ?? []), ...newlyDetached]);

      for (const b of blocks) {
        const entry = targetCracks[String(b.index)];
        if (entry) {
          b.crackLevel = entry.crack;
          b.biteCorners = entry.bite;
        }
        if (detachIds.has(b.index) && !b.detached) {
          b.detached = true;
          b.crackLevel = 3;
          if (b.spring) {
            Matter.Composite.remove(world, b.spring);
            const idx = anchorConstraints.indexOf(b.spring);
            if (idx >= 0) anchorConstraints.splice(idx, 1);
            b.spring = undefined;
          }
          const outDir = b.col < cols / 2 ? -1 : 1;
          Matter.Body.applyForce(b.body, b.body.position, {
            x: outDir * (0.03 + Math.random() * 0.015),
            y: -0.022,
          });
          Matter.Body.setAngularVelocity(b.body, outDir * (0.14 + Math.random() * 0.16));
        }
      }

      applyTowerLean();
    };

    interface PendingShotSync {
      resolved: boolean;
      applied: boolean;
      collapsed: boolean;
      tower?: PublicTower;
      newlyDetached: number[];
      targetX: number;
      targetY: number;
    }
    let activeShotSync: PendingShotSync | null = null;

    const executeBlockImpact = (impactX: number, impactY: number, willCollapse: boolean, updatedTower?: PublicTower) => {
      if (activeShotSync) {
        activeShotSync.applied = true;
      }

      if (willCollapse && updatedTower) {
        triggerCollapseSequence(impactX, impactY, updatedTower);
        return;
      }

      soundEngine.playMaterialImpact(towerRef.current.material, false);
      trauma = Math.min(1, trauma + 0.38);
      hitstopTimer = 0.03;
      flashTimer = 0.045;
      panicTimer = 1.35;

      // Apply authoritative proportional damage from server (if fetch already returned)
      if (activeShotSync?.resolved && activeShotSync.tower) {
        syncTowerStateToScene(activeShotSync.tower, activeShotSync.newlyDetached);
      }

      // 1-2 small splinter chips (strictly tactile feedback, full blocks only detach via server ratio)
      const currMat = MATERIALS[towerRef.current.material];
      const splinterCount = 1 + (Math.random() > 0.55 ? 1 : 0);
      for (let i = 0; i < splinterCount; i++) {
        if (chippedFragments.length >= 24) {
          const oldest = chippedFragments.shift();
          if (oldest) Matter.Composite.remove(world, oldest.body);
        }
        const cw = 6 + Math.random() * 5;
        const ch = 4 + Math.random() * 4;
        const chipBody = Matter.Bodies.rectangle(
          impactX + (Math.random() - 0.5) * 14,
          impactY + (Math.random() - 0.5) * 10,
          cw,
          ch,
          {
            density: currMat.density * 0.6,
            restitution: currMat.restitution + 0.06,
            friction: currMat.friction,
            frictionAir: 0.02,
          }
        );
        const outDir = impactX >= centerX ? 1 : -1;
        Matter.Body.setVelocity(chipBody, {
          x: outDir * (2 + Math.random() * 3.5) + (Math.random() - 0.5) * 2,
          y: -2.2 - Math.random() * 2.8,
        });
        Matter.Body.setAngularVelocity(chipBody, (Math.random() - 0.5) * 0.35);
        Matter.Composite.add(world, chipBody);
        chippedFragments.push({
          body: chipBody,
          fill: i % 2 === 0 ? currMat.blockFill : currMat.blockFillAlt,
          stroke: currMat.blockStroke,
          w: cw,
          h: ch,
        });
      }

      // Subtle wobble impulse to nearby attached blocks
      for (const b of blocks) {
        if (b.detached) continue;
        const dist = Math.hypot(b.body.position.x - impactX, b.body.position.y - impactY);
        if (dist < 135) {
          const factor = (1 - dist / 135) * 0.024;
          const dirX = b.body.position.x >= centerX ? 1 : -1;
          Matter.Body.applyForce(b.body, b.body.position, {
            x: dirX * factor + (Math.random() - 0.5) * 0.008,
            y: -0.006,
          });
        }
      }

      // Jolt character slightly
      Matter.Body.applyForce(charBody, charBody.position, {
        x: (Math.random() - 0.5) * 0.018,
        y: -0.014,
      });

      spawnMaterialBurst(impactX, impactY, 14, towerRef.current.material);
    };

    const fireAt = (clientX: number, clientY: number, isViewportCoords = true) => {
      if (collapsedTriggered || towerRef.current.status === 'DERRIBADA' || shotInFlight) {
        return;
      }
      if (shotsBalanceRef.current <= 0) {
        callbacksRef.current.onOpenShop(true);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const localX = isViewportCoords ? clientX - rect.left : clientX;
      const localY = isViewportCoords ? clientY - rect.top : clientY;

      const cannonX = width / 2;
      const aim = calculateCannonAim(cannonX, cannonY, localX, localY, 30);
      aimAngle = aim.angle;
      cannonRecoil = 14;
      shotInFlight = true;

      // Clamp target point near tower silhouette so shots always strike the structure cleanly
      const clampedTargetX = Math.max(centerX - blockW * 1.4, Math.min(centerX + blockW * 1.4, localX));
      const clampedTargetY = Math.max(towerTopY - 20, Math.min(groundY - 12, localY));

      const impactCol = Math.max(
        0,
        Math.min(cols - 1, Math.round((clampedTargetX - centerX) / (blockW + 2) + (cols - 1) / 2))
      );
      const impactRow = Math.max(
        0,
        Math.min(rows - 1, Math.round((groundY - blockH / 2 - clampedTargetY) / (blockH + 1)))
      );

      projectile.x = cannonX + Math.cos(aim.angle) * 38;
      projectile.y = cannonY + Math.sin(aim.angle) * 38;
      const dx = clampedTargetX - projectile.x;
      const dy = clampedTargetY - projectile.y;
      const dist = Math.max(10, Math.hypot(dx, dy));
      const speed = 28;
      projectile.vx = (dx / dist) * speed;
      projectile.vy = (dy / dist) * speed;
      projectile.targetX = clampedTargetX;
      projectile.targetY = clampedTargetY;
      projectile.active = true;
      projectile.willCollapse = false;

      const shotSync: PendingShotSync = {
        resolved: false,
        applied: false,
        collapsed: false,
        newlyDetached: [],
        targetX: clampedTargetX,
        targetY: clampedTargetY,
      };
      activeShotSync = shotSync;

      soundEngine.playCannonFire();

      // Call authoritative backend /api/shoot
      void fetch('/api/shoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: playerIdRef.current,
          towerId: towerRef.current.id,
          impactRow,
          impactCol,
        }),
      })
        .then(async (res) => {
          const data = (await res.json()) as {
            ok?: boolean;
            needsPurchase?: boolean;
            collapsed?: boolean;
            shotsBalance?: number;
            totalShotsFired?: number;
            newlyDetached?: number[];
            tower?: PublicTower;
          };
          if (res.status === 402 || data.needsPurchase) {
            projectile.active = false;
            shotInFlight = false;
            callbacksRef.current.onOpenShop(true);
            return;
          }
          if (data.ok && data.tower && typeof data.shotsBalance === 'number') {
            shotSync.resolved = true;
            shotSync.collapsed = Boolean(data.collapsed);
            shotSync.tower = data.tower;
            shotSync.newlyDetached = data.newlyDetached ?? [];

            callbacksRef.current.onShotResolved(
              data.tower,
              data.shotsBalance,
              data.totalShotsFired || 0
            );
            if (projectile.active) {
              projectile.willCollapse = Boolean(data.collapsed);
              if (data.collapsed) {
                pendingVictoryTower = data.tower;
              }
            } else if (shotSync.applied) {
              if (data.collapsed) {
                triggerCollapseSequence(shotSync.targetX, shotSync.targetY, data.tower);
              } else {
                syncTowerStateToScene(data.tower, shotSync.newlyDetached);
              }
            }
          }
        })
        .catch(() => {
          shotInFlight = false;
        });
    };

    simApiRef.current = {
      fireAt,
      triggerSimulatedShot: () => {
        const rect = canvas.getBoundingClientRect();
        fireAt(rect.left + width / 2, rect.top + (groundY + towerTopY) / 2, true);
      },
      syncTower: (nextTower: PublicTower) => {
        syncTowerStateToScene(nextTower, []);
      },
    };

    // Draw procedural character on canvas
    const drawCanvasCharacter = (
      cx: number,
      cy: number,
      angle: number,
      charId: CharacterId,
      panicked: boolean,
      timeSec: number
    ) => {
      const spec = CHARACTERS[charId];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Idle breathing or panic jitter
      const bounce = panicked ? Math.sin(timeSec * 28) * 3 : Math.sin(timeSec * 3.5) * 2;
      ctx.translate(0, bounce);

      // Arms waving in panic
      const armWave = panicked ? Math.sin(timeSec * 32) * 0.9 : Math.sin(timeSec * 3) * 0.15;
      ctx.strokeStyle = spec.primaryColor;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, 2);
      ctx.lineTo(-26, -4 + Math.sin(armWave) * 14);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.lineTo(26, -4 - Math.sin(armWave) * 14);
      ctx.stroke();

      // Torso
      ctx.fillStyle = spec.primaryColor;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 8, 17, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Belly / accent
      ctx.fillStyle = spec.secondaryColor;
      ctx.beginPath();
      ctx.ellipse(0, 10, 10, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = spec.primaryColor;
      ctx.beginPath();
      ctx.arc(0, -11, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crown / Horns / Antenna depending on character
      ctx.fillStyle = spec.accentColor;
      if (charId === 'king') {
        ctx.beginPath();
        ctx.moveTo(-11, -22);
        ctx.lineTo(-12, -34);
        ctx.lineTo(-4, -27);
        ctx.lineTo(0, -36);
        ctx.lineTo(4, -27);
        ctx.lineTo(12, -34);
        ctx.lineTo(11, -22);
        ctx.closePath();
        ctx.fill();
      } else if (charId === 'dragon' || charId === 'yeti') {
        ctx.beginPath();
        ctx.moveTo(-10, -20);
        ctx.lineTo(-18, -34);
        ctx.lineTo(-4, -23);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, -20);
        ctx.lineTo(18, -34);
        ctx.lineTo(4, -23);
        ctx.fill();
      } else if (charId === 'alien' || charId === 'robot') {
        ctx.strokeStyle = spec.accentColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(0, -35);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -37, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eyes (wide white circles if panicked!)
      if (panicked) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-5, -13, 4.5, 0, Math.PI * 2);
        ctx.arc(5, -13, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(-5, -13, 1.8, 0, Math.PI * 2);
        ctx.arc(5, -13, 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Open panic mouth
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.ellipse(0, -4, 4.5, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Sweat drop
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(16, -18, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = spec.eyeColor;
        ctx.beginPath();
        ctx.arc(-5, -13, 2.6, 0, Math.PI * 2);
        ctx.arc(5, -13, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo(4, -5);
        ctx.stroke();
      }

      ctx.restore();
    };

    // Main 60Hz Loop
    let lastTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      const timeSec = now / 1000;

      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
      } else {
        // Sub-step Matter.js with <= 16.667ms per step
        let remainingMs = dt * 1000;
        let steps = 0;
        while (remainingMs > 0.5 && steps < 3) {
          const stepMs = Math.min(16.666, remainingMs);
          Matter.Engine.update(engine, stepMs);
          remainingMs -= stepMs;
          steps += 1;
        }
      }

      if (trauma > 0) trauma = Math.max(0, trauma - dt * 1.9);
      if (flashTimer > 0) flashTimer = Math.max(0, flashTimer - dt);
      if (panicTimer > 0) panicTimer = Math.max(0, panicTimer - dt);
      if (cannonRecoil > 0) cannonRecoil = Math.max(0, cannonRecoil - dt * 55);

      // Update active projectile
      if (projectile.active) {
        projectile.x += projectile.vx;
        projectile.y += projectile.vy;
        const distToTarget = Math.hypot(projectile.targetX - projectile.x, projectile.targetY - projectile.y);
        if (distToTarget < 26 || projectile.y <= projectile.targetY) {
          projectile.active = false;
          shotInFlight = false;
          executeBlockImpact(
            projectile.targetX,
            projectile.targetY,
            projectile.willCollapse,
            pendingVictoryTower ?? undefined
          );
        }
      }

      // Collapse timer countdown -> open Victory Modal
      if (collapseFinishTimer > 0) {
        collapseFinishTimer -= dt;
        if (collapseFinishTimer <= 0 && pendingVictoryTower) {
          engine.timing.timeScale = 1;
          soundEngine.playVictoryFanfare();
          const finalTower = pendingVictoryTower;
          pendingVictoryTower = null;
          callbacksRef.current.onTowerCollapsedVictory(finalTower);
        }
      }

      // Update particles in-place
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particles[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * (engine.timing.timeScale < 1 ? 0.55 : 1);
        p.y += p.vy * (engine.timing.timeScale < 1 ? 0.55 : 1);
        p.vy += p.kind === 'confetti' ? 0.14 : 0.35;
        p.angle += p.vAngle;
      }

      // Render Frame
      ctx.save();
      ctx.scale(dpr, dpr);

      // Camera trauma shake
      const shakeMag = trauma * trauma * 14;
      const shakeX = (Math.random() * 2 - 1) * shakeMag;
      const shakeY = (Math.random() * 2 - 1) * shakeMag;
      ctx.translate(shakeX, shakeY);

      // Draw cached sky + horizon + ground
      ctx.fillStyle = towerRef.current.palette.skyTop;
      ctx.fillRect(-20, -20, width + 40, height + 40);
      ctx.drawImage(bgCanvas, 0, 0, width, height);

      // Tower Blocks (with progressive corner bites and cracks per real hit)
      const currMat = MATERIALS[towerRef.current.material];

      for (const b of blocks) {
        const pos = b.body.position;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(b.body.angle);

        const fill = (b.row + b.col) % 2 === 0 ? currMat.blockFill : currMat.blockFillAlt;
        ctx.fillStyle = flashTimer > 0 && !b.detached ? '#FFFFFF' : fill;
        ctx.strokeStyle = currMat.blockStroke;
        ctx.lineWidth = 2;

        const hw = blockW / 2;
        const hh = blockH / 2;
        const bite = 9;

        // Draw notched polygon when block corners have been bitten off by real shots
        ctx.beginPath();
        if (b.biteCorners & 1) {
          ctx.moveTo(-hw + bite, -hh);
        } else {
          ctx.moveTo(-hw, -hh);
        }
        if (b.biteCorners & 2) {
          ctx.lineTo(hw - bite, -hh);
          ctx.lineTo(hw - bite * 0.35, -hh + bite * 0.45);
          ctx.lineTo(hw, -hh + bite);
        } else {
          ctx.lineTo(hw, -hh);
        }
        if (b.biteCorners & 4) {
          ctx.lineTo(hw, hh - bite);
          ctx.lineTo(hw - bite * 0.45, hh - bite * 0.35);
          ctx.lineTo(hw - bite, hh);
        } else {
          ctx.lineTo(hw, hh);
        }
        if (b.biteCorners & 8) {
          ctx.lineTo(-hw + bite, hh);
          ctx.lineTo(-hw + bite * 0.35, hh - bite * 0.45);
          ctx.lineTo(-hw, hh - bite);
        } else {
          ctx.lineTo(-hw, hh);
        }
        if (b.biteCorners & 1) {
          ctx.lineTo(-hw, -hh + bite);
          ctx.lineTo(-hw + bite * 0.45, -hh + bite * 0.35);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top highlight strip
        ctx.fillStyle = currMat.highlight;
        ctx.globalAlpha = 0.36;
        ctx.fillRect(-hw + 6, -hh + 3, Math.max(8, blockW - 12), 3);
        ctx.globalAlpha = 1;

        // LEGO studs
        if (towerRef.current.material === 'lego') {
          ctx.fillStyle = fill;
          ctx.fillRect(-blockW * 0.3, -hh - 4, 8, 4);
          ctx.fillRect(blockW * 0.12, -hh - 4, 8, 4);
        }

        // Progressive cracks driven by real hits on this block
        if (b.crackLevel >= 1) {
          ctx.strokeStyle = '#090D16';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-4, -hh + 2);
          ctx.lineTo(2, 0);
          ctx.lineTo(-2, hh - 2);
          ctx.stroke();
        }
        if (b.crackLevel >= 2) {
          ctx.strokeStyle = '#090D16';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(hw * 0.45, -hh + 2);
          ctx.lineTo(hw * 0.12, 3);
          ctx.lineTo(hw * 0.5, hh - 2);
          ctx.stroke();
        }
        if (b.crackLevel >= 3) {
          ctx.strokeStyle = '#090D16';
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(-hw + 3, -2);
          ctx.lineTo(-2, 4);
          ctx.lineTo(hw - 4, -3);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Physical Chipped Corner / Debris Rigid Bodies on Ground
      for (const frag of chippedFragments) {
        const pos = frag.body.position;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(frag.body.angle);
        ctx.fillStyle = frag.fill;
        ctx.strokeStyle = frag.stroke;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-frag.w / 2, -frag.h / 2 + 2);
        ctx.lineTo(frag.w / 2 - 2, -frag.h / 2);
        ctx.lineTo(frag.w / 2, frag.h / 2 - 1);
        ctx.lineTo(-frag.w / 2 + 2, frag.h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Draw Character atop tower (or fallen on ground)
      drawCanvasCharacter(
        charBody.position.x,
        charBody.position.y,
        charBody.angle,
        towerRef.current.character,
        panicTimer > 0 || collapsedTriggered,
        timeSec
      );

      // Active Projectile
      if (projectile.active) {
        ctx.save();
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      // Particles (Debris + Confetti)
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particles[i];
        if (!p.active) continue;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.kind === 'confetti') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.75);
        }
        ctx.restore();
      }

      // Bottom Arcade Cannon
      const cannonX = width / 2;
      ctx.save();
      ctx.translate(cannonX, cannonY);

      // Aim Barrel
      ctx.save();
      ctx.rotate(aimAngle);
      const recoilOffset = -cannonRecoil;
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(recoilOffset - 8, -13, 52, 26, 6);
      ctx.fill();
      ctx.stroke();
      // Muzzle ring
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(recoilOffset + 38, -15, 8, 30);
      ctx.restore();

      // Cannon Base Dome
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 6, 24, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Aim Reticle hint when active
      if (!collapsedTriggered && towerRef.current.status === 'ACTIVA') {
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.setLineDash([5, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cannonX + Math.cos(aimAngle) * 48, cannonY + Math.sin(aimAngle) * 48);
        ctx.lineTo(cannonX + Math.cos(aimAngle) * 145, cannonY + Math.sin(aimAngle) * 145);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      aimAngle = calculateCannonAim(width / 2, cannonY, lx, ly).angle;
    };

    const handlePointerDown = (e: PointerEvent) => {
      fireAt(e.clientX, e.clientY, true);
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      simApiRef.current = null;
    };
  }, [tower.id]);

  // Sync forward external tower updates (e.g. multiplayer shots)
  useEffect(() => {
    simApiRef.current?.syncTower(tower);
  }, [tower]);

  // Trigger simulated winning shot when requested from Admin Demo
  useEffect(() => {
    if (autoFireWinningShot && simApiRef.current) {
      const timer = setTimeout(() => {
        simApiRef.current?.triggerSimulatedShot();
        onAutoFireConsumed();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [autoFireWinningShot, onAutoFireConsumed]);

  // Keyboard shortcut [M] for mute & [Escape] to go back
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        const next = !soundEngine.isMuted();
        soundEngine.setMuted(next);
        setMuted(next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-30 bg-[#0B1020] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        data-testid="tower-stage-canvas"
        className="block w-full h-full cursor-crosshair touch-none"
      />

      {/* World-Matched Corner HUD (pointer-events-none wrapper, zero backdrop-blur) */}
      <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Top-Left: Back Button */}
          <button
            type="button"
            onClick={onBackToLobby}
            className="pointer-events-auto inline-flex items-center px-4 py-2.5 min-h-[44px] rounded-xl bg-[#0D1326]/90 border border-white/15 hover:border-amber-400 text-sm font-semibold text-white shadow-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>← Volver a las Torres</span>
          </button>

          {/* Top-Center: Tower Status (Suspense text only, zero percentage or bar) */}
          <div className="hidden md:flex flex-col items-center px-5 py-2 rounded-xl bg-[#0D1326]/90 border border-white/15 shadow-lg min-w-[260px]">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="font-mono-num font-bold text-amber-400">#{tower.towerNumber}</span>
              <span className="font-semibold text-white">{tower.name}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-amber-300 font-semibold">$1,000 USD</span>
            </div>
            <div
              className={`text-[11px] font-medium mt-1 whitespace-nowrap ${
                tower.status === 'DERRIBADA' ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              {tower.status === 'DERRIBADA'
                ? 'Estado: Derribada • Premio $1,000 USD entregado'
                : 'Estado: En pie • ¡Puede caer en cualquier tiro!'}
            </div>
          </div>

          {/* Top-Right: Shot Balance & Quick Buy */}
          <div className="pointer-events-auto flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-[#0D1326]/90 border border-white/15 hover:border-white/30 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>

            <div className="px-4 py-2 min-h-[44px] rounded-xl bg-[#0D1326]/90 border border-white/15 flex items-center gap-3 shadow-lg">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Saldo de Tiros
                </div>
                <div
                  data-testid="stage-shots-balance"
                  className="font-mono-num text-lg font-bold text-amber-400 leading-none"
                >
                  {shotsBalance}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenShop(false)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Comprar
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Instruction Hint */}
        <div className="flex justify-center pb-1">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#0D1326]/85 border border-white/10 text-xs text-slate-300">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            {tower.status === 'DERRIBADA' ? (
              <span>Torre derribada · Premio de $1,000 USD entregado</span>
            ) : (
              <span>Haz clic o toca la torre para disparar el cañón (1 tiro por impacto)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
