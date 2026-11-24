import React, { useState } from 'react';
import { Coins, CheckCircle2, X, Zap } from 'lucide-react';
import {
  CRYPTO_CURRENCIES,
  SHOP_PACKAGES,
  type CryptoCurrency,
  type ShopPackage,
} from '../game/towersCatalog';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shotsBalance: number;
  onPurchaseSuccess: (creditedShots: number, newBalance: number) => void;
  playerId: string;
  outOfShotsReason?: boolean;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  shotsBalance,
  onPurchaseSuccess,
  playerId,
  outOfShotsReason = false,
}) => {
  const [selectedPkg, setSelectedPkg] = useState<ShopPackage['id']>('popular');
  const [cryptoCurrency, setCryptoCurrency] = useState<CryptoCurrency>('USDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPkg = SHOP_PACKAGES.find((p) => p.id === selectedPkg) ?? SHOP_PACKAGES[1];

  const handleSimulatePayment = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          packageId: selectedPkg,
          paymentMethod: 'NOWPayments',
          cryptoCurrency,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        creditedShots?: number;
        shotsBalance?: number;
        error?: string;
      };
      if (!res.ok || !data.ok || typeof data.shotsBalance !== 'number') {
        throw new Error(data.error || 'No se pudo procesar el pago.');
      }
      onPurchaseSuccess(data.creditedShots || currentPkg.shots, data.shotsBalance);
      setSuccessMsg(
        `+${data.creditedShots} tiros acreditados con ${cryptoCurrency} (NOWPayments). Nuevo saldo: ${data.shotsBalance} tiros.`
      );
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-modal-title"
    >
      <div className="w-full max-w-2xl bg-[#131B31] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 id="shop-modal-title" className="font-display text-2xl font-extrabold tracking-wide text-white">
              TIENDA DE TIROS
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {outOfShotsReason
                ? 'Te quedaste sin tiros. Recarga un paquete para seguir disparando.'
                : `Saldo actual: ${shotsBalance} tiros disponibles`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tienda"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 3 exact commercial packages */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SHOP_PACKAGES.map((pkg) => {
              const isSelected = selectedPkg === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPkg(pkg.id)}
                  className={`relative text-left rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#1B2746] border-amber-400 ring-2 ring-amber-400/40'
                      : pkg.featured
                      ? 'bg-[#17213B] border-amber-500/40 hover:border-amber-400'
                      : 'bg-[#0F1629] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 min-h-[20px]">
                      <span className="text-xs font-semibold text-slate-300">{pkg.name}</span>
                      {pkg.badgeText && (
                        <span className="text-[10px] font-extrabold tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded whitespace-nowrap">
                          {pkg.badgeText}
                        </span>
                      )}
                    </div>

                    <div className="font-display text-3xl font-extrabold text-white font-mono-num">
                      {pkg.shots} Tiros
                    </div>
                    <p className="text-xs text-emerald-400 font-medium mt-1 min-h-[16px]">
                      {pkg.bonusShots > 0 ? `Incluye ${pkg.bonusShots} tiros extra` : 'Acreditación instantánea'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Precio</span>
                    <span className="font-mono-num text-lg font-bold text-amber-400">
                      ${pkg.priceUsd} USD
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Exclusive NOWPayments Crypto Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Coins className="w-4 h-4 text-emerald-400" />
                Pago exclusivo con Criptomonedas vía NOWPayments
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold">Instantáneo · Sin tarjeta</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CRYPTO_CURRENCIES.map((coin) => {
                const selected = cryptoCurrency === coin.id;
                return (
                  <button
                    key={coin.id}
                    type="button"
                    onClick={() => setCryptoCurrency(coin.id)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#1B2746] border-amber-400 text-white ring-1 ring-amber-400/50'
                        : 'bg-[#0F1629] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="font-mono-num text-sm font-bold text-amber-400">{coin.label}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{coin.network}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-200">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
            <div className="text-xs text-slate-400">
              Total seleccionado:{' '}
              <strong className="text-white font-mono-num">
                {currentPkg.name} · ${currentPkg.priceUsd} USD ({cryptoCurrency})
              </strong>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleSimulatePayment}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-4 h-4" />
              {loading ? 'Acreditando...' : 'Simular Pago Exitoso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
