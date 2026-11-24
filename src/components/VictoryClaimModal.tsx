import React, { useState } from 'react';
import { Trophy, CheckCircle2, X } from 'lucide-react';
import type { PublicTower, WinnerEntry } from '../game/towersCatalog';
import { validateClaimInput } from '../game/rules';
import { syncClaimToFirestore } from '../firebase';

interface VictoryClaimModalProps {
  isOpen: boolean;
  tower: PublicTower | null;
  onClose: () => void;
  onClaimCompleted: (winner: WinnerEntry, updatedTower: PublicTower) => void;
}

export const VictoryClaimModal: React.FC<VictoryClaimModalProps> = ({
  isOpen,
  tower,
  onClose,
  onClaimCompleted,
}) => {
  const [winnerName, setWinnerName] = useState('');
  const [emailOrWallet, setEmailOrWallet] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<
    'NOWPayments_USDT' | 'NOWPayments_USDC' | 'NOWPayments_SOL' | 'NOWPayments_BTC' | 'BankTransfer'
  >('NOWPayments_USDT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);

  if (!isOpen || !tower) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const check = validateClaimInput({ winnerName, emailOrWallet, payoutMethod });
    if (!check.valid) {
      setError(check.error || 'Verifica los campos del formulario.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          towerId: tower.id,
          winnerName: winnerName.trim(),
          emailOrWallet: emailOrWallet.trim(),
          payoutMethod,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        claimId?: string;
        winner?: WinnerEntry;
        tower?: PublicTower;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.winner || !data.tower) {
        throw new Error(data.error || 'No se pudo registrar el reclamo.');
      }

      if (data.claimId) {
        setClaimId(data.claimId);
        // Sync to Firestore if signed in with verified Firebase account
        void syncClaimToFirestore({
          claimId: data.claimId,
          towerId: tower.id,
          towerNumber: tower.towerNumber,
          towerName: tower.name,
          winnerName: winnerName.trim(),
          emailOrWallet: emailOrWallet.trim(),
          payoutMethod,
        }).catch(() => {
          // Server persistence succeeded; Firestore sync requires signed-in verified user
        });
      }

      onClaimCompleted(data.winner, data.tower);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el reclamo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-modal-title"
    >
      <div className="w-full max-w-lg bg-[#131B31] border-2 border-amber-400 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#1B2542] px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 id="victory-modal-title" className="font-display text-3xl font-extrabold tracking-wide text-amber-400 leading-none">
                ¡GANASTE $1,000 USD!
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Derribaste Torre #{tower.towerNumber} · {tower.name}
              </p>
            </div>
          </div>
          {claimId && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana de victoria"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {claimId ? (
          <div className="p-6 space-y-5 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Premio Registrado Exitosamente</h3>
              <p className="text-sm text-slate-300">
                Código de verificación:{' '}
                <span className="font-mono-num text-amber-400 font-bold">{claimId}</span>
              </p>
              <p className="text-xs text-slate-400">
                Tu victoria ya aparece en el cintillo de ganadores y la torre quedó marcada como DERRIBADA.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
            >
              Volver a las Torres
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-slate-300">
              Completa tus datos para procesar el retiro de tu premio de <strong className="text-amber-400">$1,000 USD</strong>.
            </p>

            <div>
              <label htmlFor="claim-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre completo o Alias de ganador
              </label>
              <input
                id="claim-name"
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={winnerName}
                onChange={(e) => setWinnerName(e.target.value)}
                placeholder="Ej. Carlos Mendoza"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1020] border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label htmlFor="claim-method" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Método de Retiro
              </label>
              <select
                id="claim-method"
                value={payoutMethod}
                onChange={(e) =>
                  setPayoutMethod(
                    e.target.value as
                      | 'NOWPayments_USDT'
                      | 'NOWPayments_USDC'
                      | 'NOWPayments_SOL'
                      | 'NOWPayments_BTC'
                      | 'BankTransfer'
                  )
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1020] border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="NOWPayments_USDT">Cripto NOWPayments — USDT (TRC20 / BEP20 / SOL)</option>
                <option value="NOWPayments_USDC">Cripto NOWPayments — USDC</option>
                <option value="NOWPayments_SOL">Cripto NOWPayments — SOL (Solana)</option>
                <option value="NOWPayments_BTC">Cripto NOWPayments — BTC (Bitcoin)</option>
                <option value="BankTransfer">Transferencia Bancaria Internacional</option>
              </select>
            </div>

            <div>
              <label htmlFor="claim-contact" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo electrónico o Dirección de Wallet
              </label>
              <input
                id="claim-contact"
                type="text"
                required
                minLength={4}
                maxLength={120}
                value={emailOrWallet}
                onChange={(e) => setEmailOrWallet(e.target.value)}
                placeholder="correo@ejemplo.com o dirección TRC20"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1020] border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                {submitting ? 'Enviando reclamo...' : 'Reclamar Premio de $1,000 USD'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
