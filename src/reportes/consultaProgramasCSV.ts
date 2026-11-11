import type { ProgramaCSV } from './detallesListadoCSV';
import type { ResumenCertificacion } from '../certificacion/seguimiento';

interface Pagina { ids: string[]; desde: number; cantidad: number; signal: AbortSignal }
export interface FuenteProgramasCSV {
  programas: (pagina: Pagina) => Promise<ProgramaCSV[]>;
  certificaciones: (pagina: Pagina) => Promise<ResumenCertificacion[]>;
}
/** Dos lecturas simultáneas como máximo, por lotes y páginas. Sin resultados parciales. */
export async function consultarProgramasCSV(ids: readonly string[], fuente: FuenteProgramasCSV, signal: AbortSignal) {
  const unicos = [...new Set(ids)];
  const programas: ProgramaCSV[] = [], certificaciones: ResumenCertificacion[] = [];
  const control = new AbortController(), cancelar = () => control.abort();
  signal.addEventListener('abort', cancelar, { once: true });
  if (signal.aborted) cancelar();
  const comprobar = () => { if (control.signal.aborted) throw new DOMException('Consulta cancelada', 'AbortError'); };
  try {
    comprobar();
    for (let inicio = 0; inicio < unicos.length; inicio += 100) {
      comprobar();
      const lote = unicos.slice(inicio, inicio + 100);
      const leer = async <T>(consulta: (p: Pagina) => Promise<T[]>) => {
        const filas: T[] = [];
        for (let desde = 0; ;) {
          comprobar();
          const pagina = await consulta({ ids: lote, desde, cantidad: 500, signal: control.signal });
          comprobar(); filas.push(...pagina);
          if (!pagina.length) return filas;
          // Un límite instalado menor a 500 no significa que terminó la consulta.
          desde += pagina.length;
        }
      };
      const [p, f] = await Promise.all([leer(fuente.programas), leer(fuente.certificaciones)]);
      programas.push(...p); certificaciones.push(...f);
    }
    comprobar();
    return { programas, certificaciones };
  } finally {
    signal.removeEventListener('abort', cancelar); control.abort();
  }
}
