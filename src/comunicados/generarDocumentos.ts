import { listarCalendarios, listarEventos } from '../calendario/service';
import { cargarDatosHorario } from '../horarios/service';
import { getAppConfig, supabase } from '../lib/supabase';
import type { CicloEscolar, Empleado, PaymentPlan } from '../types';
import type { FilaComunicado } from './consulta';
import { ciclosBoletaElegibles } from './ciclos';
import { seleccionarCalendario } from './preparacion';
import { esPlanPagoTitulacion } from '../utils/cicloPlanPago';
import { inspectPlan } from '../utils/planCoverageUtils';
import { prepararBoletaPdf, prepararCalendarioPdf, prepararCalendarioPagosPdf,
  prepararHorarioGruposPdf, type DocumentoPreparado } from './documentos';

const exigir = <T>(data: T | null, error: { message: string } | null, contexto: string): T => {
  if (error) throw new Error(`${contexto}: ${error.message}`);
  if (data == null) throw new Error(`${contexto}: no se encontró el registro.`);
  return data;
};
const cicloPeso = (nombre: string) => {
  const valores = nombre.match(/(\d+)[-/](\d+)/);
  if (!valores) return Number.MAX_SAFE_INTEGER;
  const anio = Number(valores[1]) < 100 ? Number(valores[1]) + 2000 : Number(valores[1]);
  return anio * 10 + Number(valores[2]);
};

