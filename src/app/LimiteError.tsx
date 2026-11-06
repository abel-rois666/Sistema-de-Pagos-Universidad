import React, { Component, type ErrorInfo } from 'react';

/** Aísla una pantalla fallida sin borrar el store ni recargar toda la aplicación. */
export default class LimiteError extends Component<{ children: React.ReactNode }, { fallo: boolean }> {
  // Contrato explícito mientras el proyecto conserva React sin @types/react.
  declare props: { children: React.ReactNode };
  declare setState: (estado: { fallo: boolean }) => void;
  state = { fallo: false };
  static getDerivedStateFromError() { return { fallo: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Error de pantalla:', error, info.componentStack); }
  render() {
    if (!this.state.fallo) return this.props.children;
    return <div role="alert" className="m-4 rounded-xl border border-red-200 bg-white p-6 text-gray-900 dark:border-red-900 dark:bg-gray-900 dark:text-gray-100">
      <h1 className="text-lg font-semibold">No se pudo mostrar esta sección</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Los datos guardados se conservan. Puedes volver a intentar abrir la sección. La captura no guardada podría requerir revisión.</p>
      <button type="button" onClick={() => this.setState({ fallo: false })} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Volver a intentar</button>
    </div>;
  }
}
