import { fetchAllSupabase, supabase } from '../lib/supabase';
import type { CandidatoInscripcion } from '../inscripciones/types';
import type { CicloHistorialInscripcion, HistorialInscripcion } from '../inscripciones/historial';

/** Solo lectura. Las asociaciones se comprueban por alumno y plan, nunca por nombres. */
export async function consultarHistorialInscripciones(candidatos:CandidatoInscripcion[]):Promise<HistorialInscripcion[]> {
  if (!candidatos.length || candidatos.length>500) throw new Error('Selecciona entre 1 y 500 programas.');
  const {data,error}=await supabase.rpc('ic_trayectorias',{p_programas:candidatos.map(c=>c.alumno_programa_id)});
  if(!error) {
    const historias=data as HistorialInscripcion[];
    if(!Array.isArray(historias)||historias.length!==candidatos.length||historias.some(h=>{
      const c=candidatos.find(x=>x.alumno_programa_id===h.alumno_programa_id);
      return !c||h.alumno_id!==c.alumno_id||h.plan_id!==c.plan_id;
    }))throw new Error('El programa cambió. Recarga los alumnos antes de consultar el historial.');
    return historias;
  }
  if(error.code!=='PGRST202')throw new Error(error.message);
  const resultados:HistorialInscripcion[]=[];
  for(let inicio=0;inicio<candidatos.length;inicio+=50) {
    const lote=candidatos.slice(inicio,inicio+50),alumnos=[...new Set(lote.map(c=>c.alumno_id))],planes=[...new Set(lote.map(c=>c.plan_id))];
    const [academicas,inscripciones,programas,ciclos,asociaciones]=await Promise.all([
      fetchAllSupabase(()=>supabase.from('inscripciones_academicas')
        .select('id,alumno_id,ciclo_id,asignatura_id,asignaturas!inner(id,plan_id,nombre,numero_periodo)')
        .in('alumno_id',alumnos).in('asignaturas.plan_id',planes)
        .or('calificacion_final.not.is.null,parcial_1.not.is.null,parcial_2.not.is.null,parcial_3.not.is.null,promedio_calculado.not.is.null').order('id')),
      fetchAllSupabase(()=>supabase.from('inscripciones_ciclo').select('id,alumno_programa_id,ciclo_id,grado_personal,estado,revision').in('alumno_programa_id',lote.map(c=>c.alumno_programa_id)).order('id')),
      supabase.from('planes_estudio').select('id,modelo').in('id',planes),
      fetchAllSupabase(()=>supabase.from('ciclos_escolares').select('id,nombre,tipo_periodo,fecha_inicio').order('id')),
      supabase.from('alumno_programas').select('id,alumno_id,plan_id').in('id',lote.map(c=>c.alumno_programa_id)),
    ]);
    for(const r of [academicas,inscripciones,programas,ciclos,asociaciones])if(r.error)throw new Error(r.error.message);
    for(const c of lote) {
      const asociacion=asociaciones.data?.find(x=>x.id===c.alumno_programa_id);
      if(!asociacion||asociacion.alumno_id!==c.alumno_id||asociacion.plan_id!==c.plan_id)throw new Error('El programa del alumno cambió o no es accesible. Recarga la lista antes de consultar su historial.');
      const mapa=new Map<string,CicloHistorialInscripcion>();
      const obtener=(id:string)=>{
        if(!mapa.has(id)) {
          const ciclo=ciclos.data?.find(x=>x.id===id);
          if(!ciclo)throw new Error('Un antecedente no tiene ciclo accesible. Revisa los permisos y la integridad del historial.');
          mapa.set(id,{...ciclo,materias:[],inscripcion:null});
        }
        return mapa.get(id)!;
      };
      for(const fila of academicas.data||[]) {
        const materia=Array.isArray(fila.asignaturas)?fila.asignaturas[0]:fila.asignaturas;
        if(fila.alumno_id!==c.alumno_id||materia?.plan_id!==c.plan_id)continue;
        const ciclo=obtener(fila.ciclo_id),existente=ciclo.materias.find(m=>m.id===materia.id);
        if(existente)existente.registros++;
        else ciclo.materias.push({id:materia.id,nombre:materia.nombre,periodo:materia.numero_periodo,registros:1});
      }
      for(const i of inscripciones.data||[])if(i.alumno_programa_id===c.alumno_programa_id)obtener(i.ciclo_id).inscripcion=i;
      resultados.push({alumno_programa_id:c.alumno_programa_id,modelo:programas.data?.find(x=>x.id===c.plan_id)?.modelo||'',huella:'',
        ciclos:[...mapa.values()].sort((a,b)=>(b.fecha_inicio||'').localeCompare(a.fecha_inicio||'')||b.nombre.localeCompare(a.nombre,'es',{numeric:true})||a.id.localeCompare(b.id))});
    }
  }
  return resultados;
}
