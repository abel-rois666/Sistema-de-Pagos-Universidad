import BitacoraTrayectoria, { type ContextoHistorial } from './BitacoraTrayectoria';
import { conservarReferenciaFecha, fechaInscripcionPropuesta } from '../../inscripciones/fechaPropuesta';
import '../ui/temaModulosEscolares.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, RefreshCw, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { useCicloModulo } from '../../hooks/useCicloModulo';
import { supabase } from '../../lib/supabase';
import { inscripcionesCicloService as service } from '../../services/inscripcionesCicloService';
import { ETIQUETAS_INSCRIPCION, ROLES_INSCRIPCIONES, type CandidatoInscripcion, type CapturaInscripcion, type PreparacionInscripcion } from '../../inscripciones/types';
import { fechaInstitucionalInscripciones, filtrarInscripciones, seleccionarPaginaInscripciones, situacionInscripcion } from '../../inscripciones/dominio';
import SelectorCicloModulo from '../ui/SelectorCicloModulo';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import EditorInscripcion from './EditorInscripcion';
import RevisarHistorialInscripciones from './RevisarHistorialInscripciones';
import PreparacionesInscripcion from './PreparacionesInscripcion';
import IntegracionPromocionInscripciones from './IntegracionPromocionInscripciones';
import AyudaContextual, { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_INSCRIPCIONES as ayuda } from '../../inscripciones/ayudas';
import './inscripciones.css';
import { Link, useSearchParams } from 'react-router-dom';

