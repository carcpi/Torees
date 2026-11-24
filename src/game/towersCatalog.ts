import { syncDamageStateForTower, type BlockCrackInfo, type WearTier } from './rules.ts';

export type MaterialId =
  | 'wood'
  | 'lego'
  | 'crystal'
  | 'steel'
  | 'brick'
  | 'ice'
  | 'ancient_stone'
  | 'neon_block'
  | 'obsidian'
  | 'gold_ingot';

export type CharacterId =
  | 'gorilla'
  | 'alien'
  | 'robot'
  | 'king'
  | 'dragon'
  | 'astronaut'
  | 'kaiju'
  | 'yeti'
  | 'pirate'
  | 'cyborg';

export type TowerStatus = 'ACTIVA' | 'DERRIBADA';

export interface MaterialSpec {
  id: MaterialId;
  label: string;
  blockFill: string;
  blockFillAlt: string;
  blockStroke: string;
  highlight: string;
  debrisColors: [string, string, string];
  debrisShape: 'splinter' | 'stud' | 'shard' | 'spark' | 'chunk';
  density: number;
  restitution: number;
  friction: number;
}

export interface CharacterSpec {
  id: CharacterId;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  eyeColor: string;
}

export interface TowerPalette {
  skyTop: string;
  skyBottom: string;
  horizonGlow: string;
  platformColor: string;
  cardBg: string;
}

export interface PublicTower {
  id: string;
  towerNumber: number;
  name: string;
  material: MaterialId;
  character: CharacterId;
  palette: TowerPalette;
  current_shots: number;
  status: TowerStatus;
  wearTier: WearTier;
  leanLevel: number;
  detachedBlocks: number[];
  blockCracks: Record<string, BlockCrackInfo>;
  winnerName?: string;
}

export interface AdminTower extends PublicTower {
  target_shots: number;
  remaining_shots: number;
}

export interface WinnerEntry {
  id: string;
  towerId: string;
  towerNumber: number;
  towerName: string;
  winnerName: string;
  prizeAmount: number;
  createdAt: string;
}

export type CryptoCurrency = 'USDT' | 'USDC' | 'SOL' | 'BTC';

export const CRYPTO_CURRENCIES: { id: CryptoCurrency; label: string; network: string }[] = [
  { id: 'USDT', label: 'USDT', network: 'Tether (TRC20 / BEP20 / SOL)' },
  { id: 'USDC', label: 'USDC', network: 'USD Coin (SOL / Polygon / ERC20)' },
  { id: 'SOL', label: 'SOL', network: 'Red Solana Instantánea' },
  { id: 'BTC', label: 'BTC', network: 'Bitcoin Network' },
];

export interface ShopPackage {
  id: 'inicial' | 'popular' | 'pro';
  name: string;
  shots: number;
  bonusShots: number;
  priceUsd: number;
  featured: boolean;
  badgeText?: string;
}

export const SHOP_PACKAGES: ShopPackage[] = [
  {
    id: 'inicial',
    name: 'Paquete Inicial',
    shots: 5,
    bonusShots: 0,
    priceUsd: 5,
    featured: false,
  },
  {
    id: 'popular',
    name: 'Paquete Popular',
    shots: 22,
    bonusShots: 2,
    priceUsd: 20,
    featured: true,
    badgeText: 'MÁS VENDIDO',
  },
  {
    id: 'pro',
    name: 'Paquete Pro',
    shots: 35,
    bonusShots: 5,
    priceUsd: 30,
    featured: false,
  },
];

