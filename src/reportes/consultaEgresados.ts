export interface InscripcionResumenEgresado { alumno_id: string; ciclo_id: string | null; ciclo_legado: string | null }
export interface CertificacionResumenEgresado { alumno_id: string; tramite_completado: boolean | null }
interface PaginaEgresados { ids: string[]; desde: number; cantidad: number; signal: AbortSignal }
export interface FuenteReporteEgresados {
  inscripciones: (pagina: PaginaEgresados) => Promise<InscripcionResumenEgresado[]>;
  certificaciones: (pagina: PaginaEgresados) => Promise<CertificacionResumenEgresado[]>;
}
export interface DatosReporteEgresados {
  ciclosEgresoMap: Record<string, string>;
  tieneKardexMap: Record<string, boolean>;
  certificacionMap: Record<string, string>;
}

export const pesoCicloEgresado = (nombre?: string): number => {
  const partes = nombre?.match(/(\d+)[-/](\d+)/);
  if (!partes) return -1;
  const anio = Number(partes[1]);
  return (anio < 100 ? anio + 2000 : anio) * 10 + Number(partes[2]);
};
const cancelacion = () => new DOMException('Consulta cancelada', 'AbortError');
const comprobar = (signal: AbortSignal) => { if (signal.aborted) throw cancelacion(); };
const esTiempoEspera = (error: unknown) => ['57014', 'CLIENT_TIMEOUT'].includes(String((error as { code?: string })?.code));

/** Acota también una petición de red que no responde; nunca cambia el timeout de PostgreSQL. */
async function consultarConPlazo<T>(leer: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, limiteMs: number): Promise<T> {
  comprobar(signal);
  const control = new AbortController();
  let temporizador: ReturnType<typeof setTimeout>;
  let cancelar: () => void;
  const limite = new Promise<never>((_, rechazar) => {
    cancelar = () => { control.abort(); rechazar(cancelacion()); };
    signal.addEventListener('abort', cancelar, { once: true });
    temporizador = setTimeout(() => {
      control.abort(); rechazar(Object.assign(new Error('La consulta excedió el tiempo de espera.'), { code: 'CLIENT_TIMEOUT' }));
    }, limiteMs);
  });
  try { return await Promise.race([leer(control.signal), limite]); }
  finally { clearTimeout(temporizador!); signal.removeEventListener('abort', cancelar!); }
}

/** Dos solicitudes como máximo; descarga paginada y reducción de lotes solo ante timeout. */
export async function consultarDatosEgresados(
  fuente: FuenteReporteEgresados, alumnos: string[], ciclos: { id: string; nombre: string }[],
  opciones: { signal: AbortSignal; progreso?: (porcentaje: number) => void; limiteMs?: number }
): Promise<DatosReporteEgresados> {
  // StrictMode puede limpiar el primer efecto antes de iniciar su red.
  await Promise.resolve();
  comprobar(opciones.signal);
  const ids = [...new Set(alumnos)];
  const resultado: DatosReporteEgresados = { ciclosEgresoMap: {}, tieneKardexMap: {}, certificacionMap: {} };
  if (!ids.length) { opciones.progreso?.(100); return resultado; }
  const control = new AbortController(), signal = control.signal;
  const cancelar = () => control.abort();
  opciones.signal.addEventListener('abort', cancelar, { once: true });
  const nombres = new Map(ciclos.map(c => [c.id, c.nombre]));
  const pesos = new Map<string, number>();
  let terminados = 0;
  const avanzar = (cantidad: number) => { comprobar(signal); terminados += cantidad; opciones.progreso?.(Math.min(99, Math.floor(terminados * 100 / (ids.length * 2)))); };
  const pagina = 500;
  const leerLote = async (tipo: 'inscripciones' | 'certificaciones', lote: string[]): Promise<void> => {
    try {
      for (let desde = 0; ;) {
        comprobar(signal);
        const datos = await consultarConPlazo<(InscripcionResumenEgresado | CertificacionResumenEgresado)[]>(s => fuente[tipo]({ ids: lote, desde, cantidad: pagina, signal: s }), signal, opciones.limiteMs ?? 20_000);
        comprobar(signal);
        for (const dato of datos) {
          if (tipo === 'certificaciones') {
            resultado.certificacionMap[dato.alumno_id] = (dato as CertificacionResumenEgresado).tramite_completado ? 'Completado' : 'En curso';
          } else {
            const inscripcion = dato as InscripcionResumenEgresado;
            resultado.tieneKardexMap[dato.alumno_id] = true;
            // Se conserva el criterio legado: último ciclo registrado, con prioridad del texto importado.
            const nombre = inscripcion.ciclo_legado || (inscripcion.ciclo_id ? nombres.get(inscripcion.ciclo_id) : undefined);
            if (nombre && (!pesos.has(dato.alumno_id) || pesoCicloEgresado(nombre) > pesos.get(dato.alumno_id)!)) {
              pesos.set(dato.alumno_id, pesoCicloEgresado(nombre)); resultado.ciclosEgresoMap[dato.alumno_id] = nombre;
            }
          }
        }
        // El servidor puede limitar la respuesta por debajo de 500: avanzar por lo recibido.
        if (!datos.length) break;
        desde += datos.length;
      }
      avanzar(lote.length);
    } catch (error) {
      comprobar(signal);
      // Un corte de red no se reintenta en cascada; solo el timeout SQL puede depender del lote.
      if (String((error as { code?: string })?.code) !== '57014' || lote.length === 1) throw error;
      // No se abren más workers: las mitades se atienden secuencialmente dentro del mismo cupo.
      const mitad = Math.ceil(lote.length / 2);
      await leerLote(tipo, lote.slice(0, mitad)); await leerLote(tipo, lote.slice(mitad));
    }
  };
  const tareas: (() => Promise<void>)[] = [];
  for (let i = 0; i < ids.length; i += 200) tareas.push(() => leerLote('certificaciones', ids.slice(i, i + 200)));
  for (let i = 0; i < ids.length; i += 20) tareas.push(() => leerLote('inscripciones', ids.slice(i, i + 20)));
  let siguiente = 0, fallo: unknown, huboFallo = false;
  const trabajar = async () => {
    try {
      while (!signal.aborted && siguiente < tareas.length) await tareas[siguiente++]();
    } catch (error) {
      if (!huboFallo) { huboFallo = true; fallo = error; }
      control.abort();
    }
  };
  try {
    // Los manejadores de rechazo existen desde el inicio de cada worker.
    await Promise.all([trabajar(), trabajar()]);
    comprobar(opciones.signal);
    if (huboFallo) throw fallo;
    for (const id of ids) {
      resultado.tieneKardexMap[id] ??= false;
      resultado.certificacionMap[id] ??= 'Sin iniciar';
    }
    opciones.progreso?.(100);
    return resultado;
  } finally { opciones.signal.removeEventListener('abort', cancelar); control.abort(); }
}

export function mensajeErrorReporteEgresados(error: unknown): string {
  if (String((error as { code?: string })?.code) === 'CLIENT_TIMEOUT') return 'El servidor no respondió dentro del tiempo de espera. Reintenta la consulta; no se muestran ni exportan resultados parciales.';
  if (esTiempoEspera(error)) return 'La consulta del historial o de certificación excedió el tiempo de espera, incluso al reducir los lotes. Reintenta; si persiste, será necesario revisar el rendimiento de la base de datos. No se muestran ni exportan resultados parciales.';
  return 'No se pudo completar la consulta académica y de certificación. Reintenta para obtener el reporte completo. No se muestran ni exportan resultados parciales.';
}
