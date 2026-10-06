import { supabase } from '../lib/supabase';

type Filtro = { campo: string; valor: string | number | boolean } | { campo: string; valores: string[] };

/** Recorre páginas de PostgREST para no truncar docentes, grupos o sesiones en 1 000 filas. */
export async function leerTodasFilas<T>(tabla: string, columnas: string, ordenar = 'id', filtro?: Filtro): Promise<T[]> {
  const filas: T[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    let consulta = supabase.from(tabla).select(columnas).order(ordenar).range(inicio, inicio + 999);
    if (filtro) consulta = 'valores' in filtro
      ? consulta.in(filtro.campo, filtro.valores)
      : consulta.eq(filtro.campo, filtro.valor);
    const { data, error } = await consulta;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    const pagina = (data || []) as T[];
    filas.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return filas;
}

export async function leerPorIds<T>(tabla: string, columnas: string, campo: string, ids: string[], ordenar = 'id'): Promise<T[]> {
  const filas: T[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    filas.push(...await leerTodasFilas<T>(tabla, columnas, ordenar, { campo, valores: ids.slice(i, i + 80) }));
  }
  return filas;
}