export const MATERIALS: Record<MaterialId, MaterialSpec> = {
  wood: {
    id: 'wood',
    label: 'Troncos de Madera',
    blockFill: '#9A5B25',
    blockFillAlt: '#7C4518',
    blockStroke: '#4A260A',
    highlight: '#D99B58',
    debrisColors: ['#B87333', '#7C4518', '#E2B07E'],
    debrisShape: 'splinter',
    density: 0.0022,
    restitution: 0.12,
    friction: 0.72,
  },
  lego: {
    id: 'lego',
    label: 'Bloques LEGO',
    blockFill: '#E11D48',
    blockFillAlt: '#2563EB',
    blockStroke: '#0F172A',
    highlight: '#FACC15',
    debrisColors: ['#E11D48', '#2563EB', '#FACC15'],
    debrisShape: 'stud',
    density: 0.0018,
    restitution: 0.2,
    friction: 0.55,
  },
  crystal: {
    id: 'crystal',
    label: 'Cristales Arcanos',
    blockFill: '#38BDF8',
    blockFillAlt: '#818CF8',
    blockStroke: '#E0F2FE',
    highlight: '#FFFFFF',
    debrisColors: ['#7DD3FC', '#C4B5FD', '#E0F2FE'],
    debrisShape: 'shard',
    density: 0.0026,
    restitution: 0.18,
    friction: 0.35,
  },
  steel: {
    id: 'steel',
    label: 'Vigas de Acero',
    blockFill: '#64748B',
    blockFillAlt: '#475569',
    blockStroke: '#1E293B',
    highlight: '#CBD5E1',
    debrisColors: ['#F59E0B', '#CBD5E1', '#FDBA74'],
    debrisShape: 'spark',
    density: 0.0042,
    restitution: 0.08,
    friction: 0.65,
  },
  brick: {
    id: 'brick',
    label: 'Ladrillo Clásico',
    blockFill: '#C2410C',
    blockFillAlt: '#9A3412',
    blockStroke: '#431407',
    highlight: '#FB923C',
    debrisColors: ['#C2410C', '#78350F', '#FDBA74'],
    debrisShape: 'chunk',
    density: 0.003,
    restitution: 0.06,
    friction: 0.8,
  },
  ice: {
    id: 'ice',
    label: 'Hielo Glacial',
    blockFill: '#67E8F9',
    blockFillAlt: '#22D3EE',
    blockStroke: '#ECFEFF',
    highlight: '#FFFFFF',
    debrisColors: ['#A5F3FC', '#ECFEFF', '#38BDF8'],
    debrisShape: 'shard',
    density: 0.002,
    restitution: 0.14,
    friction: 0.22,
  },
  ancient_stone: {
    id: 'ancient_stone',
    label: 'Piedra Antigua',
    blockFill: '#78716C',
    blockFillAlt: '#57534E',
    blockStroke: '#292524',
    highlight: '#D6D3D1',
    debrisColors: ['#A8A29E', '#57534E', '#E7E5E4'],
    debrisShape: 'chunk',
    density: 0.0036,
    restitution: 0.05,
    friction: 0.85,
  },
  neon_block: {
    id: 'neon_block',
    label: 'Bloques Neón',
    blockFill: '#1E1B4B',
    blockFillAlt: '#312E81',
    blockStroke: '#22D3EE',
    highlight: '#F472B6',
    debrisColors: ['#22D3EE', '#F472B6', '#A3E635'],
    debrisShape: 'spark',
    density: 0.0024,
    restitution: 0.22,
    friction: 0.5,
  },
  obsidian: {
    id: 'obsidian',
    label: 'Obsidiana Volcánica',
    blockFill: '#27272A',
    blockFillAlt: '#18181B',
    blockStroke: '#F97316',
    highlight: '#FB7185',
    debrisColors: ['#3F3F46', '#F97316', '#FACC15'],
    debrisShape: 'shard',
    density: 0.004,
    restitution: 0.1,
    friction: 0.7,
  },
  gold_ingot: {
    id: 'gold_ingot',
    label: 'Lingotes de Oro',
    blockFill: '#F59E0B',
    blockFillAlt: '#D97706',
    blockStroke: '#78350F',
    highlight: '#FEF08A',
    debrisColors: ['#FBBF24', '#FEF08A', '#D97706'],
    debrisShape: 'spark',
    density: 0.0045,
    restitution: 0.1,
    friction: 0.6,
  },
};

