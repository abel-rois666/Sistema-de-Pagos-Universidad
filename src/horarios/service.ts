import { supabase } from '../lib/supabase';
import { leerPorIds, leerTodasFilas } from './consultas';
import { normalizarTurno, type CargaHorario, type DocenteHorario, type EntradaHorario, type GrupoHorario, type SesionHorario, type VentanaHorario } from './types';

interface CicloFechas { id: string; fecha_inicio: string | null; fecha_termino: string | null }
interface GrupoRow { id: string; ciclo_id: string; plan_id: string; codigo_grupo: string; turno: string; estatus: string | null; aula: string | null; sede: string | null }
interface DocenteRow { id: string; nombre_completo: string; estatus: string | null }
interface ConfigRow { docente_id: string; disponibilidad: VentanaHorario[]; plan_ids: string[]; asignatura_ids_preferidas: string[]; grupo_ids_restringidos: string[] }
interface VersionRow { id: string; ciclo_id: string; version: number; estado: string }
interface AsignacionRow { id: string; grupo_id: string; asignatura_id: string; docente_id: string | null; horas_presenciales: number | null; horas_asincronas: number | null; asignaturas: { id: string; nombre: string; horas_semanales: number | null; plan_id: string } | null }
interface SesionRow { horario_id: string; carga_id: string; grupo_id: string | null; docente_id: string | null; dia_semana: number; hora_inicio: number; hora_fin: number; aula: string | null; sede: string | null }
interface CargaPublicadaRow { id: string; asignacion_id: string | null; grupo_id: string | null; asignatura_id: string | null; docente_id: string | null; grupo_codigo: string; grupo_turno: string; asignatura_nombre: string; docente_nombre: string; horas_totales: number; horas_presenciales: number; horas_asincronas: number; max_bloque: 1 | 2 | 3 | 4; aula: string | null; sede: string | null }
export interface DatosHorario {
  entrada: EntradaHorario;
  ciclo: CicloFechas & { nombre: string; tipo_periodo: string | null };
  publicado: { id: string; version: number; entrada: EntradaHorario; sesiones: SesionHorario[] } | null;
}

function assertResult<T>(resultado: { data: T; error: { message: string } | null }, contexto: string): T {
  if (resultado.error) throw new Error(`${contexto}: ${resultado.error.message}`);
  return resultado.data;
}

