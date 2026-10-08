import type { PoliticaHorario } from './politicaHorario';
import type { CargaHorario, ConfiguracionHorario, EntradaHorario, GrupoHorario, SesionHorario } from './types';

export interface ContenidoBorradorHorario {
  esquema: 1;
  firmaDatos: string;
  gruposSeleccionados: string[];
  cargasIncluidas: string[];
  ubicacionesEditadas: Record<string, { aula: string; sede: string }>;
  grupos: Pick<GrupoHorario, 'id' | 'aula' | 'sede'>[];
  cargas: Pick<CargaHorario, 'id' | 'docenteId' | 'horasPresenciales' | 'horasAsincronas' | 'maxBloque'>[];
  configuracion: ConfiguracionHorario;
  sesiones: SesionHorario[];
  modo: 'manual' | 'automatico';
  politica: PoliticaHorario;
  permitirVacantes: boolean;
  permitirNoPreferidas: boolean;
  cargasFijas: string[];
  omitirComplementarias: boolean;
}

/** JSONB puede devolver claves en otro orden; compara el contenido, no la serialización. */
export function firmaContenidoBorrador(contenido: ContenidoBorradorHorario): string {
  const ordenar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(ordenar);
    if (valor && typeof valor === 'object') return Object.fromEntries(
      Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([clave, item]) => [clave, ordenar(item)]));
    return valor;
  };
  return JSON.stringify(ordenar(contenido));
}

/** Registra únicamente los datos de origen que invalidarían un horario ya colocado. */
export function firmaDatosHorario(entrada: EntradaHorario): string {
  return JSON.stringify({
    grupos: entrada.grupos.map(g => [g.id, g.cicloId, g.planId, g.turno, g.aula, g.sede]).sort(),
    cargas: entrada.cargas.map(c => [c.id, c.grupoId, c.asignaturaId, c.horasTotales,
      c.horasPresenciales, c.horasAsincronas, c.docenteId]).sort(),
    docentes: entrada.docentes.map(d => [d.id, d.activo, d.disponibilidad, d.planes,
      d.gruposRestringidos, d.maxHorasSemanales]).sort(),
    externas: entrada.ocupacionesExternas?.map(s => [s.cargaId, s.docenteId, s.dia, s.inicio, s.fin]).sort(),
  });
}

export function crearContenidoBorrador(entradaBase: EntradaHorario, entrada: EntradaHorario,
  opciones: Omit<ContenidoBorradorHorario, 'esquema' | 'firmaDatos' | 'grupos' | 'cargas' | 'configuracion'>,
): ContenidoBorradorHorario {
  return {
    ...opciones, esquema: 1, firmaDatos: firmaDatosHorario(entradaBase),
    grupos: entrada.grupos.map(({ id, aula, sede }) => ({ id, aula, sede })),
    cargas: entrada.cargas.map(({ id, docenteId, horasPresenciales, horasAsincronas, maxBloque }) =>
      ({ id, docenteId, horasPresenciales, horasAsincronas, maxBloque })),
    configuracion: { ...entrada.configuracion },
  };
}

export function recuperarContenidoBorrador(base: EntradaHorario, contenido: ContenidoBorradorHorario) {
  if (contenido?.esquema !== 1 || !Array.isArray(contenido.grupos) || !Array.isArray(contenido.cargas)
    || !Array.isArray(contenido.sesiones) || !Array.isArray(contenido.gruposSeleccionados)
    || !Array.isArray(contenido.cargasIncluidas) || !Array.isArray(contenido.cargasFijas)
    || !contenido.configuracion || !contenido.ubicacionesEditadas) throw new Error('El formato del borrador no es compatible.');
  const gruposBase = new Set(base.grupos.map(g => g.id));
  const cargasBase = new Set(base.cargas.map(c => c.id));
  if (contenido.gruposSeleccionados.some(id => !gruposBase.has(id))
    || contenido.cargasIncluidas.some(id => !cargasBase.has(id))
    || contenido.cargasFijas.some(id => !cargasBase.has(id)))
    throw new Error('El borrador contiene grupos o materias que ya no existen en este ciclo.');
  const grupos = new Map(contenido.grupos.map(g => [g.id, g]));
  const cargas = new Map(contenido.cargas.map(c => [c.id, c]));
  const entrada: EntradaHorario = { ...base,
    grupos: base.grupos.map(g => ({ ...g, ...grupos.get(g.id) })),
    cargas: base.cargas.map(c => ({ ...c, ...cargas.get(c.id) })),
    configuracion: { ...base.configuracion, ...contenido.configuracion },
  };
  const cambiado = firmaDatosHorario(base) !== contenido.firmaDatos;
  const sesionesValidas = contenido.sesiones.every(s => cargasBase.has(s.cargaId)
    && gruposBase.has(s.grupoId) && entrada.cargas.some(c => c.id === s.cargaId
      && c.grupoId === s.grupoId && c.asignaturaId === s.asignaturaId && c.docenteId === s.docenteId));
  return { entrada, cambiado, sesiones: !cambiado && sesionesValidas ? contenido.sesiones : [] };
}
