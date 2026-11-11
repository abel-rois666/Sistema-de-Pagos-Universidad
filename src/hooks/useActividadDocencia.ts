import { useEffect,useRef } from 'react';
/** Comunica la captura del subformulario sin hacer depender sus efectos del callback padre. */
export function useActividadDocencia(cambios:boolean,ocupado:boolean,onActividad:(c:boolean,b:boolean)=>void){
 const actual=useRef(onActividad);actual.current=onActividad;
 useEffect(()=>{actual.current(cambios,ocupado);return()=>actual.current(false,false);},[cambios,ocupado]);
}
