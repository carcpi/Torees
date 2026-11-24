import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Ha ocurrido un error inesperado en la aplicación.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B1020] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#131B31] border border-white/10 rounded-xl p-6 text-center space-y-4">
            <h1 className="font-display text-3xl font-extrabold tracking-wide text-amber-400">
              ERROR DE CONEXIÓN
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              No se pudo completar una operación en el tablero. Recarga la página para restablecer la sesión.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
            >
              Recargar Juego
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
