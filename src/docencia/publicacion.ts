import { normalizarTurno, type CargaHorario, type GrupoHorario } from '../horarios/types';
import type { ContextoDocencia, PublicacionDocente, MateriaDocente } from './types';

export function adaptarPublicacionDocente(contexto: ContextoDocencia, docenteId: string, nombre: string): PublicacionDocente {
  const grupos = new Map<string, GrupoHorario>(), cargas: CargaHorario[] = [], materias = new Map<string, MateriaDocente>();
  for (const carga of contexto.cargas) {
    if (carga.docente_id !== docenteId) throw new Error('La publicación contiene una carga de otro docente. Actualiza la consulta.');
    const turno = normalizarTurno(carga.grupo_turno);
    if (!turno) throw new Error('Una carga publicada tiene un turno sin identificar. Revisa el horario publicado.');
    const grupoId = carga.grupo_id || `historico:${carga.grupo_codigo}`, materiaId = carga.asignatura_id || `historico:${carga.id}`;
    const plan = carga.asignatura?.planes_estudio;
    const previo=grupos.get(grupoId);
    if(previo&&(previo.planId!==(carga.asignatura?.plan_id||'')||previo.turno!==turno))throw new Error('Un grupo publicado tiene referencias contradictorias de plan o turno. Revisa su publicación.');
    grupos.set(grupoId, { id: grupoId, codigo: carga.grupo_codigo, cicloId: contexto.ciclo.id, planId: carga.asignatura?.plan_id || '', turno, planModalidad: plan?.modalidad, carreraNombre: plan?.carreras?.nombre, planNombre: plan?.nombre, planClave: plan?.clave_legado, rvoe: plan?.rvoe });
    cargas.push({ id: carga.id, grupoId, asignaturaId: materiaId, asignatura: carga.asignatura_nombre, asignaturaClave: carga.asignatura?.clave_legado, docenteId,
      horasTotales: carga.horas_totales, horasPresenciales: carga.horas_presenciales, horasEnLinea: carga.horas_en_linea || 0, horasAsincronas: carga.horas_asincronas });
    const materia = materias.get(materiaId) || { id: materiaId, asignaturaId: carga.asignatura_id, nombre: carga.asignatura_nombre, clave: carga.asignatura?.clave_legado || '', plan: [plan?.carreras?.nombre, plan?.clave_legado].filter(Boolean).join(' · '), grupos: [] };
    if (!materia.grupos.includes(carga.grupo_codigo)) materia.grupos.push(carga.grupo_codigo);
    materias.set(materiaId, materia);
  }
  if (new Set(cargas.map(c => c.id)).size !== cargas.length) throw new Error('Hay cargas repetidas en la publicación. Actualiza la consulta.');
  const mapa = new Map(cargas.map(c => [c.id, c]));
  const sesiones = contexto.sesiones.map(s => {
    const carga = mapa.get(s.carga_id);
    if (!carga || !Number.isInteger(s.dia_semana) || s.dia_semana < 1 || s.dia_semana > 6 || !Number.isInteger(s.hora_inicio) || !Number.isInteger(s.hora_fin) || s.hora_inicio < 7 || s.hora_fin > 21 || s.hora_fin <= s.hora_inicio) throw new Error('Una sesión publicada está incompleta. Revisa el horario publicado.');
    if (s.medio && !['PRESENCIAL', 'EN_LINEA'].includes(s.medio)) throw new Error('Una sesión tiene un medio sin identificar.');
    return { cargaId: carga.id, grupoId: carga.grupoId, asignaturaId: carga.asignaturaId, docenteId, dia: s.dia_semana as 1|2|3|4|5|6, inicio: s.hora_inicio, fin: s.hora_fin, medio: s.medio === 'EN_LINEA' ? 'EN_LINEA' as const : 'PRESENCIAL' as const, aula: s.aula, sede: s.sede };
  });
  return { entrada: { grupos: [...grupos.values()], docentes: [{ id: docenteId, nombre, activo: true, disponibilidad: [], disponibilidadConocida: false, planes: [], asignaturasPreferidas: [], gruposRestringidos: [] }], cargas, configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1 } }, sesiones,
    materias: [...materias.values()].map(m=>({...m,grupos:m.grupos.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}))})).sort((a,b) => a.nombre.localeCompare(b.nombre,'es') || a.plan.localeCompare(b.plan,'es') || a.id.localeCompare(b.id)) };
}