export default function InscripcionesCiclo() {
  const {currentUser,ciclos,activeCicloId}=useAppStore();
  const [parametros]=useSearchParams();
  const programaEnlace=parametros.get('programa');
  const cicloEnlace=parametros.get('ciclo'),enlaceAplicado=useRef('');
  const [cicloId,setCicloId]=useCicloModulo('inscripciones',ciclos,activeCicloId,currentUser?.id);
  const [filas,setFilas]=useState<CandidatoInscripcion[]>([]),[historicos,setHistoricos]=useState(Boolean(programaEnlace)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [fecha,setFecha]=useState(fechaInstitucionalInscripciones),[busqueda,setBusqueda]=useState(''),[plan,setPlan]=useState(''),[situacion,setSituacion]=useState('');
  const [seleccion,setSeleccion]=useState<string[]>([]),[pagina,setPagina]=useState(0),[editor,setEditor]=useState<CandidatoInscripcion[]|null>(null);
  const [reconciliar,setReconciliar]=useState<CandidatoInscripcion[]|null>(null),[capturasIniciales,setCapturasIniciales]=useState<Record<string,CapturaInscripcion>|undefined>();
  const [preparaciones,setPreparaciones]=useState<PreparacionInscripcion[]>([]),[soloPreparacion,setSoloPreparacion]=useState(false);
  const idsPreparacion=useRef<Record<string,{id:string;revision:number}>>({});
  const [accion,setAccion]=useState<null|{titulo:string;mensaje:string;hacer:()=>void|Promise<void>}>(null);
  const [config,setConfig]=useState<Awaited<ReturnType<typeof service.configuracion>>|null>(null);
  const [cargandoHistorial,setCargandoHistorial]=useState(false);
  const [historial,setHistorial]=useState<{cambios:unknown[];contexto:ContextoHistorial;retornoFoco?:HTMLElement}|null>(null),[novedades,setNovedades]=useState(false);
  const consulta=useRef(0),editorAbierto=useRef(false);editorAbierto.current=Boolean(editor||reconciliar);
  const abrirEditor=(filas:CandidatoInscripcion[],capturas?:Record<string,CapturaInscripcion>)=>{
    const iniciales:Record<string,CapturaInscripcion>={...capturas};let pendiente=false;
    idsPreparacion.current=Object.fromEntries(filas.map(c=>{const p=preparaciones.find(p=>p.ciclo_id===cicloId&&p.alumno_programa_id===c.alumno_programa_id&&p.estado==='PENDIENTE');
      if(p){pendiente=true;const propuesta=capturas?.[c.alumno_programa_id];iniciales[c.alumno_programa_id]={...p.datos,ciclo_origen_id:p.ciclo_origen_id||'',referencia:conservarReferenciaFecha(propuesta?.referencia,p.referencia,p.datos.desde),
        fecha_primer_ingreso:p.datos.fecha_primer_ingreso||propuesta?.fecha_primer_ingreso||'',motivo:''};}
      return [c.alumno_programa_id,{id:p?.id||crypto.randomUUID(),revision:p?.revision||0}];}));
    setSoloPreparacion(pendiente);setCapturasIniciales(Object.keys(iniciales).length?iniciales:undefined);setEditor(filas);
  };
  const permitido=Boolean(currentUser&&ROLES_INSCRIPCIONES.includes(currentUser.rol as typeof ROLES_INSCRIPCIONES[number]));
  const ciclo=ciclos.find(c=>c.id===cicloId);
  useEffect(()=>{if(cicloEnlace&&ciclos.some(c=>c.id===cicloEnlace)&&enlaceAplicado.current!==cicloEnlace){enlaceAplicado.current=cicloEnlace;setCicloId(cicloEnlace);}},[cicloEnlace,ciclos,setCicloId]);
  const cargar=useCallback(async()=>{
    const numero=++consulta.current;
    if(!permitido||!cicloId){setFilas([]);return;}
    setBusy(true);setError('');
    try{const [base,ajustes]=await Promise.all([service.consultar(cicloId,historicos),service.configuracion()]);
      const [datos,pendientes]=ajustes.preparaciones?await Promise.all([service.conContextos(base),service.preparaciones(cicloId)]):[base,[]];
      if(numero===consulta.current){setFilas(programaEnlace?datos.filter(c=>c.alumno_programa_id===programaEnlace):datos);setPreparaciones(programaEnlace?pendientes.filter(p=>p.alumno_programa_id===programaEnlace):pendientes);setConfig(ajustes);setNovedades(false);}}
    catch(e){if(numero===consulta.current){setFilas([]);setPreparaciones([]);setConfig(null);setError((e as Error).message);}}
    finally{if(numero===consulta.current)setBusy(false);}
  },[cicloId,historicos,permitido,programaEnlace]);
  useEffect(()=>{setFilas([]);setPreparaciones([]);setConfig(null);setSeleccion([]);setPlan('');setPagina(0);void cargar();return()=>{consulta.current++;};},[cargar]);
  useEffect(()=>{
    if(!permitido||!cicloId)return;
    const avisar=()=>{if(editorAbierto.current)setNovedades(true);else void cargar();};
    const canal=supabase.channel(`inscripciones:${cicloId}`).on('postgres_changes',{event:'*',schema:'public',table:'inscripciones_ciclo',filter:`ciclo_id=eq.${cicloId}`},avisar);
    if(config?.preparaciones)canal.on('postgres_changes',{event:'*',schema:'public',table:'inscripciones_ciclo_preparaciones',filter:`ciclo_id=eq.${cicloId}`},avisar);
    canal.subscribe();
    window.addEventListener('focus',avisar);
    return()=>{window.removeEventListener('focus',avisar);void supabase.removeChannel(canal);};
  },[cargar,cicloId,permitido,config?.preparaciones]);
  const filtradas=useMemo(()=>filtrarInscripciones(filas,busqueda,plan,situacion,fecha),[filas,busqueda,plan,situacion,fecha]);
  const totalPaginas=Math.max(1,Math.ceil(filtradas.length/25)),paginaActual=Math.min(pagina,totalPaginas-1),visibles=filtradas.slice(paginaActual*25,paginaActual*25+25);
  const seleccionadas=filas.filter(c=>seleccion.includes(c.alumno_programa_id));
  const opcionesPlan=[...new Map<string,string>(filas.map(c=>[c.plan_id,c.programa] as const)).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es'));
  const cambiarContexto=(fn:()=>void)=>seleccion.length?setAccion({titulo:'Cambiar consulta de inscripciones',mensaje:'Se retirará la selección de alumnos del ciclo anterior. Las inscripciones guardadas se conservan.',hacer:()=>{setSeleccion([]);fn();}}):fn();
  async function guardar(preparadas:{candidato:CandidatoInscripcion;captura:CapturaInscripcion}[]) {
    try{const n=await service.guardar(preparadas,cicloId,Boolean(config?.preparaciones));setEditor(null);setSeleccion([]);toast.success(`${n} inscripciones guardadas.`);await cargar();}
    catch(e){toast.error((e as Error).message);}
  }
  async function preparar(filas:{candidato:CandidatoInscripcion;captura:CapturaInscripcion}[]) {
    try{const n=await service.preparar(filas,cicloId,idsPreparacion.current);setEditor(null);setSeleccion([]);toast.success(`${n} preparaciones guardadas; aún no confirman matrícula.`);await cargar();}
    catch(e){toast.error((e as Error).message);}
  }
  if(!permitido)return <p>Sin permiso para administrar inscripciones por ciclo.</p>;
  return <div className="ic"><header className="ic-cabecera"><div><p>CONTROL ESCOLAR / MATRÍCULA DEL CICLO</p><h1>Inscripciones <em>por ciclo</em></h1><span>Confirma quién está inscrito, incluso antes de organizar sus grupos.</span></div><ClipboardCheck size={40}/></header>
    {programaEnlace&&<p className="ic-panel">Consulta de un alumno desde su ficha. <Link to={`/inscripciones?ciclo=${encodeURIComponent(cicloId)}`}>Ver todos los alumnos del ciclo</Link></p>}
    <details className="ic-panel"><summary>Cómo empezar y qué significa cada dato</summary><ol className="ic-pasos"><li><strong>Elige el ciclo.</strong> Consulta los alumnos del programa y selecciona a quienes vas a inscribir. Si necesitas reconstruir antecedentes, «Revisar historial seleccionado» propone datos para que los compruebes; es opcional.</li><li><strong>Completa y revisa.</strong> Abre «Registrar inscripción» o «Revisar inscripciones seleccionadas». Indica desde cuándo estaba inscrito, su grado personal, tipo de ingreso y documento de respaldo.</li><li><strong>Confirma ahora o prepara para después.</strong> «Confirmar inscripción ahora» guarda la inscripción del ciclo. «Guardar preparación pendiente» conserva una propuesta que aún no acredita matrícula. La inscripción por sí sola conserva el grado general y los pagos; el avance se solicita por separado al confirmar una preparación.</li></ol><p className="ic-nota">«Inscripción pendiente» significa que falta confirmar su registro. Una preparación no acredita matrícula. La fecha de primer ingreso es distinta de la fecha de esta reinscripción; el ciclo con calificaciones más antiguo solo permite proponerla.</p></details>
    <section className="ic-panel"><div className="ic-contexto ic-contexto-principal"><div className="ic-selector-ayuda"><SelectorCicloModulo ciclos={ciclos} cicloId={cicloId} onChange={id=>cambiarContexto(()=>setCicloId(id))} label="Ciclo de inscripción" disabled={busy} ayuda={ayuda.ciclo}/></div><CampoConAyuda etiqueta="Ver quién estaba inscrito el" ayuda={ayuda.consulta}><input type="date" value={fecha} onChange={e=>{setFecha(e.target.value);setPagina(0);}}/></CampoConAyuda><button disabled={busy||!cicloId} onClick={()=>void cargar()}><RefreshCw size={16}/>{busy?'Consultando…':'Actualizar'}</button></div>
      <p className="ic-nota">Elige el ciclo que vas a consultar o registrar. La fecha permite ver quién estaba inscrito ese día; no cambia las fechas guardadas. Para inscribir, selecciona alumnos, completa sus datos y confirma. Tener grupo, materias o plan de pagos no confirma por sí solo la inscripción.</p>
      <div className="campo-con-ayuda-etiqueta"><label className="ic-check"><input type="checkbox" checked={historicos} disabled={busy} onChange={e=>cambiarContexto(()=>setHistoricos(e.target.checked))}/>Mostrar también programas anteriores y situaciones que requieren revisión</label><AyudaContextual etiqueta="Programas anteriores o por revisar" texto={ayuda.historicos}/></div>

    </section>
    {config&&<IntegracionPromocionInscripciones activa={config.integrar_promocion} administrador={currentUser?.rol==='ADMINISTRADOR'} disabled={busy} onActualizar={cargar}/>}
    {error&&<section className="ic-aviso" role="alert"><strong>No se pudo consultar la matrícula</strong><p>{error}</p><p>Consulta la guía de instalación de Inscripciones por ciclo; esta pantalla no ejecuta migraciones.</p></section>}
    {novedades&&<p className="ic-aviso">Hay cambios nuevos. El formulario abierto conserva su preparación; al guardar se comprobará que las revisiones sigan vigentes.</p>}
    <section className="ic-resumen" aria-label="Resumen de resultados filtrados">{[
      ['Alumnos distintos',new Set(filtradas.map(c=>c.alumno_id)).size],['Inscritos sin grupo',filtradas.filter(c=>situacionInscripcion(c,fecha)==='SIN_GRUPO').length],['Inscritos con grupo',filtradas.filter(c=>situacionInscripcion(c,fecha)==='CON_GRUPO').length],['Por confirmar',filtradas.filter(c=>!c.inscripcion).length],
    ].map(([nombre,n])=><div key={nombre}><strong>{n}</strong><span>{nombre}</span></div>)}</section>
    <section className="ic-panel"><div className="ic-filtros"><label><span><Search size={14}/> Buscar alumno o programa</span><input value={busqueda} onChange={e=>{setBusqueda(e.target.value);setPagina(0);}} placeholder="Nombre, matrícula o plan"/></label><label>Programa<select value={plan} onChange={e=>{setPlan(e.target.value);setPagina(0);}}><option value="">Todos los programas</option>{opcionesPlan.map(([id,nombre])=><option key={id} value={id}>{nombre}</option>)}</select></label><label>Situación<select value={situacion} onChange={e=>{setSituacion(e.target.value);setPagina(0);}}><option value="">Todas las situaciones</option>{Object.entries(ETIQUETAS_INSCRIPCION).map(([k,n])=><option value={k} key={k}>{n}</option>)}</select></label></div>
      <div className="ic-acciones"><p><Users size={16}/>{filtradas.length} programas · {seleccion.length} seleccionados (incluidas otras páginas)</p><button disabled={!seleccion.length} onClick={()=>setSeleccion([])}>Quitar selección</button><button className="ic-primario" disabled={busy||!seleccion.length||seleccion.length>500} onClick={()=>abrirEditor(seleccionadas)}>Revisar inscripciones seleccionadas</button><button disabled={busy||!seleccion.length||seleccion.length>500} onClick={()=>setReconciliar(seleccionadas)}>Revisar historial seleccionado</button><button disabled={busy||!config?.puente_911||!seleccionadas.length||seleccionadas.some(c=>!c.inscripcion||c.inscripcion.estado==='CANCELADA')} onClick={()=>setAccion({titulo:'Acreditar fuentes para el 911',mensaje:`Se crearán fuentes 911 para ${seleccionadas.length} inscripciones seleccionadas, conservando fechas y evidencia. Las fuentes 911 existentes no se sobrescribirán. Los expedientes y versiones cerradas permanecen intactos; deberás recalcular y revisar el borrador correspondiente.`,hacer:async()=>{try{const r=await service.enviar911(seleccionadas);toast.success(`${r.creadas} fuentes creadas; ${r.conservadas} existentes conservadas.`);}catch(e){toast.error((e as Error).message);}}})}>Acreditar como fuentes 911</button></div>
      <p className="ic-nota">Selecciona alumnos para habilitar las acciones del lote. Para «Acreditar como fuentes 911», todos deben tener una inscripción confirmada o de baja, nunca cancelada, y la integración debe estar instalada. Después hay que recalcular el expediente 911.</p>{seleccion.length>500&&<p className="ic-aviso">Selecciona como máximo 500 programas por operación.</p>}
      <div className="ic-scroll"><table><thead><tr><th><input aria-label="Seleccionar página visible" type="checkbox" checked={visibles.length>0&&visibles.every(c=>seleccion.includes(c.alumno_programa_id))} onChange={e=>setSeleccion(ids=>seleccionarPaginaInscripciones(ids,visibles,e.target.checked))}/></th><th>Alumno / programa</th><th>Situación al {fecha||'corte'}</th><th>Grado / ingreso</th><th>Grupo e indicios</th><th>Acciones</th></tr></thead><tbody>{visibles.map(c=><tr key={c.alumno_programa_id}><td><input aria-label={`Seleccionar ${c.matricula}`} type="checkbox" checked={seleccion.includes(c.alumno_programa_id)} onChange={e=>setSeleccion(ids=>e.target.checked?[...ids,c.alumno_programa_id]:ids.filter(id=>id!==c.alumno_programa_id))}/></td><td><strong>{c.nombre}</strong><small>{c.matricula} · {c.programa}</small><small>{c.tipo_periodo} · {c.modalidad}{c.historico?' · Programa histórico / revisar':''}</small>{!c.compatible&&<small className="ic-error">Periodicidad por revisar</small>}</td><td><span className={`ic-etiqueta ${situacionInscripcion(c,fecha)}`}>{ETIQUETAS_INSCRIPCION[situacionInscripcion(c,fecha)]}</span>{preparaciones.some(p=>p.alumno_programa_id===c.alumno_programa_id&&p.estado==='PENDIENTE')&&<small>Preparación pendiente guardada</small>}{c.inscripcion&&<small>{c.inscripcion.desde} / {c.inscripcion.hasta||'sin término'}</small>}{fechaInscripcionPropuesta(c.contexto_actual?.contexto)&&<small>Fecha propuesta revisada (aproximada)</small>}</td><td>{c.inscripcion?.grado_personal||`${c.grado_sugerido||'—'} (sugerido)`}<small>{c.inscripcion?.tipo_ingreso||'Ingreso pendiente'}</small></td><td>{c.grupos.join(', ')||'Sin grupo asignado'}<small>{c.fuentes.join(' · ')||(c.inscripcion?'Inscripción acreditada sin otros indicios':'Programa registrado; inscripción por acreditar')}</small></td><td><button disabled={busy} onClick={()=>abrirEditor([c])}>{c.inscripcion?'Revisar / editar':'Registrar inscripción'}</button>{c.inscripcion&&<button disabled={cargandoHistorial} onClick={async(e)=>{const retornoFoco=e.currentTarget;setCargandoHistorial(true);try{setHistorial({retornoFoco,cambios:await service.historial(c.inscripcion!.id),contexto:{alumno:c.nombre,matricula:c.matricula,programa:c.programa,ciclo:`${ciclo?.nombre||''} · ${ciclo?.tipo_periodo||''}`}});}catch(e){toast.error((e as Error).message);}finally{setCargandoHistorial(false);}}}>{cargandoHistorial?'Consultando historial…':'Historial de cambios'}</button>}</td></tr>)}</tbody></table></div>
      {!busy&&!filtradas.length&&<p className="ic-vacio">No hay resultados para estos filtros. Puedes incluir programas históricos o elegir otro ciclo. Ningún registro se crea automáticamente.</p>}
      <footer className="ic-paginacion"><button disabled={paginaActual===0} onClick={()=>setPagina(paginaActual-1)}>Anterior</button><span>Página {paginaActual+1} de {totalPaginas} · 25 por página</span><button disabled={paginaActual+1>=totalPaginas} onClick={()=>setPagina(paginaActual+1)}>Siguiente</button></footer>
    </section>
    {config?.preparaciones&&<PreparacionesInscripcion key={cicloId} preparaciones={preparaciones.filter(p=>p.ciclo_id===cicloId)} filas={filas} ciclos={ciclos} integrar={config.integrar_promocion} onEditar={p=>{const c=filas.find(c=>c.alumno_programa_id===p.alumno_programa_id);if(c)abrirEditor([c]);}} onActualizar={async(avanzado)=>{if(avanzado)await useAppStore.getState().refreshAlumnos();await cargar();}}/>}
    {editor&&<EditorInscripcion filas={editor} capturasIniciales={capturasIniciales} cicloId={cicloId} ciclos={ciclos} soloPreparacion={soloPreparacion} permitirFechaPropuesta={config?.propuesta_fecha_historial===true} ciclo={ciclo?`${ciclo.nombre} · ${ciclo.tipo_periodo}`:''} onClose={()=>setEditor(null)} onGuardar={guardar} onPreparar={config?.preparaciones?preparar:undefined}/>}
    {reconciliar&&ciclo&&<RevisarHistorialInscripciones filas={reconciliar} destino={ciclo} onClose={()=>setReconciliar(null)} onAplicar={(filas,capturas)=>{abrirEditor(filas,capturas);setReconciliar(null);}}/>}
    {historial&&<BitacoraTrayectoria retornoFoco={historial.retornoFoco} cambios={historial.cambios} contexto={historial.contexto} ciclo={id=>{const c=ciclos.find(c=>c.id===id);return c?`${c.nombre} · ${c.tipo_periodo}`:'Ciclo no disponible';}} onCerrar={()=>setHistorial(null)}/>}
    <ModalConfirmacion isOpen={Boolean(accion)} title={accion?.titulo||''} message={accion?.mensaje||''} onCancel={()=>setAccion(null)} onConfirm={()=>{const ejecutar=accion?.hacer;setAccion(null);void ejecutar?.();}}/>
  </div>;
}





