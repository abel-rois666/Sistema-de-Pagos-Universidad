import type { CicloEscolar } from '../types';

const normalizar = (valor: string | null | undefined) => (valor || '').trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const periodo = (ciclo: CicloEscolar): number | null => {
  const partes = ciclo.nombre.match(/\b(\d{2,4})\s*[-/]\s*(\d{1,2})\b/);
  if (!partes) return null;
  const anio = Number(partes[1]);
  return (anio < 100 ? anio + 2000 : anio) * 100 + Number(partes[2]);
};

export function compararCiclos(a: CicloEscolar, b: CicloEscolar): number {
  const primero = periodo(a);
  const segundo = periodo(b);
  if (primero != null && segundo != null) return primero - segundo;
  if (a.fecha_inicio && b.fecha_inicio) return a.fecha_inicio.localeCompare(b.fecha_inicio);
  return a.nombre.localeCompare(b.nombre, 'es', { numeric: true });
}

/** La boleta solo puede usar un ciclo previo de la misma periodicidad. */
export function ciclosBoletaElegibles(ciclos: readonly CicloEscolar[], actual: CicloEscolar | null): CicloEscolar[] {
  if (!actual || !normalizar(actual.tipo_periodo)) return [];
  return ciclos.filter(ciclo => ciclo.id !== actual.id
    && normalizar(ciclo.tipo_periodo) === normalizar(actual.tipo_periodo)
    && compararCiclos(ciclo, actual) < 0)
    .sort((a, b) => compararCiclos(b, a));
}

export function sugerirCicloBoletaId(ciclos: readonly CicloEscolar[], actual: CicloEscolar | null): string {
  const anteriores = ciclosBoletaElegibles(ciclos, actual);
  if (!anteriores.length || (anteriores[1] && compararCiclos(anteriores[0], anteriores[1]) === 0)) return '';
  return anteriores[0].id;
}
