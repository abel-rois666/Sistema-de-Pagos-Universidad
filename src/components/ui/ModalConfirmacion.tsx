import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

const dialogosActivos = new Set<HTMLElement>();
const fondosAnteriores = new Map<HTMLElement, boolean>();
function actualizarFondosDialogo() {
  const superior = [...dialogosActivos].at(-1);
  for (const hijo of Array.from(document.body.children)) {
    if (!(hijo instanceof HTMLElement)) continue;
    if (!fondosAnteriores.has(hijo)) fondosAnteriores.set(hijo, hijo.inert);
    hijo.inert = Boolean(superior && !hijo.contains(superior)) || fondosAnteriores.get(hijo)!;
  }
  if (!dialogosActivos.size) {
    for (const [elemento, inert] of fondosAnteriores) elemento.inert = inert;
    fondosAnteriores.clear();
  }
}
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ModalConfirmacionProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm?: () => void | Promise<unknown>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
  type?: 'danger' | 'warning' | 'info';
  busy?: boolean;
}

export default function ModalConfirmacion({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isAlert = false,
  type = 'warning',
  busy = false
}: ModalConfirmacionProps) {
  const titleId = useId();
  const messageId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState('');
  const bloqueo = useRef(false);
  const ocupado = busy || confirmando;
  const estado = useRef({ ocupado, onCancel, isAlert, onConfirm });
  estado.current = { ocupado, onCancel, isAlert, onConfirm };
  useEffect(() => {
    if (!isOpen) return;
    setErrorOperacion('');
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const nodo: HTMLDivElement | null = dialog.current;
    if (nodo) { dialogosActivos.add(nodo); actualizarFondosDialogo(); }
    const focusables = () => Array.from(nodo?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
    (focusables().find(el => el.dataset.cancelar === 'true') || focusables()[0] || nodo)?.focus();
    const teclado = (event: KeyboardEvent) => {
      // Solo el diálogo superior recibe Escape y Tab cuando hay diálogos anidados.
      const modales = document.querySelectorAll('[data-confirmacion="true"]');
      if (modales[modales.length - 1] !== nodo) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (!estado.current.ocupado) estado.current.onCancel();
      }
      if (event.key === 'Tab') {
        const elementos = focusables();
        const primero = elementos[0]; const ultimo = elementos[elementos.length - 1];
        if (!primero) { event.preventDefault(); nodo?.focus(); }
        else if (event.shiftKey && (document.activeElement === primero || !nodo?.contains(document.activeElement))) { event.preventDefault(); ultimo.focus(); }
        else if (!event.shiftKey && (document.activeElement === ultimo || !nodo?.contains(document.activeElement))) { event.preventDefault(); primero.focus(); }
      }
    };
    document.addEventListener('keydown', teclado, true);
    return () => {
      document.removeEventListener('keydown', teclado, true);
      if (nodo) { dialogosActivos.delete(nodo); actualizarFondosDialogo(); }
      if (anterior?.isConnected) anterior.focus({ preventScroll: true });
    };
  }, [isOpen]);
  const confirmar = async () => {
    if (bloqueo.current || ocupado || !onConfirm) return;
    bloqueo.current = true; setConfirmando(true); setErrorOperacion('');
    try { await onConfirm(); }
    catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo completar la operación.';
      setErrorOperacion(mensaje); toast.error(mensaje);
    }
    finally { bloqueo.current = false; setConfirmando(false); }
  };
  if (!isOpen) return null;

  const Icon = type === 'info' ? Info : AlertTriangle;
  
  const getIconColors = () => {
    switch (type) {
      case 'danger': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'info': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'warning': default: return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  const getButtonColors = () => {
    switch (type) {
      case 'danger': return 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
      case 'info': return 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500';
      case 'warning': default: return 'bg-amber-700 hover:bg-amber-800 text-white focus:ring-amber-500';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        ref={dialog}
        tabIndex={-1}
        data-confirmacion="true"
        className="bg-white dark:bg-[#1c2228] w-full max-w-md max-h-[calc(100dvh-2rem)] rounded-2xl shadow-xl overflow-y-auto transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        aria-busy={ocupado}
      >
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${getIconColors()}`}>
              <Icon size={24} aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id={titleId}>
                {title}
              </h3>
              <div className="mt-2">
                <div id={messageId} className="text-sm text-gray-600 dark:text-gray-300">
                  {message}
                </div>
                {errorOperacion && <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">{errorOperacion}</p>}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-[#181e25] px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-800">
          {!isAlert && onConfirm && (
            <button
              type="button"
              disabled={ocupado}
              className={`min-h-11 w-full inline-flex items-center justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto ${getButtonColors()} disabled:opacity-50 dark:focus:ring-offset-[#181e25]`}
              onClick={() => void confirmar()}
            >
              {ocupado ? 'Procesando…' : confirmText}
            </button>
          )}
          {isAlert && onConfirm && (
            <button
              type="button"
              className={`min-h-11 w-full inline-flex items-center justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm bg-[#1456f0] hover:bg-blue-700 text-white focus:ring-blue-500 dark:focus:ring-offset-[#181e25]`}
              disabled={ocupado}
              onClick={() => void confirmar()}
            >
              {confirmText}
            </button>
          )}
          {!isAlert && (
            <button
              type="button"
              data-cancelar="true"
              disabled={ocupado}
              className="mt-3 min-h-11 w-full inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:focus:ring-offset-[#181e25]"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>, document.body
  );
}
