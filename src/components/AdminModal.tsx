import React, { useEffect, useState } from 'react';
import { Lock, RotateCcw, Save, ShieldCheck, Sparkles, X, CloudUpload } from 'lucide-react';
import type { AdminTower, PublicTower } from '../game/towersCatalog';
import { ADMIN_EMAIL, auth, signInWithGooglePopup, syncAdminTowersToFirestore } from '../firebase';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTowerId: string | null;
  playerId: string;
  onSimulateWinReady: (tower: PublicTower, shotsBalance?: number) => void;
  onTowersUpdated: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  activeTowerId,
  playerId,
  onSimulateWinReady,
  onTowersUpdated,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [towers, setTowers] = useState<AdminTower[]>([]);
  const [draftTargets, setDraftTargets] = useState<Record<string, string>>({});
  const [selectedWinTowerId, setSelectedWinTowerId] = useState<string>(activeTowerId || 'tower_1');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [syncingFirestore, setSyncingFirestore] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTowerId) {
      setSelectedWinTowerId(activeTowerId);
    }
    if (!token) {
      void fetch('/api/admin/status')
        .then((r) => r.json())
        .then((d: { needsSetup?: boolean }) => setNeedsSetup(Boolean(d.needsSetup)))
        .catch(() => {});
    } else {
      void fetchAdminTowers(token);
    }
  }, [isOpen, activeTowerId, token]);

  const fetchAdminTowers = async (bearer: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/towers', {
        headers: { Authorization: `Bearer ${bearer}` },
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setToken(null);
        }
        return;
      }
      const data = (await res.json()) as { towers: AdminTower[] };
      setTowers(data.towers);
      const drafts: Record<string, string> = {};
      data.towers.forEach((t) => {
        drafts[t.id] = String(t.target_shots);
      });
      setDraftTargets(drafts);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const endpoint = needsSetup ? '/api/admin/setup' : '/api/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string };
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'No se pudo autenticar.');
      }
      setPasscode('');
      setNeedsSetup(false);
      setToken(data.token);
      await fetchAdminTowers(data.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Error de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAdminAuth = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInWithGooglePopup();
        currentUser = cred.user;
      }
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseIdToken: idToken }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string };
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Cuenta sin permisos de administrador.');
      }
      setToken(data.token);
      await fetchAdminTowers(data.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'No se pudo validar la sesión Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTarget = async (towerId: string) => {
    if (!token) return;
    const val = Number.parseInt(draftTargets[towerId] || '', 10);
    if (!Number.isInteger(val) || val < 1 || val > 1000000) {
      setStatusMessage('Ingresa un entero válido entre 1 y 1,000,000.');
      return;
    }
    const res = await fetch(`/api/admin/towers/${towerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ target_shots: val }),
    });
    if (res.ok) {
      setStatusMessage(`Meta de ${towerId} actualizada a ${val.toLocaleString()} tiros.`);
      await fetchAdminTowers(token);
      onTowersUpdated();
    }
  };

  const handleResetTower = async (towerId: string) => {
    if (!token) return;
    const res = await fetch(`/api/admin/towers/${towerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reset: true }),
    });
    if (res.ok) {
      setStatusMessage(`Torre ${towerId} reiniciada a estado ACTIVA.`);
      await fetchAdminTowers(token);
      onTowersUpdated();
    }
  };

  const handleSimulateWinningShot = async () => {
    if (!token) return;
    const targetId = activeTowerId || selectedWinTowerId;
    const res = await fetch(`/api/admin/simulate-win/${targetId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ playerId }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      publicTower?: PublicTower;
      shotsBalance?: number;
    };
    if (res.ok && data.publicTower) {
      onTowersUpdated();
      onSimulateWinReady(data.publicTower, data.shotsBalance);
      onClose();
    }
  };

  const handleSyncFirestore = async () => {
    setSyncingFirestore(true);
    setStatusMessage(null);
    try {
      if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        await signInWithGooglePopup();
      }
      await syncAdminTowersToFirestore(towers);
      setStatusMessage('52 torres y metas secretas sincronizadas con Firestore.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'No se pudo sincronizar con Firestore.');
    } finally {
      setSyncingFirestore(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[88vh] bg-[#11182C] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h2 id="admin-modal-title" className="font-display text-2xl font-extrabold tracking-wide text-white">
              PANEL ADMIN DEMO
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de administración"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!token ? (
          <div className="p-6 max-w-md mx-auto w-full space-y-5">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0B1020] border border-white/10">
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-xs text-slate-300 leading-relaxed">
                {needsSetup
                  ? 'Configura por única vez una clave de administrador para desbloquear el panel secreto de las 52 torres.'
                  : 'Área protegida. Ingresa la clave de administrador o autentícate con la cuenta Google autorizada.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label htmlFor="admin-passcode" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {needsSetup ? 'Nueva clave de administrador' : 'Clave de administrador'}
                </label>
                <input
                  id="admin-passcode"
                  type="password"
                  required
                  minLength={4}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1020] border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {authError && (
                <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-200">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                {loading
                  ? 'Verificando...'
                  : needsSetup
                  ? 'Guardar Clave y Entrar'
                  : 'Desbloquear Panel Admin'}
              </button>
            </form>

            <div className="pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleGoogleAdminAuth}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Acceder con Google ({ADMIN_EMAIL})
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="px-6 py-3.5 bg-[#0B1020] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2.5">
                {!activeTowerId && (
                  <select
                    aria-label="Seleccionar torre para simular tiro ganador"
                    value={selectedWinTowerId}
                    onChange={(e) => setSelectedWinTowerId(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[#131B31] border border-white/15 text-xs text-white"
                  >
                    {towers.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.towerNumber} {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={handleSimulateWinningShot}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Simular Tiro Ganador {activeTowerId ? `(Escenario Activo)` : ''}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSyncFirestore}
                disabled={syncingFirestore}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <CloudUpload className="w-4 h-4 text-sky-400" />
                {syncingFirestore ? 'Sincronizando...' : 'Sincronizar Firestore'}
              </button>
            </div>

            {statusMessage && (
              <div className="px-6 py-2 bg-emerald-500/15 border-b border-emerald-500/25 text-xs text-emerald-200 shrink-0">
                {statusMessage}
              </div>
            )}

            {/* 50 Towers Table */}
            <div className="flex-1 overflow-auto p-4">
              {loading && towers.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-400">Cargando 52 torres...</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Torre</th>
                      <th className="py-2 px-2">Estado</th>
                      <th className="py-2 px-2 text-right">Tiros Actuales</th>
                      <th className="py-2 px-2 text-right">Meta Secreta</th>
                      <th className="py-2 px-2 text-right">Restantes</th>
                      <th className="py-2 px-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {towers.map((t) => (
                      <tr key={t.id} className="hover:bg-white/5">
                        <td className="py-2 px-2 font-mono-num text-slate-400">#{t.towerNumber}</td>
                        <td className="py-2 px-2 font-medium text-white">{t.name}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`font-semibold ${
                              t.status === 'ACTIVA' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono-num text-slate-200">
                          {t.current_shots.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min={1}
                            max={1000000}
                            aria-label={`Meta de disparos Torre ${t.towerNumber}`}
                            value={draftTargets[t.id] ?? String(t.target_shots)}
                            onChange={(e) =>
                              setDraftTargets((prev) => ({ ...prev, [t.id]: e.target.value }))
                            }
                            className="w-24 px-2 py-1 rounded bg-[#0B1020] border border-white/15 text-right font-mono-num text-amber-300"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-mono-num text-slate-300">
                          {t.remaining_shots.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveTarget(t.id)}
                              title="Guardar meta"
                              aria-label={`Guardar meta Torre ${t.towerNumber}`}
                              className="p-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetTower(t.id)}
                              title="Reiniciar torre"
                              aria-label={`Reiniciar Torre ${t.towerNumber}`}
                              className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
