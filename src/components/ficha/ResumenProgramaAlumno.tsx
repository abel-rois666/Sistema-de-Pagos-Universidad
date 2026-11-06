import { fechaCapturaPrograma,fechaCivilPrograma } from '../../utils/fechasProgramaAlumno';
import { useCallback,useEffect,useState,useRef } from 'react';
import type { AlumnoPrograma } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import { trayectoriaAlumnoService as service, type IngresoPrograma } from '../../services/trayectoriaAlumnoService';
import { ROLES_INSCRIPCIONES } from '../../inscripciones/types';
import AyudaContextual from '../ui/AyudaContextual';
import '../ui/temaModulosEscolares.css';
import './resumenPrograma.css';

export default function ResumenProgramaAlumno({alumnoId,programas,onVerTrayectoria}:{alumnoId:string;programas:AlumnoPrograma[];onVerTrayectoria?:(id:string)=>void}){
 const {currentUser,ciclos}=useAppStore(),permitido=ROLES_INSCRIPCIONES.some(r=>r===currentUser?.rol);
 const [seleccion,setSeleccion]=useState(''),[ingresos,setIngresos]=useState<IngresoPrograma[]>([]),[estado,setEstado]=useState<'CARGANDO'|'LISTO'|'NO_HABILITADO'|'ERROR'>('CARGANDO');
 const peticion=useRef(0);
 const ids=programas.map(p=>p.id).sort().join(','),usuario=currentUser?.id;
 const cargar=useCallback(async()=>{
  const numero=++peticion.current;
  if(!permitido||!ids){setIngresos([]);setEstado('NO_HABILITADO');return;}
  try{const resultado=await service.ingresosProgramas(ids.split(','));if(numero!==peticion.current)return;setIngresos(resultado.ingresos);setEstado(resultado.habilitado?'LISTO':'NO_HABILITADO');}
  catch{if(numero===peticion.current){setIngresos([]);setEstado('ERROR');}}
 },[ids,permitido,usuario]);
 useEffect(()=>{setSeleccion('');},[alumnoId]);
 useEffect(()=>{setEstado('CARGANDO');setIngresos([]);void cargar();return()=>{peticion.current++;};},[cargar]);
 useEffect(()=>{const actualizar=()=>void cargar();if(!permitido)return;const canal=supabase.channel(`resumen-ingreso:${alumnoId}`).on('postgres_changes',{event:'*',schema:'public',table:'inscripciones_programa_ingreso'},actualizar).subscribe();window.addEventListener('focus',actualizar);return()=>{window.removeEventListener('focus',actualizar);void supabase.removeChannel(canal);};},[cargar,alumnoId,permitido]);
 const programa=programas.find(p=>p.id===seleccion)||programas.find(p=>p.es_vigente)||programas[0],ingreso=ingresos.find(i=>i.alumno_programa_id===programa?.id),ciclo=ciclos.find(c=>c.id===ingreso?.ciclo_id);
 if(!programa)return null;
 const dato=(etiqueta:string,ayuda:string,valor:string)=><div><dt><span>{etiqueta}</span><AyudaContextual etiqueta={etiqueta} texto={ayuda}/></dt><dd>{valor}</dd></div>;
 return <section className="ic resumen-programa" aria-label="Fechas y trayectoria del programa"><h3>Ingreso y registro del programa</h3>
  <label className="resumen-programa-selector">Programa que estás consultando<select value={programa.id} onChange={e=>setSeleccion(e.target.value)}>{[...programas].sort((a,b)=>(a.planes_estudio?.nombre||'').localeCompare(b.planes_estudio?.nombre||'','es')).map(p=><option value={p.id} key={p.id}>{p.planes_estudio?.clave_legado} · {p.planes_estudio?.nombre}{p.es_vigente?' · Principal':''}</option>)}</select></label>
  <dl>{dato('Registrado en el sistema','Momento en que se creó esta asociación alumno–plan. Puede ser reciente aunque el alumno haya iniciado años antes.',fechaCapturaPrograma(programa.created_at))}
   {dato('Fecha anterior de asociación','Dato editable conservado de las capturas anteriores. No acredita por sí solo el ingreso ni la matrícula en un ciclo.',fechaCivilPrograma(programa.fecha_inscripcion))}
   {dato('Ingreso acreditado al programa','Ciclo y fecha revisados desde Trayectoria. No se deducen de la captura del programa ni de su vigencia.',!permitido?'Consulta con Control Escolar':estado==='CARGANDO'?'Consultando…':estado==='ERROR'?'No se pudo consultar':estado==='NO_HABILITADO'?'Consulta aún no habilitada':ingreso?`${ciclo?`${ciclo.nombre} · ${ciclo.tipo_periodo}`:'Ciclo pendiente'} · ${fechaCivilPrograma(ingreso.fecha)} · ${ingreso.calidad==='DOCUMENTADA'?'Documentado':ingreso.calidad==='APROXIMADA'?'Aproximado':'Pendiente'}`:'Pendiente de acreditar')}
   {dato('Situación del programa','Principal identifica el programa rector del expediente; no confirma una inscripción en un ciclo escolar.',`${programa.es_vigente?'Programa principal':'Programa anterior o adicional'} · ${programa.estatus}`)}</dl>
  <p>El ciclo anterior de origen se consulta en cada inscripción y no se obtiene de la fecha de registro.</p><p>Un cambio de plan dentro de la misma carrera debe revisarse como posible continuidad. Una segunda carrera o posgrado puede tener su propio ingreso. Las fechas no se trasladan automáticamente.</p>
  {estado==='ERROR'&&permitido&&<button type="button" onClick={()=>void cargar().catch(()=>setEstado('ERROR'))}>Volver a consultar ingreso</button>}
  {permitido&&onVerTrayectoria&&<button type="button" className="resumen-programa-enlace" onClick={()=>onVerTrayectoria(programa.id)}>Ver trayectoria e inscripciones de este programa</button>}
 </section>;
}
