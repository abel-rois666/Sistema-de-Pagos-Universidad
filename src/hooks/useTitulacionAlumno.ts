import {prepararAsociacionTitulacion} from '../titulacion/revision';
import {useCallback,useEffect,useRef,useState} from 'react';
import {consultarTitulacion,asociarTitulacionAnterior,archivarTitulacion,type ConsultaTitulacion} from '../services/titulacionService';
import type {FichaTitulacion} from '../types';
export function useTitulacionAlumno(alumno:string,onUpdate?:()=>void){
 const [datos,setDatos]=useState<ConsultaTitulacion>({fichas:[],programas:[],ocupados:[]}),[programa,setPrograma]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[revision,setRevision]=useState(0),[cargado,setCargado]=useState('');
 const ocupado=useRef(false),actualizar=useRef(onUpdate);actualizar.current=onUpdate;
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');
 void consultarTitulacion(alumno,c.signal).then(r=>{if(c.signal.aborted)return;setDatos(r);setCargado(alumno);setPrograma(p=>r.programas.some(x=>x.id===p)?p:r.programas.length===1?r.programas[0].id:'');}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[alumno,revision]);
 const recargar=useCallback(()=>setRevision(r=>r+1),[]);
 const asociar=async(id:string,destino:string,motivo:string)=>{
  if(ocupado.current)throw new Error('Espera a que termine la operación actual.');
  const ficha=datos.fichas.find(f=>f.id===id&&!f.alumno_programa_id);if(!ficha)throw new Error('Actualiza la ficha anterior antes de asociar.');
  prepararAsociacionTitulacion(ficha,destino,motivo,datos.programas,datos.ocupados);
  ocupado.current=true;setSaving(true);
  try{const guardada=await asociarTitulacionAnterior(ficha,destino,motivo);setDatos(d=>({...d,fichas:d.fichas.map(f=>f.id===guardada.id?guardada:f),ocupados:[...new Set([...d.ocupados,destino])]}));setPrograma(destino);recargar();actualizar.current?.();}finally{ocupado.current=false;setSaving(false);}
 };
 const archivar=async(id:string,motivo:string)=>{
  if(ocupado.current)throw new Error('Espera a que termine la operación actual.');
  const f=datos.fichas.find(f=>f.id===id);if(!f)throw new Error('Actualiza antes de archivar.');
  ocupado.current=true;setSaving(true);try{await archivarTitulacion(f,motivo);setDatos(d=>({...d,fichas:d.fichas.filter(x=>x.id!==f.id)}));recargar();actualizar.current?.();}finally{ocupado.current=false;setSaving(false);}
 };
 return {...datos,programa,setPrograma,error,loading:loading||cargado!==alumno,saving,revision,recargar,asociar,archivar,anteriores:datos.fichas.filter(f=>!f.alumno_programa_id)};
}
