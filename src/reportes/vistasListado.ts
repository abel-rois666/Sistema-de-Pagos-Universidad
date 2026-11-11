import { COLUMNAS_LISTADO, fechaActualListado, fechaCivilValida, type ColumnaListadoId } from './listadoGeneral';
import type { SeleccionFiltrosColumnas } from './filtrosColumnasListado';

export interface ConfiguracionVistaListado {
  version: 1;
  columnas: ColumnaListadoId[];
  filtros: { ciclos: string[]; licenciaturas: string[]; tiposPlan: string[]; turnos: string[]; estatus: string[] };
  filtrosColumnas: SeleccionFiltrosColumnas;
  orden: { columna: ColumnaListadoId; descendente: boolean };
  fechaEdad: { modo: 'hoy' | 'fija'; valor: string | null };
}
export interface VistaListado {
  id: string; nombre: string; configuracion: ConfiguracionVistaListado;
  predeterminada: boolean; revision: number;
}
export const configuracionInicialListado = (): ConfiguracionVistaListado => ({ version: 1, columnas: ['email'],
  filtros: { ciclos: [], licenciaturas: [], tiposPlan: [], turnos: [], estatus: [] }, filtrosColumnas: {},
  orden: { columna: 'nombre', descendente: false }, fechaEdad: { modo: 'hoy', valor: null } });

const objeto = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const fallar = (): never => { throw new Error('La vista guardada tiene una configuración incompatible. Actualiza la consulta o crea una vista nueva.'); };
function lista(v: unknown): string[] {
  if (!Array.isArray(v) || v.length > 200 || v.some(x => typeof x !== 'string' || !x.trim() || x.length > 200)) return fallar();
  return [...new Set(v as string[])];
}
function claves(v: Record<string, unknown>, permitidas: string[]) {
  if (Object.keys(v).some(k => !permitidas.includes(k))) fallar();
}
/** Valida antes de restaurar; nunca elimina filtros desconocidos ampliando la población. */
export function leerConfiguracionVista(v: unknown): ConfiguracionVistaListado {
  if (!objeto(v) || v.version !== 1 || !objeto(v.filtros) || !objeto(v.orden) || !objeto(v.fechaEdad) || !objeto(v.filtrosColumnas)) return fallar();
  claves(v, ['version', 'columnas', 'filtros', 'filtrosColumnas', 'orden', 'fechaEdad']);
  claves(v.filtros, ['ciclos', 'licenciaturas', 'tiposPlan', 'turnos', 'estatus']);
  claves(v.orden, ['columna', 'descendente']); claves(v.fechaEdad, ['modo', 'valor']);
  const opcionales = COLUMNAS_LISTADO.filter(c => c.opcional).map(c => c.id);
  const columnas = lista(v.columnas) as ColumnaListadoId[];
  if (columnas.some(c => !opcionales.includes(c))) return fallar();
  const filtros = Object.fromEntries(['ciclos', 'licenciaturas', 'tiposPlan', 'turnos', 'estatus'].map(k => [k, lista(v.filtros![k])])) as ConfiguracionVistaListado['filtros'];
  if (filtros.ciclos.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return fallar();
  const filtrosColumnas: SeleccionFiltrosColumnas = {};
  for (const [k, valores] of Object.entries(v.filtrosColumnas)) {
    if (!columnas.includes(k as ColumnaListadoId)) return fallar();
    filtrosColumnas[k as ColumnaListadoId] = lista(valores);
  }
  const columna = v.orden.columna as ColumnaListadoId;
  if (!COLUMNAS_LISTADO.some(c => c.id === columna && (!c.opcional || columnas.includes(columna))) || typeof v.orden.descendente !== 'boolean') return fallar();
  if (!['hoy', 'fija'].includes(v.fechaEdad.modo as string)) return fallar();
  if (v.fechaEdad.modo === 'hoy' ? v.fechaEdad.valor !== null
    : typeof v.fechaEdad.valor !== 'string' || !fechaCivilValida(v.fechaEdad.valor) || v.fechaEdad.valor > fechaActualListado()) return fallar();
  return { version: 1, columnas, filtros, filtrosColumnas, orden: { columna, descendente: v.orden.descendente },
    fechaEdad: { modo: v.fechaEdad.modo as 'hoy' | 'fija', valor: v.fechaEdad.valor as string | null } };
}
export function firmaVista(v: ConfiguracionVistaListado): string {
  // Los filtros y columnas se comparan como conjuntos; no dependen del orden de marcado.
  const ordenar = (a: readonly string[]) => [...a].sort();
  return JSON.stringify({ ...v, columnas: ordenar(v.columnas),
    filtros: Object.fromEntries(Object.entries(v.filtros).sort().map(([k, a]) => [k, ordenar(a)])),
    filtrosColumnas: Object.fromEntries(Object.entries(v.filtrosColumnas).filter(([, a]) => a?.length).sort().map(([k, a]) => [k, ordenar(a!)])) });
}
export function fechaVista(v: ConfiguracionVistaListado) { return v.fechaEdad.modo === 'hoy' ? fechaActualListado() : v.fechaEdad.valor!; }
