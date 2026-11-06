import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { ROLES_INSCRIPCIONES } from '../../inscripciones/types';

/** Complemento informativo: no sustituye los criterios documentales del módulo anfitrión. */
export default function ResumenInscripcionesCiclo({cicloId}:{cicloId:string}) {
  const rol=useAppStore(s=>s.currentUser?.rol);
  const [resumen,setResumen]=useState<{inscritos:number;sin_grupo:number;pendientes:number}|null>(null);
  useEffect(()=>{
    let alive=true;setResumen(null);
    if(!cicloId||!ROLES_INSCRIPCIONES.includes(rol as typeof ROLES_INSCRIPCIONES[number]))return;
    async function consultar(){const {data,error}=await supabase.rpc('ic_resumen',{p_ciclo:cicloId});if(alive&&!error)setResumen(data);}
    void consultar();window.addEventListener('focus',consultar);
    const canal=supabase.channel(`resumen-inscripciones:${cicloId}`).on('postgres_changes',{event:'*',schema:'public',table:'inscripciones_ciclo',filter:`ciclo_id=eq.${cicloId}`},()=>{void consultar();}).subscribe();
    return()=>{alive=false;window.removeEventListener('focus',consultar);void supabase.removeChannel(canal);};
  },[cicloId,rol]);
  if(!resumen)return null;
  return <aside className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><p><strong>Matrícula confirmada del ciclo:</strong> {resumen.inscritos} inscripciones vigentes hoy · {resumen.sin_grupo} sin grupo · {resumen.pendientes} programas pendientes de confirmar.</p><Link className="font-semibold underline" to={`/inscripciones?ciclo=${encodeURIComponent(cicloId)}`}>Revisar inscripciones</Link></aside>;
}
