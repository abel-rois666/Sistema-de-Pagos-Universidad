import { useCallback,useEffect,useRef,useState } from 'react';
import toast from 'react-hot-toast';
import { personalService } from '../services/personalService';
import { iniciarRevisionNombre,validarLoteNombres } from '../personal/revisionNombres';
import type { RevisionNombreDocente } from '../personal/types';

export function useRevisionNombres(onSaved:()=>void|Promise<void>){
  const [busqueda,setBusqueda]=useState(''),[consulta,setConsulta]=useState(''),[pagina,setPagina]=useState(0);
  const [filas,setFilas]=useState<RevisionNombreDocente[]>([]),[total,setTotal]=useState(0),[capturas,setCapturas]=useState<Record<string,RevisionNombreDocente>>({});
  const [cargando,setCargando]=useState(true),[guardando,setGuardando]=useState(false),[error,setError]=useState(''),[motivo,setMotivo]=useState('');
  const secuencia=useRef(0);
  const cargar=useCallback(async()=>{const n=++secuencia.current;setCargando(true);setError('');try{
    const r=await personalService.nombresPendientes(consulta,pagina);if(n!==secuencia.current)return;
    setFilas(r.filas.map(iniciarRevisionNombre));setTotal(r.total);
  }catch(e){if(n===secuencia.current)setError((e as Error).message||'No se pudo consultar el listado.');}finally{if(n===secuencia.current)setCargando(false);}},[consulta,pagina]);
  useEffect(()=>{void cargar();return()=>{secuencia.current++;};},[cargar]);
  const visibles=filas.map(f=>capturas[f.docente_id]||f),revisadas=(Object.values(capturas) as RevisionNombreDocente[]).filter(f=>f.revisado);
  const cambiar=(f:RevisionNombreDocente)=>setCapturas(prev=>({...prev,[f.docente_id]:f}));
  const cambios=Object.keys(capturas).length>0||Boolean(motivo);
  async function guardar(){const e=validarLoteNombres(revisadas);if(motivo.trim().length<5)e.push('Describe la revisión realizada.');if(e.length){toast.error(e.join(' '));return;}
    setGuardando(true);setError('');try{await personalService.revisarNombres(revisadas,motivo);setCapturas(prev=>Object.fromEntries(Object.entries(prev).filter(([id])=>!revisadas.some(f=>f.docente_id===id))));setMotivo('');setPagina(0);await cargar();await onSaved();toast.success(`${revisadas.length} nombres confirmados.`);}
    catch(e){const mensaje=(e as Error).message||'No se guardó el lote.';setError(mensaje);toast.error(mensaje);}finally{setGuardando(false);}}
  return {busqueda,setBusqueda,buscar:()=>{setPagina(0);setConsulta(busqueda);},pagina,setPagina,visibles,total,cargando,guardando,error,motivo,setMotivo,cambios,revisadas,cambiar,guardar,cargar};
}