export const CHARACTERS: Record<CharacterId, CharacterSpec> = {
  gorilla: {
    id: 'gorilla',
    label: 'Gorila Gigante',
    primaryColor: '#374151',
    secondaryColor: '#6B7280',
    accentColor: '#F59E0B',
    eyeColor: '#EF4444',
  },
  alien: {
    id: 'alien',
    label: 'Alienígena',
    primaryColor: '#22C55E',
    secondaryColor: '#86EFAC',
    accentColor: '#A855F7',
    eyeColor: '#0F172A',
  },
  robot: {
    id: 'robot',
    label: 'Robot Titán',
    primaryColor: '#64748B',
    secondaryColor: '#94A3B8',
    accentColor: '#38BDF8',
    eyeColor: '#22D3EE',
  },
  king: {
    id: 'king',
    label: 'Rey Medieval',
    primaryColor: '#DC2626',
    secondaryColor: '#FBBF24',
    accentColor: '#FDE047',
    eyeColor: '#0F172A',
  },
  dragon: {
    id: 'dragon',
    label: 'Dragón Escarlata',
    primaryColor: '#EA580C',
    secondaryColor: '#FDBA74',
    accentColor: '#FACC15',
    eyeColor: '#FEF08A',
  },
  astronaut: {
    id: 'astronaut',
    label: 'Astronauta',
    primaryColor: '#F8FAFC',
    secondaryColor: '#CBD5E1',
    accentColor: '#F97316',
    eyeColor: '#38BDF8',
  },
  kaiju: {
    id: 'kaiju',
    label: 'Kaiju Abisal',
    primaryColor: '#0D9488',
    secondaryColor: '#2DD4BF',
    accentColor: '#EC4899',
    eyeColor: '#FDE047',
  },
  yeti: {
    id: 'yeti',
    label: 'Yeti Polar',
    primaryColor: '#E2E8F0',
    secondaryColor: '#93C5FD',
    accentColor: '#3B82F6',
    eyeColor: '#1E3A8A',
  },
  pirate: {
    id: 'pirate',
    label: 'Pirata Corsario',
    primaryColor: '#1E293B',
    secondaryColor: '#B45309',
    accentColor: '#F59E0B',
    eyeColor: '#F8FAFC',
  },
  cyborg: {
    id: 'cyborg',
    label: 'Ciborg Omega',
    primaryColor: '#312E81',
    secondaryColor: '#A5B4FC',
    accentColor: '#F43F5E',
    eyeColor: '#F43F5E',
  },
};

const MATERIAL_ORDER: MaterialId[] = [
  'wood',
  'lego',
  'crystal',
  'steel',
  'brick',
  'ice',
  'ancient_stone',
  'neon_block',
  'obsidian',
  'gold_ingot',
];

const CHARACTER_ORDER: CharacterId[] = [
  'gorilla',
  'alien',
  'robot',
  'king',
  'dragon',
  'astronaut',
  'kaiju',
  'yeti',
  'pirate',
  'cyborg',
];

const PALETTES: TowerPalette[] = [
  { skyTop: '#0F172A', skyBottom: '#1E3A5F', horizonGlow: '#38BDF8', platformColor: '#1E293B', cardBg: '#121C34' },
  { skyTop: '#1A102B', skyBottom: '#3B1D5E', horizonGlow: '#F472B6', platformColor: '#27173E', cardBg: '#19122D' },
  { skyTop: '#0B1D1A', skyBottom: '#134E4A', horizonGlow: '#2DD4BF', platformColor: '#0F2E2B', cardBg: '#0E201E' },
  { skyTop: '#24120C', skyBottom: '#5C2414', horizonGlow: '#FB923C', platformColor: '#341A12', cardBg: '#201310' },
  { skyTop: '#111827', skyBottom: '#334155', horizonGlow: '#FBBF24', platformColor: '#1F2937', cardBg: '#151B28' },
  { skyTop: '#081C2E', skyBottom: '#0E4A6D', horizonGlow: '#67E8F9', platformColor: '#0C2B40', cardBg: '#0C2032' },
  { skyTop: '#1F1326', skyBottom: '#4C1D42', horizonGlow: '#FB7185', platformColor: '#2D1730', cardBg: '#1D1223' },
  { skyTop: '#161B26', skyBottom: '#2B3A55', horizonGlow: '#A3E635', platformColor: '#1E293B', cardBg: '#131A29' },
];

const TOWER_NAMES: string[] = [
  'Selva de Cedro',
  'Fortaleza LEGO',
  'Aguja de Cuarzo',
  'Bastión de Acero',
  'Ciudadela Roja',
  'Glaciar Ártico',
  'Templo Ancestral',
  'Búnker Neón',
  'Cráter Obsidiana',
  'Bóveda Dorada',
  'Atalaya del Bosque',
  'Coloso de Bloques',
  'Prisma Celeste',
  'Fundición Titanio',
  'Muralla Imperial',
  'Cumbre Helada',
  'Ruinas del Sol',
  'Circuito Cibernético',
  'Caldera Magma',
  'Cámara del Tesoro',
  'Torreón Salvaje',
  'Mega Ensamble',
  'Obelisco Zafiro',
  'Plataforma Orbital',
  'Bastión Escarlata',
  'Ventisca Polar',
  'Monolito Runas',
  'Rascacielos Synth',
  'Abismo Volcánico',
  'Altar Áureo',
  'Canopia Gigante',
  'Fábrica Juguete',
  'Gruta Amatista',
  'Puerto Blindado',
  'Alcázar Antiguo',
  'Fiordo Cristalino',
  'Pirámide Olvidada',
  'Matriz Holográfica',
  'Forja Basalto',
  'Palacio Lingote',
  'Cima Primitiva',
  'Zona Modular',
  'Cúpula Astral',
  'Reactor Central',
  'Fuerte Corsario',
  'Tundra Eterna',
  'Zigurath Eterno',
  'Distrito Láser',
  'Núcleo Sombrío',
  'Trono del Ciborg',
  'Bastión del Norte',
  'Torre Relámpago',
];

