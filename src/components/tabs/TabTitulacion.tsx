import {useState} from 'react';
import {useProteccionCaptura} from '../../app/ProteccionCaptura';
import {useAppStore} from '../../store/useAppStore';
import {useTitulacionAlumno} from '../../hooks/useTitulacionAlumno';
import type {Alumno,ServicioSocial} from '../../types';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import {CampoConAyuda} from '../ui/AyudaContextual';
import RevisarTitulacionAnterior,{etiquetaProgramaTitulacion} from '../titulacion/RevisarTitulacionAnterior';
import FichaTitulacionPrograma from '../titulacion/FichaTitulacionPrograma';
export default function TabTitulacion(props:{alumnoId:string;esEspecialidad:boolean;modalidadesCatalogo:any[];servicioSocialRegistros?:ServicioSocial[];planesAlumno?:any[];alumno?:Alumno;onUpdate?:()=>void}){
 const c=useTitulacionAlumno(props.alumnoId,props.onUpdate),[anterior,setAnterior]=useState<string|null>(null),[captura,setCaptura]=useState(false);
 const solicitarSalida=useProteccionCaptura(captura,c.saving),admin=useAppStore(s=>s.currentUser?.rol==='ADMINISTRADOR');
 const p=c.programas.find(p=>p.id===c.programa),plan=p?.planes_estudio,fichaAnterior=c.anteriores.find(f=>f.id===anterior);
 if(c.error)return <div role="alert" className="p-4"><p>No se pudo consultar titulación: {c.error}</p><button onClick={c.recargar}>Reintentar consulta</button></div>;
 if(c.loading)return <p role="status">Consultando programas y trámites…</p>;
 return <section className="p-4 space-y-4 text-gray-900 dark:text-gray-100">
 <div className="flex flex-wrap items-end gap-3"><div className="w-full max-w-xl"><CampoConAyuda etiqueta="Programa de titulación" ayuda="Cada programa conserva su trámite. Las fichas anteriores sin programa se revisan por separado y no sustituyen esta consulta."><SelectorBusqueda id="programa-titulacion" etiqueta="Programa de titulación" value={c.programa} disabled={c.saving} onChange={id=>solicitarSalida(()=>c.setPrograma(id))} opciones={c.programas.map(p=>({value:p.id,label:etiquetaProgramaTitulacion(p)})).sort((a,b)=>a.label.localeCompare(b.label,'es'))}/></CampoConAyuda></div><button disabled={c.saving} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-10" onClick={()=>solicitarSalida(c.recargar)}>Actualizar consulta</button></div>
 {c.anteriores.map(f=><aside key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400 p-4 text-sm dark:border-amber-800"><div><p className="font-semibold">Hay una titulación anterior pendiente de identificar</p><p className="mt-1">Sus datos están guardados, pero aún no pertenecen a un programa.</p></div><button className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 min-h-10" disabled={c.saving} onClick={()=>solicitarSalida(()=>setAnterior(f.id))}>{admin?'Revisar y asignar programa':'Consultar ficha pendiente'}</button></aside>)}
 {c.programa&&p?<fieldset key={c.programa+'-'+c.revision} disabled={!admin}><FichaTitulacionPrograma {...props} programaId={c.programa} onArchivada={c.recargar} esEspecialidad={plan?.carreras?.nivel_educativo==='Especialidad'} alumno={props.alumno?{...props.alumno,carrera_nombre:plan?.carreras?.nombre||props.alumno.carrera_nombre}:undefined}/></fieldset>:<p>Selecciona un programa para consultar su trámite.</p>}
 {fichaAnterior&&<RevisarTitulacionAnterior key={fichaAnterior.id} ficha={fichaAnterior} fichas={c.fichas} programas={c.programas} ocupados={c.ocupados} programaInicialId={c.programa} editable={admin} saving={c.saving} onCapturaChange={setCaptura} onCerrar={()=>{setAnterior(null);setCaptura(false);}} onAsignar={c.asociar} onArchivar={c.archivar}/>}
 </section>;
}
