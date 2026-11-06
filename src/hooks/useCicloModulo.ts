import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import type { CicloEscolar } from '../types';
import { elegirCicloModulo, type OpcionesCicloModulo } from '../utils/cicloModulo';

/** Conserva el ciclo de consulta de cada módulo y usuario sin alterar otros módulos. */
export function useCicloModulo(
  modulo: string,
  ciclos: readonly CicloEscolar[],
  sugeridoId: string,
  usuarioId?: string,
  opciones: OpcionesCicloModulo = {},
) {
  const clave = usuarioId ? `ciclo_modulo:${usuarioId}:${modulo}` : '';
  const valorTodos = opciones.valorTodos ?? 'TODOS';
  const leerInicial = () => {
    let guardado: string | null = null;
    if (clave) {
      try {
        guardado = localStorage.getItem(clave);
      } catch { /* La selección sigue disponible durante esta visita. */ }
    }
    return elegirCicloModulo(ciclos, sugeridoId, guardado, opciones);
  };
  const [seleccion, setSeleccion] = useState(() => ({ clave, id: leerInicial() }));
  // Un cambio de usuario nunca expone ni sobrescribe la preferencia del anterior.
  const cicloId = seleccion.clave === clave ? seleccion.id : leerInicial();
  const setCicloId = useCallback((valor: SetStateAction<string>) => {
    setSeleccion(anterior => ({ clave,
      id: typeof valor === 'function' ? valor(anterior.clave === clave ? anterior.id : '') : valor }));
  }, [clave]);

  useEffect(() => {
    if (seleccion.clave !== clave) {
      setSeleccion({ clave, id: cicloId });
      return;
    }
    if (!ciclos.length || (cicloId === valorTodos && opciones.todos)
      || ciclos.some(ciclo => ciclo.id === cicloId)) return;
    setCicloId(elegirCicloModulo(ciclos, sugeridoId, null, opciones));
  }, [clave, seleccion.clave, cicloId, ciclos, opciones.todos, opciones.inicialId, sugeridoId, valorTodos, setCicloId]);

  useEffect(() => {
    if (!clave || !ciclos.length || seleccion.clave !== clave || (!opciones.todos && !ciclos.some(ciclo => ciclo.id === cicloId))) return;
    if (cicloId !== valorTodos && !ciclos.some(ciclo => ciclo.id === cicloId)) return;
    try { localStorage.setItem(clave, cicloId); } catch { /* Almacenamiento opcional. */ }
  }, [clave, seleccion.clave, cicloId, ciclos, opciones.todos, valorTodos]);

  return [cicloId, setCicloId] as const;
}