const FIRST_FIVE_TARGETS: Record<number, number> = {
  1: 2200,
  2: 4000,
  3: 5000,
  4: 5500,
  5: 8000,
};

export function getDefaultTargetShots(towerNumber: number): number {
  if (FIRST_FIVE_TARGETS[towerNumber]) {
    return FIRST_FIVE_TARGETS[towerNumber];
  }
  // Deterministic varied distribution between 2200 and 10000 for towers #6..#52
  const seed = ((towerNumber * 137 + 41) % 79) / 78;
  const raw = 2200 + seed * (10000 - 2200);
  return Math.round(raw / 50) * 50;
}

export interface InitialTowerSeed {
  id: string;
  towerNumber: number;
  name: string;
  material: MaterialId;
  character: CharacterId;
  palette: TowerPalette;
  current_shots: number;
  target_shots: number;
  status: TowerStatus;
  wearTier: WearTier;
  leanLevel: number;
  detachedBlocks: number[];
  blockCracks: Record<string, BlockCrackInfo>;
  winnerName?: string;
}

export function generateInitialTowerSeeds(): InitialTowerSeed[] {
  const seeds: InitialTowerSeed[] = [];
  // 50 ACTIVA (#1..#50) + 2 DERRIBADA (#51..#52) = 52 total towers
  for (let i = 1; i <= 52; i++) {
    const material = MATERIAL_ORDER[(i - 1) % MATERIAL_ORDER.length];
    const character = CHARACTER_ORDER[(i - 1 + Math.floor((i - 1) / 10) * 3) % CHARACTER_ORDER.length];
    const palette = PALETTES[(i - 1) % PALETTES.length];
    const target_shots = getDefaultTargetShots(i);

    let status: TowerStatus = 'ACTIVA';
    let current_shots = 0;
    let winnerName: string | undefined;

    if (i === 51) {
      status = 'DERRIBADA';
      current_shots = target_shots;
      winnerName = 'Mateo_RX';
    } else if (i === 52) {
      status = 'DERRIBADA';
      current_shots = target_shots;
      winnerName = 'Valeria_99';
    } else if (i === 1) {
      // Tower #1 starts fresh (0 shots) so players see intact state & subtle initial cracks on early hits
      current_shots = 0;
    } else {
      // Distribute across 0%..84% wear so lobby visually shows intact, cracked, bitten, and near-collapse towers
      const progressFactor = ((i * 29 + 11) % 85) / 100;
      current_shots = Math.min(target_shots - 10, Math.floor(target_shots * progressFactor));
    }

    const damageState = syncDamageStateForTower({
      towerNumber: i,
      currentShots: current_shots,
      targetShots: target_shots,
      status,
    });

    seeds.push({
      id: `tower_${i}`,
      towerNumber: i,
      name: TOWER_NAMES[i - 1],
      material,
      character,
      palette,
      current_shots,
      target_shots,
      status,
      wearTier: damageState.wearTier,
      leanLevel: damageState.leanLevel,
      detachedBlocks: damageState.detachedBlocks,
      blockCracks: damageState.blockCracks,
      ...(winnerName ? { winnerName } : {}),
    });
  }
  return seeds;
}

export const INITIAL_WINNERS: WinnerEntry[] = [
  {
    id: 'win_seed_1',
    towerId: 'tower_52',
    towerNumber: 52,
    towerName: TOWER_NAMES[51],
    winnerName: 'Valeria_99',
    prizeAmount: 1000,
    createdAt: '2026-11-24T13:20:00Z',
  },
  {
    id: 'win_seed_2',
    towerId: 'tower_51',
    towerNumber: 51,
    towerName: TOWER_NAMES[50],
    winnerName: 'Mateo_RX',
    prizeAmount: 1000,
    createdAt: '2026-11-24T10:45:00Z',
  },
];
