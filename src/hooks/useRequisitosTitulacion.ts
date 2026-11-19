import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {verificarRespuestaRequisitos,type RequisitosTitulacion} from '../titulacion/requisitos';
export function useRequisitosTitulacion(alumno:string,programa:string,pago:string|null,ss:string|null,revision:number) {
 const [resultado,setResultado]=useState<{clave:string;datos:RequisitosTitulacion|null;error:string}>({clave:'',datos:null,error:''});
 const clave=JSON.stringify([alumno,programa,pago,ss,revision]);
 useEffect(()=>{
  const c=new AbortController();
  void (async()=>{
   try{
    const {data,error}=await supabase.rpc('titulacion_requisitos_v1',{p_alumno:alumno,p_programa:programa,p_pago:pago,p_ss:ss}).abortSignal(c.signal);
    if(error)throw new Error(['PGRST202','42883','42703'].includes(error.code)?'Falta instalar los requisitos por programa (20261118150000). No se modificó la ficha.':error.message);
    verificarRespuestaRequisitos(data);
    if(data.alumno_id!==alumno||data.alumno_programa_id!==programa)throw new Error('La comprobación no corresponde al programa seleccionado.');
    if(!c.signal.aborted)setResultado({clave,datos:data,error:''});
   }catch(e){if(!c.signal.aborted)setResultado({clave,datos:null,error:e instanceof Error?e.message:'No se pudieron comprobar los requisitos.'});}
  })();return()=>c.abort();
 },[clave,alumno,programa,pago,ss]);
 return {datos:resultado.clave===clave?resultado.datos:null,error:resultado.clave===clave?resultado.error:'',loading:resultado.clave!==clave};
}
