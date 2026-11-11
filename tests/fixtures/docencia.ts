import type { ContextoDocencia } from '../../src/docencia/types';
export const DOCENTE_FICTICIO='70000000-0000-4000-8000-000000000001';
export const CICLO_FICTICIO='70000000-0000-4000-8000-000000000002';
export const ASIGNATURA_FICTICIA='70000000-0000-4000-8000-000000000003';
export function contextoDocenteFicticio():ContextoDocencia{
 return {ciclo:{id:CICLO_FICTICIO,nombre:'2027-1',tipo_periodo:'Cuatrimestral',fecha_inicio:'2026-10-05',fecha_termino:'2027-01-10'},publicacion:{id:'70000000-0000-4000-8000-000000000004',version:2},
 cargas:[{id:'carga',grupo_id:'grupo',asignatura_id:ASIGNATURA_FICTICIA,docente_id:DOCENTE_FICTICIO,grupo_codigo:'1-ADM-MAT',grupo_turno:'MATUTINO',asignatura_nombre:'Asignatura ficticia de prueba',docente_nombre:'Docente Ficticio',horas_totales:15,horas_presenciales:15,horas_asincronas:0,asignatura:{clave_legado:'PRUEBA',plan_id:'plan',planes_estudio:{nombre:'Plan ficticio',clave_legado:'FICTICIO',modalidad:'ESCOLARIZADA',tipo_periodo:'CUATRIMESTRAL',carreras:{nombre:'Programa ficticio'}}}}],
 sesiones:[1,2,3,4,5].map(dia=>({carga_id:'carga',dia_semana:dia,hora_inicio:7,hora_fin:10,medio:'PRESENCIAL'})),
 calendarios:[{id:'cal',ciclo_id:CICLO_FICTICIO,nombre:'Calendario ficticio',tipo_periodo:'Cuatrimestral',modalidad:'ESCOLARIZADA',fecha_inicio:'2026-10-05',fecha_fin:'2027-01-10',turnos:['MATUTINO'],plan_ids:['plan']}],eventos:[],expediente:{revision:0,carpeta_drive:null,entregas:[]},financiero:{puede_editar:true,general:{monto:61,revision:0,cortes:[]},excepcion:{monto:null,revision:0}},puede_editar_expediente:true};
}
