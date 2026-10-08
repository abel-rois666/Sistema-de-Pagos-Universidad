import { buscarHoras } from './busquedaHoras';
import { validarEntradas, validarSesiones } from './motor';
import { revisarAjusteManual } from './ajusteManual';
import { incumplimientosEstrictos, type PoliticaHorario } from './politicaHorario';
import { esVacante, idVacante, idVacanteLicenciatura } from './vacantes';
import { incidenciaSuave, type CargaHorario, type EntradaHorario, type IncidenciaHorario, type SesionHorario } from './types';

export interface CambioLocalHorario {
  entrada: EntradaHorario;
  sesiones: SesionHorario[];
  incidencias: IncidenciaHorario[];
  cargasMovidas: number;
  horasMovidas: number;
  motivo: string;
}

const firmaHoras = (sesiones: SesionHorario[]) => new Set(sesiones.flatMap(s =>
  Array.from({ length: s.fin - s.inicio }, (_, paso) => `${s.cargaId}:${s.dia}:${s.inicio + paso}`)));

const impacto = (anteriores: SesionHorario[], siguientes: SesionHorario[]) => {
  const antes = firmaHoras(anteriores); const despues = firmaHoras(siguientes);
  return [...antes].filter(h => !despues.has(h)).length;
};

function revisar(entrada: EntradaHorario, sesiones: SesionHorario[], politica: PoliticaHorario): IncidenciaHorario[] {
  const bloqueos = validarSesiones(sesiones, entrada).filter(i => !incidenciaSuave(i));
  if (bloqueos.length) return bloqueos;
  const incidencias = revisarAjusteManual(entrada, sesiones);
  return politica === 'estricto' ? incumplimientosEstrictos(incidencias) : [];
}

function validarVacante(entrada: EntradaHorario, carga: CargaHorario, docenteId: string): string | null {
  if (!esVacante(docenteId)) return null;
  const grupo = entrada.grupos.find(g => g.id === carga.grupoId);
  if (!grupo) return 'No se encontró el grupo de la materia.';
  if (docenteId === idVacante(carga.id)) return null; // Identidad de borradores anteriores.
  const numero = Number(docenteId.match(/:(\d+)$/)?.[1]);
  return Number.isSafeInteger(numero) && numero > 0 && docenteId === idVacanteLicenciatura(grupo, numero)
    ? null : 'Esa vacante pertenece a otra licenciatura.';
}

/** Cambia una materia completa sin mover ninguna de sus sesiones. */
export function probarCambioDocente(entrada: EntradaHorario, sesiones: SesionHorario[],
  cargaId: string, docenteId: string, politica: PoliticaHorario): CambioLocalHorario | string {
  const carga = entrada.cargas.find(c => c.id === cargaId);
  if (!carga) return 'No se encontró la materia del borrador.';
  if (carga.docenteId === docenteId) return 'La materia ya tiene esa asignación.';
  const errorVacante = validarVacante(entrada, carga, docenteId);
  if (errorVacante) return errorVacante;
  if (!esVacante(docenteId) && !entrada.docentes.some(d => d.id === docenteId && d.activo))
    return 'El docente no está activo o ya no existe.';
  const siguiente = { ...entrada, cargas: entrada.cargas.map(c => c.id === cargaId ? { ...c, docenteId } : c) };
  const cambiadas = sesiones.map(s => s.cargaId === cargaId ? { ...s, docenteId } : s);
  const bloqueos = revisar(siguiente, cambiadas, politica);
  if (bloqueos.length) return bloqueos[0].mensaje;
  return { entrada: siguiente, sesiones: cambiadas,
    incidencias: revisarAjusteManual(siguiente, cambiadas),
    cargasMovidas: 1, horasMovidas: 0, motivo: 'Se conservan todas las horas existentes.' };
}

function compactar(horas: SesionHorario[], cargas: CargaHorario[]): SesionHorario[] {
  const maximos = new Map(cargas.map(c => [c.id, c.maxBloque || 4]));
  const resultado: SesionHorario[] = [];
  for (const hora of [...horas].sort((a, b) => a.cargaId.localeCompare(b.cargaId)
    || a.dia - b.dia || a.inicio - b.inicio)) {
    const anterior = resultado.at(-1);
    if (anterior && anterior.cargaId === hora.cargaId && anterior.dia === hora.dia
      && anterior.fin === hora.inicio && anterior.fin - anterior.inicio < (maximos.get(hora.cargaId) || 4))
      anterior.fin = hora.fin;
    else resultado.push({ ...hora });
  }
  return resultado;
}

/** Busca solo las materias afectadas y mantiene intactas las demás sesiones. */
export function repararAsignacionLocal(entrada: EntradaHorario, sesiones: SesionHorario[],
  cargaId: string, docenteId: string, politica: PoliticaHorario, alcance: 'materia' | 'grupo' = 'materia',
): CambioLocalHorario | string {
  const objetivo = entrada.cargas.find(c => c.id === cargaId);
  if (!objetivo) return 'No se encontró la materia.';
  const errorVacante = validarVacante(entrada, objetivo, docenteId);
  if (errorVacante) return errorVacante;
  const ids = new Set(alcance === 'materia' ? [cargaId]
    : entrada.cargas.filter(c => c.grupoId === objetivo.grupoId).map(c => c.id));
  const siguiente: EntradaHorario = { ...entrada,
    cargas: entrada.cargas.map(c => c.id === cargaId ? { ...c, docenteId } : c),
  };
  const estructurales = validarEntradas(siguiente).filter(i => !incidenciaSuave(i));
  if (estructurales.length) return estructurales[0].mensaje;
  const fijas = sesiones.filter(s => !ids.has(s.cargaId));
  const grupo = entrada.grupos.find(g => g.id === objetivo.grupoId);
  if (!grupo) return 'No se encontró el grupo.';
  const parcial: EntradaHorario = { ...siguiente, grupos: [grupo],
    cargas: siguiente.cargas.filter(c => ids.has(c.id)),
    ocupacionesExternas: [...(entrada.ocupacionesExternas || []), ...fijas],
  };
  let mejor: CambioLocalHorario | null = null;
  const busqueda = buscarHoras(parcial, alcance === 'materia' ? 8000 : 24000, {
    alEncontrar: horas => {
      const candidatas = [...fijas, ...compactar(horas, parcial.cargas)];
      if (revisar(siguiente, candidatas, politica).length) return false;
      const horasMovidas = impacto(sesiones, candidatas);
      const incidencias = revisarAjusteManual(siguiente, candidatas);
      const propuesta = { entrada: siguiente, sesiones: candidatas, incidencias,
        cargasMovidas: ids.size, horasMovidas,
        motivo: `Se reacomodaron ${horasMovidas} hora(s) de ${ids.size} materia(s); las demás permanecen fijas.` };
      if (!mejor || horasMovidas < mejor.horasMovidas
        || (horasMovidas === mejor.horasMovidas && incidencias.length < mejor.incidencias.length)) mejor = propuesta;
      return horasMovidas === 0;
    },
  });
  return mejor || (busqueda.agotada
    ? 'Se agotó la búsqueda local; no se ha demostrado que sea imposible.'
    : `No se encontró distribución al reacomodar ${alcance === 'materia' ? 'solo esta materia' : 'este grupo'}.`);
}