/** Relee los datos al emitir: una revisión anterior nunca sustituye esta comprobación. */
export async function generarDocumentosAlumno(
  fila: FilaComunicado, ciclo: CicloEscolar, cicloBoleta: CicloEscolar | null,
  ciclos: CicloEscolar[], firmanteId: string,
): Promise<DocumentoPreparado[]> {
  const sinBoleta = fila.boleta.estado === 'NO_APLICA';
  if (fila.cicloEntregaId !== ciclo.id || (!sinBoleta && (!cicloBoleta
    || fila.cicloBoletaId !== cicloBoleta.id
    || !ciclosBoletaElegibles(ciclos, ciclo).some(item => item.id === cicloBoleta.id))))
    throw new Error('Vuelve a revisar los ciclos de entrega y boleta antes de preparar los documentos.');
  if (!fila.planId || (fila.boleta.estado === 'LISTO' && fila.boleta.valor.calificacionesPendientes)
    || (fila.boleta.estado !== 'LISTO' && !sinBoleta)
    || fila.calendario.estado !== 'LISTO' || fila.horario.estado !== 'LISTO')
    throw new Error('Completa la revisión académica del alumno antes de preparar sus documentos.');
  if (!sinBoleta && !firmanteId) throw new Error('Elige al firmante de las boletas.');
  const calendarioId = fila.calendario.valor.id;
  const gruposHorario = fila.horario.valor;
  const [alumnoRes, planRes, insRes, gruposBoletaRes, firmanteRes, config, calendarios, horario] = await Promise.all([
    supabase.from('alumnos').select('*').eq('id', fila.alumno.id).single(),
    supabase.from('planes_estudio').select('id,nombre,clave_legado,modelo,modalidad,tipo_periodo,rvoe,carreras(nombre)')
      .eq('id', fila.planId).single(),
    !sinBoleta && cicloBoleta ? supabase.from('inscripciones_academicas')
      .select('id,alumno_id,ciclo_id,ciclo_legado,asignatura_id,calificacion_final,estatus,asignaturas(nombre,clave_legado,creditos,numero_periodo,clasificacion_clave,clasificacion_nombre,plan_id,planes_estudio(modelo))')
      .eq('alumno_id', fila.alumno.id).eq('ciclo_id', cicloBoleta.id) : Promise.resolve({ data: [], error: null }),
    !sinBoleta && cicloBoleta ? supabase.from('alumnos_grupos')
      .select('grupo_id,grupos!inner(id,codigo_grupo,grado,ciclo_id,plan_id)')
      .eq('alumno_id', fila.alumno.id).eq('grupos.ciclo_id', cicloBoleta.id)
      .eq('grupos.plan_id', fila.planId) : Promise.resolve({ data: [], error: null }),
    !sinBoleta ? supabase.from('empleados').select('*').eq('id', firmanteId).eq('estatus', 'activo')
      .eq('firmante_boletas', true).single() : Promise.resolve({ data: null, error: null }),
    !sinBoleta ? getAppConfig() : Promise.resolve(null), listarCalendarios(ciclo.id), cargarDatosHorario(ciclo.id),
  ]);
  const alumno = exigir(alumnoRes.data, alumnoRes.error, 'Alumno');
  const plan = exigir(planRes.data, planRes.error, 'Plan de estudios');
  const firmante = !sinBoleta ? exigir(firmanteRes.data, firmanteRes.error, 'Firmante') as Empleado : null;
  const inscripciones = exigir(insRes.data, insRes.error, 'Calificaciones');
  if (gruposBoletaRes.error) throw new Error(`Grupos del ciclo de la boleta: ${gruposBoletaRes.error.message}`);
  const materiaDe = (inscripcion: (typeof inscripciones)[number]) => {
    const valor = inscripcion.asignaturas;
    return Array.isArray(valor) ? valor[0] : valor;
  };
  const delPlan = inscripciones.filter(inscripcion => materiaDe(inscripcion)?.plan_id === fila.planId);
  if (!sinBoleta && (!delPlan.length || delPlan.some(inscripcion => inscripcion.calificacion_final == null)))
    throw new Error('La boleta tiene calificaciones pendientes o no corresponde al plan elegido.');
  const gruposBoleta = [...new Map((gruposBoletaRes.data || []).map(relacion => {
    const grupo = Array.isArray(relacion.grupos) ? relacion.grupos[0] : relacion.grupos;
    return [grupo.id, grupo] as const;
  })).values()];
  if (!sinBoleta && (!config?.selloUrl || !firmante?.firma_url))
    throw new Error('Configura sello institucional y firma del firmante antes de emitir la boleta.');
  const turnos = [...new Set(fila.grupos.map(grupo =>
    horario.entrada.grupos.find(item => item.id === grupo.id)?.turno || ''))];
  const actuales = turnos.map(turno => seleccionarCalendario(calendarios, ciclo.id, {
    planId: fila.planId, tipoPeriodo: plan.tipo_periodo,
    modalidad: plan.modalidad || 'ESCOLARIZADA', turno,
  }));
  const calendario = actuales[0]?.estado === 'LISTO' ? actuales[0].valor : null;
  if (!calendario || calendario.id !== calendarioId || actuales.some(item =>
    item.estado !== 'LISTO' || item.valor.id !== calendarioId))
    throw new Error('El calendario ya no corresponde al plan del alumno. Revisa sus datos.');
  const eventos = await listarEventos(calendario.id);
  const publicado = horario.publicado;
  if (!publicado || gruposHorario.some(grupo =>
    !publicado.entrada.grupos.some(item => item.id === grupo.id)
    || !publicado.sesiones.some(sesion => sesion.grupoId === grupo.id)))
    throw new Error('El horario publicado cambió. Vuelve a revisar los grupos del alumno.');
  let grado: number | null = null;
  if (!sinBoleta && String(plan.modelo).toUpperCase() === 'FLEXIBLE') {
    const historico = await supabase.from('inscripciones_academicas')
      .select('ciclo_id,ciclo_legado,asignaturas(plan_id)').eq('alumno_id', fila.alumno.id);
    if (historico.error) throw new Error(historico.error.message);
    const cicloPorId = new Map(ciclos.map(item => [item.id, item.nombre]));
    const nombres = [...new Set((historico.data || []).filter(item => {
      const materia = Array.isArray(item.asignaturas) ? item.asignaturas[0] : item.asignaturas;
      return materia?.plan_id === fila.planId;
    }).map(item =>
      item.ciclo_legado || cicloPorId.get(item.ciclo_id) || '').filter(nombre =>
      nombre && nombre !== '-' && !nombre.toUpperCase().includes('EXT')))]
      .sort((a, b) => cicloPeso(a) - cicloPeso(b));
    const indice = nombres.findIndex(nombre => nombre.trim().toUpperCase() === cicloBoleta?.nombre.trim().toUpperCase());
    if (indice < 0) throw new Error('No se pudo determinar el avance personal del alumno en este plan flexible.');
    grado = indice + 1;
  } else if (!sinBoleta) {
    const grados = [...new Set(gruposBoleta.map(grupo => grupo.grado).filter(valor => valor != null))];
    if (grados.length > 1) throw new Error('Los grupos del ciclo de la boleta tienen grados distintos. Revisa al alumno.');
    grado = grados[0] ?? null;
  }
  const carrera = Array.isArray(plan.carreras) ? plan.carreras[0] : plan.carreras;
  const documentos: DocumentoPreparado[] = [];
  if (!sinBoleta && cicloBoleta && firmante && config) documentos.push(await prepararBoletaPdf({
    alumnos: [{ ...alumno, selectedPlanId: fila.planId,
      licenciatura: carrera?.nombre || plan.nombre, rvoe: plan.rvoe || '',
      tipo_periodo: plan.tipo_periodo,
      grupo: gruposBoleta.map(grupo => grupo.codigo_grupo).join(', ') || 'S/A',
      grado_grupo: grado }],
    inscripciones: delPlan, ciclo: cicloBoleta, config, firmante,
  }));
  documentos.push(await prepararCalendarioPdf({
    calendario, cicloNombre: ciclo.nombre, eventos,
    planes: [{ id: plan.id, nombre: plan.nombre, clave_legado: plan.clave_legado || '',
      carreras: carrera ? { nombre: carrera.nombre } : null }],
  }));
  documentos.push(await prepararHorarioGruposPdf(publicado.entrada, publicado.sesiones,
    ciclo.nombre, gruposHorario.map(grupo => grupo.id)));
  if (fila.pagos.estado === 'LISTO') {
    const pago = await supabase.from('planes_pago')
      .select('*,detalles:planes_pago_detalles(*)').eq('id', fila.pagos.valor.id).single();
    const planPagos = exigir(pago.data, pago.error, 'Plan de pagos');
    if (planPagos.alumno_id !== alumno.id || planPagos.ciclo_id !== ciclo.id
      || esPlanPagoTitulacion(planPagos.tipo_plan) || !inspectPlan(planPagos as PaymentPlan).completo)
      throw new Error('El plan de pagos ya no corresponde al alumno o al ciclo académico. Actualiza la revisión antes de emitir.');
    documentos.push(await prepararCalendarioPagosPdf(
      { ...planPagos, nombre_alumno: alumno.nombre_completo, ciclo_escolar: ciclo.nombre,
        grado_turno: planPagos.grado_turno_inscrito } as PaymentPlan,
      ciclo.nombre));
  }
  return documentos;
}
