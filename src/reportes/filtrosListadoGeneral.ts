import type { Alumno, PaymentPlan } from '../types';

export interface FiltrosListadoGeneral {
  ciclos: readonly string[]; licenciaturas: readonly string[]; tiposPlan: readonly string[];
  turnos: readonly string[]; estatus: readonly string[];
}
/** Opciones del mismo filtro se unen; filtros diferentes se intersectan. Vacío significa todos. */
export function filtrarListadoGeneral(alumnos: readonly Alumno[], planes: readonly PaymentPlan[], filtros: FiltrosListadoGeneral) {
  const porAlumno=new Map<string,{ciclos:Set<string>;tipos:Set<string>}>();
  for(const p of planes){
    if(!p.alumno_id)continue;
    const datos=porAlumno.get(p.alumno_id)||{ciclos:new Set<string>(),tipos:new Set<string>()};
    if(p.ciclo_id)datos.ciclos.add(p.ciclo_id);if(p.tipo_plan)datos.tipos.add(p.tipo_plan);
    porAlumno.set(p.alumno_id,datos);
  }
  return alumnos.filter(a=>{
    const planesAlumno=porAlumno.get(a.id);
    if(filtros.ciclos.length&&!filtros.ciclos.some(id=>id===a.ciclo_ultima_asignacion_grado||planesAlumno?.ciclos.has(id)))return false;
    if(filtros.licenciaturas.length&&!filtros.licenciaturas.includes(a.licenciatura))return false;
    if(filtros.turnos.length&&!filtros.turnos.includes(a.turno))return false;
    if(filtros.estatus.length&&!filtros.estatus.includes(a.estatus))return false;
    // Conserva el alcance previo: el tipo se busca en los planes del alumno, independientemente del ciclo de referencia.
    if(filtros.tiposPlan.length&&!filtros.tiposPlan.some(tipo=>planesAlumno?.tipos.has(tipo)))return false;
    return true;
  });
}
