import { buscarHoras } from './busquedaHoras';
import { conservarPropuesta, crearPropuestaHorario, propuestasParaMostrar, type PropuestaHorario } from './evaluacionHorario';
import { evaluarHoras, validarEntradas, validarSesiones } from './motor';
import { cumplePoliticaHorario, incumplimientosEstrictos, type PoliticaHorario } from './politicaHorario';
import { incidenciaSuave, type EntradaHorario, type IncidenciaHorario } from './types';

export interface ResultadoOptimizacionHorario {
  propuestas: PropuestaHorario[];
  incidencias: IncidenciaHorario[];
  busquedaExhaustiva: boolean;
  solucionesEvaluadas: number;
  evaluaciones: number;
}

export function optimizarHorarioManual(entrada: EntradaHorario, opciones: {
  limiteTiempoMs?: number;
  busquedaAmpliada?: boolean;
  politica?: PoliticaHorario;
  informarAvance?: (evaluaciones: number, soluciones: number) => void;
} = {}): ResultadoOptimizacionHorario {
  const errores = validarEntradas(entrada);
  if (errores.length) return { propuestas: [], incidencias: errores,
    busquedaExhaustiva: true, solucionesEvaluadas: 0, evaluaciones: 0 };
  const politica = opciones.politica ?? 'flexible';
  const vence = Date.now() + (opciones.limiteTiempoMs
    ?? (opciones.busquedaAmpliada ? 30000 : politica === 'estricto' ? 12000 : 6000));
  let candidatas: PropuestaHorario[] = [];
  let solucionesEvaluadas = 0;
  let mejorIncumplimiento: IncidenciaHorario[] = [];
  const busqueda = buscarHoras(entrada,
    opciones.busquedaAmpliada ? 250000 : politica === 'estricto' ? 100000 : 50000, {
    debeDetener: () => Date.now() >= vence,
    alEncontrar: (horas, evaluaciones) => {
      solucionesEvaluadas++;
      const horario = evaluarHoras(entrada, horas);
      if (cumplePoliticaHorario(horario.incidencias, politica))
        candidatas = conservarPropuesta(candidatas, crearPropuestaHorario(entrada, entrada, horario));
      else {
        const incumplimientos = incumplimientosEstrictos(horario.incidencias);
        if (!mejorIncumplimiento.length || incumplimientos.length < mejorIncumplimiento.length)
          mejorIncumplimiento = incumplimientos;
      }
      if (solucionesEvaluadas === 1 || solucionesEvaluadas % 50 === 0)
        opciones.informarAvance?.(evaluaciones, solucionesEvaluadas);
      return false;
    },
  });
  const propuestas = propuestasParaMostrar(candidatas.filter(propuesta =>
    !validarSesiones(propuesta.sesiones, propuesta.entrada).some(incidencia => !incidenciaSuave(incidencia))));
  const cargaBloqueada = entrada.cargas.find(carga => carga.id === busqueda.cargaBloqueadaId);
  return {
    propuestas, evaluaciones: busqueda.evaluaciones, solucionesEvaluadas,
    busquedaExhaustiva: busqueda.exhaustiva,
    incidencias: propuestas.length ? propuestas[0].incidencias : [...mejorIncumplimiento.slice(0, 4), {
      codigo: busqueda.agotada ? 'BUSQUEDA_AGOTADA' : 'SIN_ESPACIO',
      mensaje: busqueda.agotada
        ? `Se agotó la búsqueda sin una propuesta ${politica}; puede existir una solución.`
        : politica === 'estricto' && solucionesEvaluadas > 0
          ? 'Las distribuciones completas revisadas incumplen los límites diarios estrictos. Ajusta los límites o las asignaciones.'
          : 'Se revisaron las distribuciones permitidas y ninguna cumple las restricciones actuales.',
      cargaId: cargaBloqueada?.id, grupoId: cargaBloqueada?.grupoId,
      docenteId: cargaBloqueada?.docenteId || undefined,
    }],
  };
}