export async function cargarDatosHorario(cicloId: string): Promise<DatosHorario> {
  const [cicloRes, gruposRaw, docentesRaw, configRaw, versiones, ciclos] = await Promise.all([
    supabase.from('ciclos_escolares').select('id,nombre,tipo_periodo,fecha_inicio,fecha_termino').eq('id', cicloId).single(),
    leerTodasFilas<GrupoRow>('grupos', 'id,ciclo_id,plan_id,codigo_grupo,turno,estatus,aula,sede', 'id', { campo: 'ciclo_id', valor: cicloId }),
    leerTodasFilas<DocenteRow>('docentes', 'id,nombre_completo,estatus'),
    leerTodasFilas<ConfigRow>('docente_configuraciones_horario', 'docente_id,disponibilidad,plan_ids,asignatura_ids_preferidas,grupo_ids_restringidos', 'docente_id', { campo: 'ciclo_id', valor: cicloId }),
    leerTodasFilas<VersionRow>('horarios_versiones', 'id,ciclo_id,version,estado', 'id', { campo: 'estado', valor: 'publicado' }),
    leerTodasFilas<CicloFechas>('ciclos_escolares', 'id,fecha_inicio,fecha_termino'),
  ]);
  const ciclo = assertResult(cicloRes, 'Ciclo escolar') as DatosHorario['ciclo'];
  const grupos: GrupoHorario[] = gruposRaw.filter(g => String(g.estatus || 'activo').toLowerCase() === 'activo').map(g => {
    const turno = normalizarTurno(g.turno);
    if (!turno) throw new Error(`El grupo ${g.codigo_grupo} tiene un turno no reconocido: ${g.turno || 'sin definir'}.`);
    return { id: g.id, codigo: g.codigo_grupo, cicloId: g.ciclo_id, planId: g.plan_id, turno, aula: g.aula, sede: g.sede };
  });
  const configuraciones = new Map(configRaw.map(c => [c.docente_id, c]));
  const docentes: DocenteHorario[] = docentesRaw.map(d => {
    const config = configuraciones.get(d.id);
    return { id: d.id, nombre: d.nombre_completo, activo: String(d.estatus || '').toLowerCase() === 'activo',
      disponibilidad: (config?.disponibilidad || []) as VentanaHorario[], planes: config?.plan_ids || [],
      asignaturasPreferidas: config?.asignatura_ids_preferidas || [], gruposRestringidos: config?.grupo_ids_restringidos || [] };
  });
  const grupoIds = grupos.map(g => g.id);
  const asignaciones = await leerPorIds<AsignacionRow>('docentes_grupos_asignaturas',
    'id,grupo_id,asignatura_id,docente_id,horas_presenciales,horas_asincronas,asignaturas(id,nombre,horas_semanales,plan_id)', 'grupo_id', grupoIds);
  const mapaGrupos = new Map(grupos.map(g => [g.id, g]));
  const cargas: CargaHorario[] = asignaciones.map(a => {
    const materia = a.asignaturas as unknown as { id: string; nombre: string; horas_semanales: number | null; plan_id: string } | null;
    const total = materia?.horas_semanales ?? null;
    const mixto = mapaGrupos.get(a.grupo_id)?.turno === 'MIXTO';
    return { id: a.id, grupoId: a.grupo_id, asignaturaId: a.asignatura_id, asignatura: materia?.nombre || 'Asignatura sin ficha',
      horasTotales: total, horasPresenciales: a.horas_presenciales ?? (mixto ? null : total),
      horasAsincronas: a.horas_asincronas ?? (mixto ? null : 0), docenteId: a.docente_id };
  });
  const fechas = new Map(ciclos.map(c => [c.id, c as CicloFechas]));
  const otras = versiones.filter(v => {
    if (v.ciclo_id === cicloId) return false;
    const f = fechas.get(v.ciclo_id);
    return !f?.fecha_inicio || !f.fecha_termino || !ciclo.fecha_inicio || !ciclo.fecha_termino
      || (f.fecha_inicio <= ciclo.fecha_termino && f.fecha_termino >= ciclo.fecha_inicio);
  });
  const publicada = versiones.find(v => v.ciclo_id === cicloId);
  const idsVersiones = [...otras.map(v => v.id), ...(publicada ? [publicada.id] : [])];
  const sesionesRaw = await leerPorIds<SesionRow>('horarios_sesiones',
    'horario_id,carga_id,grupo_id,docente_id,dia_semana,hora_inicio,hora_fin,aula,sede', 'horario_id', idsVersiones);
  const cargasPublicadas = publicada ? await leerTodasFilas<CargaPublicadaRow>('horarios_cargas',
    'id,asignacion_id,grupo_id,asignatura_id,docente_id,grupo_codigo,grupo_turno,asignatura_nombre,docente_nombre,horas_totales,horas_presenciales,horas_asincronas,max_bloque,aula,sede',
    'id', { campo: 'horario_id', valor: publicada.id }) : [];
  const snapshots = new Map(cargasPublicadas.map(c => [c.id, c]));
  const aSesion = (s: SesionRow): SesionHorario => ({
    cargaId: s.carga_id, grupoId: s.grupo_id || snapshots.get(s.carga_id)?.grupo_codigo || '',
    asignaturaId: snapshots.get(s.carga_id)?.asignatura_id || '',
    docenteId: s.docente_id || snapshots.get(s.carga_id)?.docente_nombre || '',
    dia: s.dia_semana as SesionHorario['dia'], inicio: s.hora_inicio, fin: s.hora_fin, aula: s.aula, sede: s.sede,
  });
  const gruposPublicados: GrupoHorario[] = [...new Map(cargasPublicadas.map(c => [c.grupo_id || c.grupo_codigo, {
    id: c.grupo_id || c.grupo_codigo, codigo: c.grupo_codigo, cicloId, planId: '',
    turno: normalizarTurno(c.grupo_turno) || 'MATUTINO', aula: c.aula, sede: c.sede,
  }])).values()];
  const docentesPublicados: DocenteHorario[] = [...new Map(cargasPublicadas.map(c => [c.docente_id || c.docente_nombre, {
    id: c.docente_id || c.docente_nombre, nombre: c.docente_nombre, activo: true,
    disponibilidad: [], planes: [], asignaturasPreferidas: [], gruposRestringidos: [],
  }])).values()];
  const cargasSnapshot: CargaHorario[] = cargasPublicadas.map(c => ({
    id: c.id, grupoId: c.grupo_id || c.grupo_codigo, asignaturaId: c.asignatura_id || c.id,
    asignatura: c.asignatura_nombre, docenteId: c.docente_id || c.docente_nombre,
    horasTotales: c.horas_totales, horasPresenciales: c.horas_presenciales, horasAsincronas: c.horas_asincronas,
    maxBloque: c.max_bloque,
  }));
  return { ciclo, entrada: {
    grupos, docentes, cargas, ocupacionesExternas: sesionesRaw.filter(s => otras.some(v => v.id === s.horario_id)).map(aSesion),
    configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1 },
  }, publicado: publicada ? { id: publicada.id, version: publicada.version,
    entrada: { grupos: gruposPublicados, docentes: docentesPublicados, cargas: cargasSnapshot,
      configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1 } },
    sesiones: sesionesRaw.filter(s => s.horario_id === publicada.id).map(aSesion) } : null };
}

export async function publicarHorario(cicloId: string, entrada: EntradaHorario, sesiones: SesionHorario[]): Promise<string> {
  const { data, error } = await supabase.rpc('publicar_horario_academico', {
    p_ciclo_id: cicloId,
    p_grupos: entrada.grupos.map(g => g.id),
    p_cargas: entrada.cargas.map(c => ({ id: c.id, docente_id: c.docenteId, horas_presenciales: c.horasPresenciales, horas_asincronas: c.horasAsincronas, max_bloque: c.maxBloque || 4 })),
    p_sesiones: sesiones.map(s => ({ carga_id: s.cargaId, dia: s.dia, inicio: s.inicio, fin: s.fin })),
    p_max_hueco_grupo: entrada.configuracion.maxHuecoGrupo,
    p_max_hueco_docente: entrada.configuracion.maxHuecoDocente,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function guardarUbicacionGrupo(grupoId: string, aula: string, sede: string): Promise<void> {
  const { error } = await supabase.from('grupos').update({ aula: aula.trim() || null, sede: sede.trim() || null }).eq('id', grupoId);
  if (error) throw new Error(error.message);
}
