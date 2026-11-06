import type { CicloEscolar } from '../types';

export interface OpcionesCicloModulo {
  todos?: boolean;
  valorTodos?: string;
  inicialId?: string;
}

/** Preferencia local > sugerencia institucional única. El contexto global legado
 * no debe decidir entre ciclos homónimos de periodicidades distintas. */
export function elegirCicloModulo(ciclos: readonly CicloEscolar[], sugeridoId: string,
  guardado: string | null, opciones: OpcionesCicloModulo = {}): string {
  const valorTodos = opciones.valorTodos ?? 'TODOS';
  if (!ciclos.length) return opciones.inicialId ?? guardado ?? (opciones.todos ? valorTodos : '');
  const valido = (id: string) => (opciones.todos && id === valorTodos)
    || ciclos.some(ciclo => ciclo.id === id);
  if (opciones.inicialId !== undefined && valido(opciones.inicialId)) return opciones.inicialId;
  if (guardado !== null && valido(guardado)) return guardado;
  if (opciones.todos) return valorTodos;
  const ordenados = [...ciclos].sort((a, b) => b.nombre.localeCompare(a.nombre, 'es-MX', { numeric: true })
    || (a.tipo_periodo || '').localeCompare(b.tipo_periodo || '', 'es-MX') || a.id.localeCompare(b.id));
  const activos=ordenados.filter(ciclo=>ciclo.activo);
  if(activos.length===1)return activos[0].id;
  if(activos.length>1)return '';
  const recientes=ordenados.filter(ciclo=>ciclo.nombre===ordenados[0]?.nombre);
  return recientes.length===1?recientes[0].id:'';
}
