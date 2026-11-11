import { useCallback,useEffect,useRef,useState } from 'react';
import { docenciaService } from '../services/docenciaService';
import type { ContextoDocencia } from '../docencia/types';
export function useContextoDocencia(docente:string,ciclo:string){
 const [contexto,setContexto]=useState<ContextoDocencia|null>(null),[cargando,setCargando]=useState(false),[error,setError]=useState('');const secuencia=useRef(0);
 const cargar=useCallback(async()=>{const n=++secuencia.current;setContexto(null);setError('');if(!ciclo){setCargando(false);return;}setCargando(true);try{const c=await docenciaService.consultar(docente,ciclo);if(c.ciclo.id!==ciclo)throw new Error('La respuesta no corresponde al ciclo seleccionado.');if(n===secuencia.current)setContexto(c);}catch(e){if(n===secuencia.current)setError((e as Error).message);}finally{if(n===secuencia.current)setCargando(false);}},[docente,ciclo]);
 useEffect(()=>{void cargar();return()=>{secuencia.current++;};},[cargar]);
 return {contexto,setContexto,cargando,error,cargar};
}
