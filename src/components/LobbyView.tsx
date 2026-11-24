import React, { useMemo, useState } from 'react';
import { Crosshair, Search, Shield, Trophy, UserCheck, LogOut } from 'lucide-react';
import {
  CHARACTERS,
  MATERIALS,
  type MaterialId,
  type PublicTower,
  type WinnerEntry,
} from '../game/towersCatalog';
import { TowerThumbnailSvg } from './TowerVectorArt';
import { WinnersTicker } from './WinnersTicker';

interface LobbyViewProps {
  towers: PublicTower[];
  winners: WinnerEntry[];
  shotsBalance: number;
  loading: boolean;
  userEmail: string | null;
  onGoogleAuthClick: () => void;
  onGoogleSignOut: () => void;
  onEnterTower: (tower: PublicTower) => void;
  onOpenShop: () => void;
  onOpenAdmin: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  towers,
  winners,
  shotsBalance,
  loading,
  userEmail,
  onGoogleAuthClick,
  onGoogleSignOut,
  onEnterTower,
  onOpenShop,
  onOpenAdmin,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVA' | 'DERRIBADA'>('ALL');
  const [materialFilter, setMaterialFilter] = useState<'ALL' | MaterialId>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTowers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return towers.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (materialFilter !== 'ALL' && t.material !== materialFilter) return false;
      if (q) {
        const hay = `#${t.towerNumber} ${t.name} ${CHARACTERS[t.character].label} ${MATERIALS[t.material].label}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [towers, statusFilter, materialFilter, searchTerm]);

  const activeCount = useMemo(() => towers.filter((t) => t.status === 'ACTIVA').length, [towers]);
  const collapsedCount = towers.length - activeCount;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1020] text-[#F8FAFC]">
      {/* Sticky Top Winners Ticker + Fixed Arcade Header */}
      <div className="sticky top-0 z-20 bg-[#0B1020] border-b border-white/10">
        <WinnersTicker winners={winners} />

        <header className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <svg
              viewBox="0 0 36 36"
              className="w-6 h-6 sm:w-8 sm:h-8 shrink-0"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="32" height="32" rx="8" fill="#F59E0B" />
              <rect x="11" y="18" width="14" height="10" rx="2" fill="#0B1020" />
              <rect x="13" y="9" width="10" height="8" rx="2" fill="#0B1020" />
              <circle cx="18" cy="6" r="2.5" fill="#0B1020" />
            </svg>
            <span className="font-display text-lg sm:text-3xl font-extrabold tracking-wide text-white whitespace-nowrap shrink-0">
              TOWER DROP <span className="text-amber-400">1000</span>
            </span>
          </div>

          {/* Zone 2: Account & Balance */}
          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            {userEmail ? (
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-300">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[160px]">{userEmail}</span>
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  aria-label="Cerrar sesión Google"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onGoogleAuthClick}
                className="hidden sm:inline-flex items-center text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Guardar Progreso (Google)
              </button>
            )}

            <div className="flex items-center bg-[#131B31] border border-white/10 rounded-xl px-2.5 sm:px-3.5 py-1 sm:py-1.5 shrink-0">
              <div className="text-right">
                <span className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-none">
                  Tus Tiros
                </span>
                <span
                  data-testid="lobby-shots-balance"
                  className="font-mono-num text-base sm:text-lg font-bold text-amber-400 leading-tight"
                >
                  {shotsBalance}
                </span>
              </div>
            </div>

            {/* Zone 3: Primary Action */}
            <button
              type="button"
              onClick={onOpenShop}
              className="inline-flex items-center px-2.5 sm:px-4 py-2 sm:py-2.5 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>+ Comprar Tiros</span>
            </button>
          </div>
        </header>
      </div>

      {/* Main Lobby Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-7">
        {/* Hero Summary + Filters */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-white/10">
          <div className="space-y-2 max-w-2xl">
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-none text-balance">
              LOBBY DE 50 TORRES ACTIVAS
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Cada disparo debilita la estructura en tiempo real. Cualquier torre activa puede caer en el próximo impacto y otorgar{' '}
              <strong className="text-amber-400 font-semibold">$1,000 USD</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
              <span>
                <strong className="text-emerald-400 font-mono-num">{activeCount}</strong> Torres Activas
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-rose-400 font-mono-num">{collapsedCount}</strong> Derribadas
              </span>
              <span aria-hidden="true">·</span>
              <span>Premio fijo $1,000 USD por torre</span>
            </div>
          </div>

          {/* Interactive Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#131B31] border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Todas ({towers.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === 'ACTIVA'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Activas ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DERRIBADA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === 'DERRIBADA'
                    ? 'bg-rose-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Derribadas ({collapsedCount})
              </button>
            </div>

            <select
              aria-label="Filtrar por material de torre"
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value as 'ALL' | MaterialId)}
              className="px-3 py-2 rounded-xl bg-[#131B31] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">Todos los materiales</option>
              {Object.values(MATERIALS).map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Buscar torre o personaje"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar # o jefe..."
                className="pl-8 pr-3 py-2 rounded-xl bg-[#131B31] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-44"
              />
            </div>
          </div>
        </section>

        {/* 50-Tower Responsive Grid */}
        {loading && towers.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-80 rounded-2xl bg-[#131B31] border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : filteredTowers.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-[#131B31] border border-white/10 rounded-2xl">
            <p className="text-base font-semibold text-white">No hay torres que coincidan con tu filtro.</p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setMaterialFilter('ALL');
                setSearchTerm('');
              }}
              className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Mostrar todas las Torres
            </button>
          </div>
        ) : (
          <section
            data-testid="towers-grid"
            aria-label="Cuadrícula de torres"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {filteredTowers.map((tower) => {
              const mat = MATERIALS[tower.material];
              const char = CHARACTERS[tower.character];
              const isCollapsed = tower.status === 'DERRIBADA';

              return (
                <article
                  key={tower.id}
                  data-testid={`tower-card-${tower.towerNumber}`}
                  className="bg-[#131B31] border border-white/10 hover:border-amber-400/50 rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-colors"
                >
                  <div className="space-y-3">
                    {/* Top Clean Unboxed Metadata */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 truncate">
                        <span className="font-mono-num font-bold text-amber-400">#{tower.towerNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{mat.label}</span>
                      </div>
                      <span
                        className={`font-bold tracking-wide text-[11px] shrink-0 ${
                          isCollapsed ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {tower.status}
                      </span>
                    </div>

                    {/* Vector Illustration */}
                    <TowerThumbnailSvg
                      towerNumber={tower.towerNumber}
                      material={tower.material}
                      character={tower.character}
                      palette={tower.palette}
                      status={tower.status}
                      wearTier={tower.wearTier}
                      leanLevel={tower.leanLevel}
                    />

                    {/* Tower Name & Boss Character */}
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-wide text-white leading-tight truncate">
                        {tower.name}
                      </h2>
                      <div className="flex items-center justify-between gap-2 mt-1 text-xs text-slate-300">
                        <span className="truncate">Jefe: {char.label}</span>
                        <span className="inline-flex items-center gap-1 font-mono-num font-bold text-amber-400 shrink-0">
                          <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                          $1,000 USD
                        </span>
                      </div>
                    </div>

                    {/* Suspense Status Line (No progress bar or percentage) */}
                    <p
                      className={`text-xs font-medium py-2 px-3 rounded-xl border ${
                        isCollapsed
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                          : 'bg-[#0B1020] border-white/10 text-amber-300'
                      }`}
                    >
                      {isCollapsed
                        ? 'Estado: Derribada • Premio $1,000 USD entregado'
                        : 'Estado: En pie • ¡Puede caer en cualquier tiro!'}
                    </p>
                  </div>

                  {/* Card Action */}
                  <button
                    type="button"
                    onClick={() => onEnterTower(tower)}
                    className={`w-full py-2.5 px-4 min-h-[42px] rounded-xl font-bold text-xs tracking-wide inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      isCollapsed
                        ? 'bg-white/10 hover:bg-white/15 text-slate-200'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    <Crosshair className="w-4 h-4" aria-hidden="true" />
                    <span>{isCollapsed ? 'VER ESCENARIO DERRIBADO' : 'ENTRAR A DISPARAR'}</span>
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {/* Quiet Footer with Discreet Admin Demo Button */}
      <footer className="border-t border-white/10 bg-[#080C18]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            TOWER DROP 1000 · Física 2D en tiempo real · Todos los premios demo son simulados.
          </p>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer py-1 px-2 rounded"
          >
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Admin Demo</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
