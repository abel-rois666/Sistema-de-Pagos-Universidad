import { useCallback,useEffect,useRef,useState } from 'react';
import toast from 'react-hot-toast';
import { personalService } from '../services/personalService';
import { actualizarCapturasNombres,iniciarRevisionNombre,mensajeErrorRevisionNombres,validarLoteNombres } from '../personal/revisionNombres';
import type { RevisionNombreDocente } from '../personal/types';

export function useRevisionNombres(onSaved:()=>void|Promise<void>){
  const [busqueda,setBusqueda]=useState(''),[consulta,setConsulta]=useState(''),[pagina,setPagina]=useState(0);
  const [filas,setFilas]=useState<RevisionNombreDocente[]>([]),[total,setTotal]=useState(0),[capturas,setCapturas]=useState<Record<string,RevisionNombreDocente>>({});
  const [cargando,setCargando]=useState(true),[guardando,setGuardando]=useState(false),[errorConsulta,setErrorConsulta]=useState(''),[errorGuardado,setErrorGuardado]=useState(''),[motivo,setMotivo]=useState('');
  const secuencia=useRef(0),bloqueoGuardado=useRef(false);
  const cargar=useCallback(async()=>{const n=++secuencia.current;setCargando(true);setErrorConsulta('');setErrorGuardado('');try{
    const r=await personalService.nombresPendientes(consulta,pagina);if(n!==secuencia.current)return;
    setFilas(r.filas.map(iniciarRevisionNombre));setTotal(r.total);setCapturas(prev=>actualizarCapturasNombres(prev,r.filas));
  }catch(e){if(n===secuencia.current)setErrorConsulta((e as Error).message||'No se pudo consultar el listado.');}finally{if(n===secuencia.current)setCargando(false);}},[consulta,pagina]);
  useEffect(()=>{void cargar();return()=>{secuencia.current++;};},[cargar]);
  const visibles=filas.map(f=>capturas[f.docente_id]||f),revisadas=(Object.values(capturas) as RevisionNombreDocente[]).filter(f=>f.revisado);
  const cambiar=(f:RevisionNombreDocente)=>setCapturas(prev=>({...prev,[f.docente_id]:f}));
  const cambios=Object.keys(capturas).length>0||Boolean(motivo);
  async function guardar(){if(bloqueoGuardado.current)return;const e=validarLoteNombres(revisadas);if(motivo.trim().length<5||motivo.trim().length>1000)e.push('Describe la revisión realizada (5–1000 caracteres).');if(e.length){toast.error(e.join(' '));return;}
    bloqueoGuardado.current=true;setGuardando(true);setErrorGuardado('');try{await personalService.revisarNombres(revisadas,motivo);setCapturas(prev=>Object.fromEntries(Object.entries(prev).filter(([id])=>!revisadas.some(f=>f.docente_id===id))));setMotivo('');setPagina(0);toast.success(`${revisadas.length} nombres confirmados.`);await cargar();try{await onSaved();}catch{toast.error('Los nombres se guardaron, pero no se pudo actualizar el directorio. Vuelve a consultarlo.');}}
    catch(e){const mensaje=mensajeErrorRevisionNombres(e);setErrorGuardado(mensaje);toast.error(mensaje);}finally{bloqueoGuardado.current=false;setGuardando(false);}}
  const actualizar=()=>{setCapturas(prev=>Object.fromEntries(Object.entries(prev).map(([id,f])=>[id,{...(f as RevisionNombreDocente),revisado:false}])));void cargar();};
  return {busqueda,setBusqueda,buscar:()=>{setPagina(0);setConsulta(busqueda);},pagina,setPagina,visibles,total,cargando,guardando,error:errorConsulta||errorGuardado,errorConsulta,errorGuardado,motivo,setMotivo,cambios,revisadas,cambiar,guardar,cargar,actualizar};
}
