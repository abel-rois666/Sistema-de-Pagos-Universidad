import type { ConfiguracionHorario, IncidenciaHorario } from './types';

export type AccionDesbloqueo = 'ampliar_busqueda' | 'permitir_vacantes' | 'permitir_no_preferidas'
  | 'liberar_docente' | 'revisar_cargas' | 'revisar_limites';

export interface PasoDesbloqueo {
  id: string;
  titulo: string;
  detalle: string;
  accion: AccionDesbloqueo;
  cargaId?: string;
}

export interface OpcionesOrientacionHorario {
  modo: 'manual' | 'automatico';
  permitirVacantes: boolean;
  permitirNoPreferidas: boolean;
  cargasFijas: ReadonlySet<string>;
  busquedaAmpliadaUsada: boolean;
  configuracion: ConfiguracionHorario;
}

const tiene = (incidencias: IncidenciaHorario[], ...codigos: string[]) =>
  incidencias.some(incidencia => codigos.includes(incidencia.codigo));

const detalleLimites = (incidencias: IncidenciaHorario[], configuracion: ConfiguracionHorario) => {
  if (tiene(incidencias, 'JORNADA_INVALIDA'))
    return 'El mínimo diario debe ser un entero de 1 a 8 horas. Corrige el valor de grupo o docente y vuelve a generar.';
  if (tiene(incidencias, 'HUECO_INVALIDO'))
    return 'El máximo de horas libres debe ser un entero de 0 a 8 por día. Corrige el valor y vuelve a generar.';
  if (tiene(incidencias, 'JORNADA_CORTA_GRUPO'))
    return `Mínimo actual del grupo: ${configuracion.minHorasGrupo ?? 2} h. Si aceptas jornadas de una hora, cambia «Mín. diario grupo» a 1; si no, reúne más clases ese día. Luego vuelve a generar.`;
  if (tiene(incidencias, 'JORNADA_CORTA_DOCENTE'))
    return `Mínimo actual del docente: ${configuracion.minHorasDocente ?? 2} h. Si aceptas jornadas de una hora, cambia «Mín. diario docente» a 1; si no, reúne más clases o cambia la asignación. Luego vuelve a generar.`;
  if (tiene(incidencias, 'HUECO_GRUPO'))
    return `Máximo actual del grupo: ${configuracion.maxHuecoGrupo} h libres por día. Ajusta este límite si aceptas más huecos o reorganiza las clases; después vuelve a generar.`;
  return `Máximo actual del docente: ${configuracion.maxHuecoDocente} h libres por día. Ajusta este límite si aceptas más huecos o reorganiza sus clases; después vuelve a generar.`;
};

/** Sugiere ajustes explícitos; nunca cambia restricciones ni atribuye imposibilidad a un límite de búsqueda. */
export function pasosParaDesbloquear(incidencias: IncidenciaHorario[],
  opciones: OpcionesOrientacionHorario): PasoDesbloqueo[] {
  if (!incidencias.length) return [];
  const pasos: PasoDesbloqueo[] = [];
  if (tiene(incidencias, 'BUSQUEDA_AGOTADA') && !opciones.busquedaAmpliadaUsada) pasos.push({
    id: 'ampliar', titulo: 'Explorar más combinaciones', accion: 'ampliar_busqueda',
    detalle: 'La búsqueda terminó por un límite. Reintenta con más tiempo y ramas; esto no modifica asignaciones ni garantiza una solución.',
  });
  const fijasBloqueadas = [...new Set(incidencias.filter(incidencia => incidencia.cargaId
    && opciones.cargasFijas.has(incidencia.cargaId)
    && ['DOCENTE_FIJO_SIN_SOLUCION', 'DOCENTE_NO_ELEGIBLE', 'SIN_ESPACIO'].includes(incidencia.codigo))
    .map(incidencia => incidencia.cargaId!))].slice(0, 3);
  for (const cargaId of fijasBloqueadas) pasos.push({
    id: `liberar-${cargaId}`, titulo: 'Liberar docente fijado', accion: 'liberar_docente', cargaId,
    detalle: 'La asignación fija reduce las combinaciones. Liberarla permite probar otro docente elegible al regenerar; no cambia la base.',
  });
  if (opciones.modo === 'automatico' && !opciones.permitirVacantes
    && tiene(incidencias, 'SIN_DOCENTE_AUTO', 'DOCENTE_FIJO_SIN_SOLUCION', 'SIN_SOLUCION',
      'JORNADA_CORTA_DOCENTE', 'JORNADA_CORTA_GRUPO', 'BUSQUEDA_AGOTADA')) pasos.push({
    id: 'vacantes', titulo: 'Probar con vacantes', accion: 'permitir_vacantes',
    detalle: 'Añade candidatos sin docente para el borrador. Puede ayudar a cumplir la jornada estricta; un horario con vacantes no se puede publicar.',
  });
  if (opciones.modo === 'automatico' && !opciones.permitirNoPreferidas
    && tiene(incidencias, 'SIN_DOCENTE_AUTO', 'SIN_SOLUCION')) pasos.push({
    id: 'no-preferidas', titulo: 'Ampliar docentes candidatos', accion: 'permitir_no_preferidas',
    detalle: 'Considera docentes habilitados para el plan aunque no hayan marcado la materia como preferida. Conserva disponibilidad, cupo y restricciones.',
  });
  if (tiene(incidencias, 'HUECO_GRUPO', 'HUECO_DOCENTE', 'JORNADA_CORTA_GRUPO',
    'JORNADA_CORTA_DOCENTE', 'JORNADA_INVALIDA', 'HUECO_INVALIDO')) pasos.push({
    id: 'limites', titulo: 'Revisar límites diarios', accion: 'revisar_limites',
    detalle: detalleLimites(incidencias, opciones.configuracion),
  });
  if (tiene(incidencias, 'SIN_DOCENTE', 'SIN_DOCENTE_AUTO', 'SIN_ESPACIO', 'SIN_SOLUCION',
    'SIN_ASIGNATURAS', 'CAPACIDAD_TURNO', 'HORAS_SIN_DEFINIR', 'REPARTO_INVALIDO', 'DOCENTE_NO_ELEGIBLE',
    'CUPO_DOCENTE_EXCEDIDO', 'JORNADA_CORTA_GRUPO', 'JORNADA_CORTA_DOCENTE')) pasos.push({
    id: 'cargas', titulo: 'Revisar materias y asignaciones', accion: 'revisar_cargas',
    detalle: 'Comprueba horas presenciales, docentes fijados, disponibilidad y reparto Mixto de las materias señaladas. Omitir una materia solo genera un borrador parcial.',
  });
  if (tiene(incidencias, 'BUSQUEDA_AGOTADA') && !pasos.length) pasos.push({
    id: 'cargas', titulo: 'Revisar materias y asignaciones', accion: 'revisar_cargas',
    detalle: 'La búsqueda ampliada también alcanzó su límite. Revisa la carga y los docentes antes de intentar otra configuración; esto no demuestra que sea imposible.',
  });
  return pasos;
}
