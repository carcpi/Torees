import React from 'react';
import { Trophy } from 'lucide-react';
import type { WinnerEntry } from '../game/towersCatalog';

interface WinnersTickerProps {
  winners: WinnerEntry[];
}

export const WinnersTicker: React.FC<WinnersTickerProps> = ({ winners }) => {
  const items = winners.length > 0 ? winners : [];
  if (items.length === 0) return null;

  const repeated = [...items, ...items, ...items];

  return (
    <div
      className="w-full bg-[#080C18] border-b border-white/10 overflow-hidden py-1.5"
      aria-label="Últimos ganadores de $1,000 USD"
    >
      <div className="animate-marquee flex items-center gap-8 text-xs font-medium text-slate-300 whitespace-nowrap">
        {repeated.map((w, index) => (
          <span key={`${w.id}-${index}`} className="inline-flex items-center gap-2 shrink-0">
            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="text-white font-semibold">{w.winnerName}</span>
            <span className="text-slate-400">derribó</span>
            <span className="text-amber-300 font-semibold">
              #{w.towerNumber} {w.towerName}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono-num text-emerald-400 font-bold">$1,000 USD</span>
          </span>
        ))}
      </div>
    </div>
  );
};
