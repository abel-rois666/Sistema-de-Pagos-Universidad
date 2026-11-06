import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import ModalConfirmacion from '../components/ui/ModalConfirmacion';
import toast from 'react-hot-toast';

interface Captura { cambios: boolean; guardando: boolean }
interface Proteccion {
  registrar: (id: string, captura?: Captura) => void;
  solicitarSalida: (accion: () => void) => void;
}
const Contexto = createContext<Proteccion>({ registrar: () => {}, solicitarSalida: accion => accion() });

/** Una sola confirmación cubre navegación por menú, enlaces, atrás y cambios de contexto. */
export function ProteccionCapturaProvider({ children }: { children: React.ReactNode }) {
  const capturas = useRef(new Map<string, Captura>());
  const [estado, setEstado] = useState<Captura>({ cambios: false, guardando: false });
  const [salida, setSalida] = useState<{ accion: () => void } | null>(null);
  const salidaAutorizada = useRef(false);
  const registrar = useCallback((id: string, captura?: Captura) => {
    if (captura) capturas.current.set(id, captura); else capturas.current.delete(id);
    const valores = [...capturas.current.values()];
    const siguiente = { cambios: valores.some(c => c.cambios), guardando: valores.some(c => c.guardando) };
    setEstado(anterior => anterior.cambios === siguiente.cambios && anterior.guardando === siguiente.guardando ? anterior : siguiente);
  }, []);
  const blocker = useBlocker(() => !salidaAutorizada.current && (estado.cambios || estado.guardando));
  const solicitarSalida = useCallback((accion: () => void) => {
    if (estado.guardando) { toast('Espera a que termine el guardado.'); return; }
    if (estado.cambios) setSalida({ accion }); else accion();
  }, [estado]);
  const bloqueada = blocker.state === 'blocked';
  return <Contexto.Provider value={{ registrar, solicitarSalida }}>
    {children}
    <ModalConfirmacion isOpen={bloqueada || salida !== null} title={estado.guardando ? 'Guardado en curso' : 'Hay cambios sin guardar'}
      message={estado.guardando ? 'Espera a que termine la operación antes de salir.' : 'Puedes continuar editando o descartar esta captura. Para guardarla, continúa editando y pulsa Guardar.'}
      confirmText="Descartar y continuar" cancelText="Continuar editando" busy={estado.guardando}
      onCancel={() => { setSalida(null); if (blocker.state === 'blocked') blocker.reset(); }}
      onConfirm={() => {
        const accion = salida?.accion; setSalida(null);
        if (blocker.state === 'blocked') blocker.proceed();
        else {
          salidaAutorizada.current = true;
          try { accion?.(); } finally { queueMicrotask(() => { salidaAutorizada.current = false; }); }
        }
      }} />
  </Contexto.Provider>;
}

export function useProteccionCaptura(cambios = false, guardando = false) {
  const id = useId();
  const { registrar, solicitarSalida } = useContext(Contexto);
  useEffect(() => { registrar(id, { cambios, guardando }); return () => registrar(id); }, [id, cambios, guardando, registrar]);
  return solicitarSalida;
}
