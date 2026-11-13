import BarraPagoCertificadoListado from './BarraPagoCertificadoListado';
import BarraConsultaPagosListado from './BarraConsultaPagosListado';
import ActualizarPagoCertificadoLote from '../certificacion/ActualizarPagoCertificadoLote';
import { lazy,Suspense,useCallback,useMemo,useState,type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft,ArrowUpDown,Download,FileText,Printer,SlidersHorizontal } from 'lucide-react';
import { MultiSelectFilter } from '../MultiSelectFilter';
import AyudaContextual from '../ui/AyudaContextual';
import '../ui/temaModulosEscolares.css';
import { useAppStore } from '../../store/useAppStore';
import { filtrarListadoGeneral } from '../../reportes/filtrosListadoGeneral';
import { COLUMNAS_LISTADO,columnasListado,etiquetaColumnaListado,fechaActualListado,fechaCivilValida,ordenarListado,type ColumnaListadoId } from '../../reportes/listadoGeneral';
import ExportarListadoCSV from './ExportarListadoCSV';
import { crearFiltrosColumnasListado,filtrarColumnasListado,resumenFiltrosColumnas,type SeleccionFiltrosColumnas } from '../../reportes/filtrosColumnasListado';
import FiltrosColumnasListado from './FiltrosColumnasListado';
import { pdfListadoGeneral } from '../../reportes/exportarListadoGeneral';
import { useCertificacionesReporte } from '../../hooks/useCertificacionesReporte';
import { textoCertificaciones,textoPagosTitulacion } from '../../certificacion/seguimiento';
import CeldaSeguimientoAlumno from './CeldaSeguimientoAlumno';
import ConsultaAlumnoReporte, { type DestinoAlumnoReporte } from './ConsultaAlumnoReporte';
import VistasGuardadasListado from './VistasGuardadasListado';
import { useVistasListado } from '../../hooks/useVistasListado';
import { fechaVista, type ConfiguracionVistaListado } from '../../reportes/vistasListado';
import { alcanceAlumnosPagos } from '../../reportes/detallePagosListado';
import type { Alumno } from '../../types';
const DetallePagosListado=lazy(()=>import('./DetallePagosListado'));

interface Props {onBack:()=>void;key?:string}
export function ReporteListadoGeneral({onBack}:Props){
 const usuario=useAppStore(s=>s.currentUser);
 return <ContenidoListadoGeneral key={usuario?.auth_id||usuario?.id||'sin-sesion'} onBack={onBack}/>;
}
function ContenidoListadoGeneral({onBack}:Props){
 const {alumnos,ciclos,catalogos,plans,currentUser}=useAppStore();
 const [selectedCiclos,setSelectedCiclos]=useState<string[]>([]);
 const [selectedLicenciaturas,setSelectedLicenciaturas]=useState<string[]>([]),[selectedTurnos,setSelectedTurnos]=useState<string[]>([]),[selectedEstatus,setSelectedEstatus]=useState<string[]>([]),[selectedTiposPlan,setSelectedTiposPlan]=useState<string[]>([]);
 const [seleccion,setSeleccion]=useState<ColumnaListadoId[]>(['email']),[fecha,setFecha]=useState(fechaActualListado),[orden,setOrden]=useState<ColumnaListadoId>('nombre'),[descendente,setDescendente]=useState(false),[pagina,setPagina]=useState(0);
 const [filtrosAdicionales,setFiltrosAdicionales]=useState<SeleccionFiltrosColumnas>({});
 const [destino,setDestino]=useState<DestinoAlumnoReporte|null>(null),[revision,setRevision]=useState(0);
 const [exportacionCSV,setExportacionCSV]=useState(false);
 const admin=currentUser?.rol==='ADMINISTRADOR';
 const puedeConsultarPagos=['ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR','COORDINADOR FINANCIERO'].includes(currentUser?.rol||'');
 const [seleccionarConsulta,setSeleccionarConsulta]=useState(false),[elegidosConsulta,setElegidosConsulta]=useState<string[]>([]);
 const [consultaPagos,setConsultaPagos]=useState<{alumnos:Alumno[];alcance:string}|null>(null);
 const [modoPago,setModoPago]=useState(false),[alumnosPago,setAlumnosPago]=useState<Record<string,string>>({}),[abrirPago,setAbrirPago]=useState(false);
 const idsPago=useMemo(()=>Object.keys(alumnosPago),[alumnosPago]);
 const marcarAlumnoPago=(id:string,nombre:string,marcado:boolean)=>{if(marcado&&!alumnosPago[id]&&idsPago.length>=50){toast.error('Máximo 50 alumnos por revisión.');return;}setAlumnosPago(s=>{const n={...s};if(marcado)n[id]=nombre;else delete n[id];return n;});};
 const [edadAlDia,setEdadAlDia]=useState(true);
 const configuracion=useMemo<ConfiguracionVistaListado>(()=>({version:1,columnas:seleccion,
  filtros:{ciclos:selectedCiclos,licenciaturas:selectedLicenciaturas,tiposPlan:selectedTiposPlan,turnos:selectedTurnos,estatus:selectedEstatus},
  filtrosColumnas:filtrosAdicionales,orden:{columna:orden,descendente},fechaEdad:{modo:edadAlDia?'hoy':'fija',valor:edadAlDia?null:fecha}}),
  [seleccion,selectedCiclos,selectedLicenciaturas,selectedTiposPlan,selectedTurnos,selectedEstatus,filtrosAdicionales,orden,descendente,edadAlDia,fecha]);
 const aplicarVista=useCallback((c:ConfiguracionVistaListado)=>{
  setSeleccion(c.columnas);setSelectedCiclos(c.filtros.ciclos);setSelectedLicenciaturas(c.filtros.licenciaturas);setSelectedTiposPlan(c.filtros.tiposPlan);
  setSelectedTurnos(c.filtros.turnos);setSelectedEstatus(c.filtros.estatus);setFiltrosAdicionales(c.filtrosColumnas);setOrden(c.orden.columna);setDescendente(c.orden.descendente);
  setFecha(fechaVista(c));setEdadAlDia(c.fechaEdad.modo==='hoy');setPagina(0);
 },[]);
 const vistas=useVistasListado(currentUser?.auth_id||currentUser?.id||'',configuracion,aplicarVista);
 const filteredAlumnos=useMemo(()=>filtrarListadoGeneral(alumnos,plans,{ciclos:selectedCiclos,licenciaturas:selectedLicenciaturas,tiposPlan:selectedTiposPlan,turnos:selectedTurnos,estatus:selectedEstatus}),[alumnos,plans,selectedCiclos,selectedLicenciaturas,selectedTiposPlan,selectedTurnos,selectedEstatus]);

 const idsSeguimiento=useMemo(()=>filteredAlumnos.map(a=>a.id),[filteredAlumnos]);
 const requiereCertificacion=seleccion.includes('pagoCertificado')||seleccion.includes('certificacion');
 const seguimiento=useCertificacionesReporte(idsSeguimiento,requiereCertificacion,revision);
 const columnas=useMemo(()=>columnasListado(seleccion,{
  pagoTitulacion:a=>textoPagosTitulacion(plans,a.id),
  pagoCertificado:a=>seguimiento.error?'No disponible':seguimiento.loading?'Consultando…':textoCertificaciones(seguimiento.filas,a.id,'pagoCertificado'),
  certificacion:a=>seguimiento.error?'No disponible':seguimiento.loading?'Consultando…':textoCertificaciones(seguimiento.filas,a.id,'certificacion')
 }),[seleccion,plans,seguimiento.filas,seguimiento.loading,seguimiento.error]);
 const filtrosColumnas=useMemo(()=>crearFiltrosColumnasListado(alumnos,seleccion,fecha,plans,seguimiento.filas),[alumnos,seleccion,fecha,plans,seguimiento.filas]);
 const pendienteFiltroCertificacion=(seguimiento.loading||Boolean(seguimiento.error))&&filtrosColumnas.some(f=>f.requiereCertificacion&&filtrosAdicionales[f.id]?.length);
 const alumnosPorColumnas=useMemo(()=>pendienteFiltroCertificacion?[]:filtrarColumnasListado(filteredAlumnos,filtrosColumnas,filtrosAdicionales),[filteredAlumnos,filtrosColumnas,filtrosAdicionales,pendienteFiltroCertificacion]);
 const ordenados=useMemo(()=>ordenarListado(alumnosPorColumnas,orden,descendente,fecha,columnas),[alumnosPorColumnas,orden,descendente,fecha,columnas]);
 const paginaActual=Math.min(pagina,Math.max(0,Math.ceil(ordenados.length/25)-1)),visibles=ordenados.slice(paginaActual*25,paginaActual*25+25);
 const ciclosOrdenados=[...ciclos].sort((a,b)=>b.nombre.localeCompare(a.nombre,'es',{numeric:true})||(a.tipo_periodo||'').localeCompare(b.tipo_periodo||'','es')||a.id.localeCompare(b.id));
 const etiquetaCiclo=(id:string)=>{const c=ciclos.find(c=>c.id===id);return c?`${c.nombre} · ${c.tipo_periodo||'Sin tipo'}`:'Ciclo no disponible';};
 const nombreCiclo=selectedCiclos.length?ciclosOrdenados.filter(c=>selectedCiclos.includes(c.id)).map(c=>etiquetaCiclo(c.id)).join(', '):'Todos los ciclos';
 const edadVisible=seleccion.includes('edad'),fechaValida=fechaCivilValida(fecha)&&fecha<=fechaActualListado();
 const estatusList=[...new Set(alumnos.map(a=>a.estatus).filter(Boolean))].sort((a,b)=>a!.localeCompare(b!,'es'));
 const tipoPlanList=[...new Set(plans.map(p=>p.tipo_plan).filter(Boolean))].sort((a,b)=>a!.localeCompare(b!,'es'));
 function cambiarColumna(id:ColumnaListadoId){if(id==='edad'&&seleccion.includes(id)){setEdadAlDia(true);setFecha(fechaActualListado());}setSeleccion(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);setFiltrosAdicionales(f=>{const copia={...f};delete copia[id];return copia;});if(orden===id){setOrden('nombre');setDescendente(false);}setPagina(0);}
 function cambiarFiltroColumna(id:ColumnaListadoId,valores:string[]){setFiltrosAdicionales(f=>({...f,[id]:valores}));setPagina(0);}
 function exportarPDF(imprimir=false){
  if(edadVisible&&!fechaValida||seguimiento.loading||seguimiento.error||vistas.loading)return;
  try{const doc=pdfListadoGeneral(ordenados,columnas,fecha,[`Ciclo de referencia: ${nombreCiclo}`,`Licenciatura: ${selectedLicenciaturas.length?selectedLicenciaturas.join(', '):'Todas'}`,`Turno: ${selectedTurnos.length?selectedTurnos.join(', '):'Todos'} · Estatus: ${selectedEstatus.length?selectedEstatus.join(', '):'Todos'}`,`Tipo de plan: ${selectedTiposPlan.length?selectedTiposPlan.join(', '):'Todos'}`,...resumenFiltrosColumnas(filtrosColumnas,filtrosAdicionales)]);
   if(imprimir)window.open(doc.output('bloburl'),'_blank','noopener');else doc.save(`reporte_alumnos_${fechaActualListado()}.pdf`);
  }catch{toast.error('No se pudo generar el PDF del listado.');}
 }
 function exportarCSV(){
  if(edadVisible&&!fechaValida||seguimiento.loading||seguimiento.error||vistas.loading)return;
  setExportacionCSV(true);
 }
 const abrirConsultaPagos=(filas:Alumno[],alcance:string)=>{if(filas.length)setConsultaPagos({alumnos:filas,alcance});};
 return <>{consultaPagos&&puedeConsultarPagos&&<Suspense fallback={<p role="status">Abriendo consulta de pagos…</p>}><DetallePagosListado alumnos={consultaPagos.alumnos} ciclos={ciclos} alcance={consultaPagos.alcance} onCerrar={()=>setConsultaPagos(null)}/></Suspense>}{exportacionCSV&&<ExportarListadoCSV alumnos={ordenados} planes={plans} ciclos={ciclos} columnas={columnas} fecha={fecha} periodo={nombreCiclo} onCerrar={()=>setExportacionCSV(false)}/>} {abrirPago&&admin&&<ActualizarPagoCertificadoLote alumnos={idsPago} onCerrar={()=>setAbrirPago(false)} onGuardado={()=>{setAbrirPago(false);setAlumnosPago({});setRevision(r=>r+1);}}/>}{destino&&<ConsultaAlumnoReporte destino={destino} onCerrar={()=>setDestino(null)} onActualizado={()=>setRevision(r=>r+1)}/>}<div className="w-full min-w-0 flex flex-col gap-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2228] p-4 sm:p-6 text-gray-900 dark:text-gray-100">
  <header className="flex items-start gap-3"><button aria-label="Volver a reportes" onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft size={22}/></button><FileText size={28} className="shrink-0 text-blue-600 dark:text-blue-400 mt-1"/><div><h2 className="text-xl sm:text-2xl font-semibold font-display">Listado General de Alumnos</h2><p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Elige los filtros y las columnas que necesitas consultar o exportar.</p></div></header>
  <VistasGuardadasListado gestion={vistas} actual={configuracion} edadHoy={edadAlDia} onEdadHoy={v=>{setEdadAlDia(v);if(v)setFecha(fechaActualListado());setPagina(0);}}/>
  {selectedCiclos.some(id=>!ciclos.some(c=>c.id===id))&&<p role="status" className="text-sm text-amber-800 dark:text-amber-200">Hay ciclos guardados que ya no están disponibles. Se conserva su filtro para evitar ampliar los resultados; revisa el ciclo o restablece la consulta.</p>}
  <section aria-label="Filtros del listado" className="flex flex-wrap gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252d36] p-4">
   {[
    {titulo:'Ciclo escolar',label:'Todos los ciclos',ancho:'sm:w-64',opciones:ciclosOrdenados.map(c=>c.id),elegidos:selectedCiclos,cambiar:setSelectedCiclos,formato:etiquetaCiclo},
    {titulo:'Licenciatura',label:'Licenciaturas',ancho:'sm:w-64',opciones:[...catalogos.licenciaturas].sort((a,b)=>a.localeCompare(b,'es')),elegidos:selectedLicenciaturas,cambiar:setSelectedLicenciaturas},
    {titulo:'Tipo de plan',label:'Todos los planes',ancho:'sm:w-52',opciones:tipoPlanList,elegidos:selectedTiposPlan,cambiar:setSelectedTiposPlan},
    {titulo:'Turno',label:'Todos los turnos',ancho:'sm:w-44',opciones:[...catalogos.turnos].sort((a,b)=>a.localeCompare(b,'es')),elegidos:selectedTurnos,cambiar:setSelectedTurnos},
    {titulo:'Estatus',label:'Todos los estatus',ancho:'sm:w-48',opciones:estatusList,elegidos:selectedEstatus,cambiar:setSelectedEstatus}
   ].map(f=><div key={f.titulo} className={`w-full ${f.ancho} min-w-0 [&>div>button]:min-h-[42px]`}><span className="block text-sm font-semibold mb-1">{f.titulo}</span><MultiSelectFilter fullWidth label={f.elegidos.length===1?(f.formato?f.formato(f.elegidos[0]):f.elegidos[0]):f.elegidos.length?f.titulo:f.label} ariaLabel={f.titulo} options={f.opciones} selected={f.elegidos} formatLabel={f.formato} onChange={v=>{f.cambiar(v);setPagina(0);}}/></div>)}
   <p className="basis-full text-xs text-gray-600 dark:text-gray-400">Puedes marcar varias opciones por filtro. Se incluye cualquiera de las opciones marcadas y se combinan los distintos filtros. Sin selección se muestran todas.</p>
  </section>
  <details className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"><summary className="cursor-pointer font-semibold text-sm"><SlidersHorizontal size={16} className="inline mr-2"/>Columnas del listado ({columnas.length})</summary><p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Las columnas elegidas se usan en el CSV por alumno, PDF e impresión. Al exportar CSV también puedes elegir detalles separados por programa o plan de pagos. Las cinco columnas básicas permanecen visibles.</p><fieldset className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4"><legend className="sr-only">Columnas opcionales</legend>{COLUMNAS_LISTADO.filter(c=>c.opcional).map(c=><div key={c.id} className="flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm min-h-10"><input type="checkbox" checked={seleccion.includes(c.id)} onChange={()=>cambiarColumna(c.id)} className="accent-blue-600 w-4 h-4 shrink-0"/><span>{c.nombre}</span></label>{c.ayuda&&<AyudaContextual etiqueta={c.nombre} texto={c.ayuda}/>}</div>)}</fieldset></details>
  <FiltrosColumnasListado filtros={filtrosColumnas} seleccion={filtrosAdicionales} onCambiar={cambiarFiltroColumna} onLimpiar={()=>{setFiltrosAdicionales({});setPagina(0);}} fecha={fecha} fechaValida={fechaValida} onFecha={f=>{setFecha(f);setEdadAlDia(false);setPagina(0);}} cargandoCertificacion={seguimiento.loading} errorCertificacion={Boolean(seguimiento.error)}/>
  <p className="text-xs text-gray-600 dark:text-gray-400">Los datos generales y el grado son actuales: elegir un ciclo anterior no reconstruye su situación histórica. El filtro de ciclo conserva su consulta por plan de pagos o última asignación de grado y no equivale a matrícula confirmada.</p>
  <div className="flex flex-wrap justify-between items-center gap-3"><p className="text-sm font-semibold">{pendienteFiltroCertificacion?'Esperando seguimiento para aplicar filtros':`${ordenados.length} alumnos encontrados`}</p><div className="flex flex-wrap gap-2">{[['Imprimir',()=>exportarPDF(true),<Printer size={16}/>],['PDF',()=>exportarPDF(),<Download size={16}/>],['CSV',exportarCSV,<Download size={16}/>]].map(([nombre,accion,icono])=><button key={String(nombre)} disabled={!ordenados.length||(edadVisible&&!fechaValida)||seguimiento.loading||Boolean(seguimiento.error)||vistas.loading} onClick={accion as ()=>void} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed">{icono as ReactNode}{String(nombre)}</button>)}</div></div>
  {puedeConsultarPagos&&<BarraConsultaPagosListado alumnos={alumnos} filtrados={ordenados.length} elegidos={elegidosConsulta} seleccionando={seleccionarConsulta} pendiente={vistas.loading||pendienteFiltroCertificacion} onAlternar={()=>{setSeleccionarConsulta(v=>!v);if(!seleccionarConsulta)setModoPago(false);}} onLimpiar={()=>setElegidosConsulta([])} onQuitar={id=>setElegidosConsulta(s=>s.filter(x=>x!==id))} onConsultar={()=>{const filas=alcanceAlumnosPagos(alumnos,ordenados,elegidosConsulta);abrirConsultaPagos(filas,`${filas.length} ${filas.length===1?'alumno':'alumnos'} ${elegidosConsulta.length?(filas.length===1?'seleccionado':'seleccionados')+' (en todas las páginas y filtros)':(filas.length===1?'filtrado':'filtrados')+' (todas las páginas)'}`);}}/>}
  {admin&&<BarraPagoCertificadoListado modoPago={modoPago} idsPago={idsPago} alumnosPago={alumnosPago} onAlternar={()=>{setModoPago(v=>!v);if(!modoPago){setSeleccionarConsulta(false);setSeleccion(s=>s.includes('pagoCertificado')?s:[...s,'pagoCertificado']);}}} onQuitar={id=>marcarAlumnoPago(id,'',false)} onAbrir={()=>setAbrirPago(true)} onLimpiar={()=>setAlumnosPago({})}/>}
  {requiereCertificacion&&<p className="text-xs text-gray-600 dark:text-gray-400">Pago y trámite se muestran por programa. Las fichas anteriores sin asociar no se atribuyen a una carrera. El pago de titulación incluye sus planes de todos los ciclos.</p>}{seguimiento.loading&&<p role="status" className="text-sm">Consultando certificaciones…</p>}{seguimiento.error&&<div role="alert" className="text-sm text-red-700 dark:text-red-300"><p>{seguimiento.error}</p><button className="underline mt-2" onClick={()=>setRevision(r=>r+1)}>Reintentar seguimiento</button></div>}<p className="text-xs text-gray-600 dark:text-gray-400">Pulsa una cabecera para ordenar. Las exportaciones incluyen todos los resultados filtrados, no solo la página visible.</p>
  <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700"><table className="w-full text-left border-collapse"><thead className="bg-gray-50 dark:bg-[#2a3441]"><tr>{puedeConsultarPagos&&seleccionarConsulta&&<th className="p-3 w-16"><label className="flex flex-col gap-2 text-xs"><input type="checkbox" aria-label="Seleccionar para consulta los alumnos de esta página" className="w-4 h-4 accent-blue-600" disabled={!visibles.length} checked={Boolean(visibles.length)&&visibles.every(a=>elegidosConsulta.includes(a.id))} ref={n=>{if(n)n.indeterminate=visibles.some(a=>elegidosConsulta.includes(a.id))&&!visibles.every(a=>elegidosConsulta.includes(a.id));}} onChange={e=>setElegidosConsulta(s=>e.target.checked?[...new Set([...s,...visibles.map(a=>a.id)])]:s.filter(id=>!visibles.some(a=>a.id===id)))}/>Consulta</label></th>}{admin&&modoPago&&<th className="p-3 w-12"><input type="checkbox" aria-label="Seleccionar alumnos de esta página" className="w-4 h-4 accent-blue-600" disabled={!visibles.length} checked={Boolean(visibles.length)&&visibles.every(a=>Boolean(alumnosPago[a.id]))} onChange={e=>{const marcar=e.target.checked;const copia={...alumnosPago};for(const a of visibles){if(!marcar)delete copia[a.id];else if(Object.keys(copia).length<50)copia[a.id]=a.nombre_completo;}if(marcar&&visibles.some(a=>!copia[a.id]))toast('Se alcanzó el máximo de 50 alumnos.');setAlumnosPago(copia);}}/></th>}{columnas.map(c=><th key={c.id} aria-sort={orden===c.id?(descendente?'descending':'ascending'):'none'} className="p-3 text-xs font-semibold align-top border-b border-gray-200 dark:border-gray-700" style={{minWidth:c.id==='nombre'?210:130}}><button className="flex gap-2 items-start text-left" onClick={()=>{setOrden(c.id);setDescendente(orden===c.id?!descendente:false);setPagina(0);}}>{etiquetaColumnaListado(c,fecha)}<ArrowUpDown size={13} aria-hidden="true" className="shrink-0 mt-0.5"/></button></th>)}</tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{visibles.map(a=><tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">{puedeConsultarPagos&&seleccionarConsulta&&<td className="p-3 align-top"><input type="checkbox" className="w-4 h-4 accent-blue-600" aria-label={`Consultar pagos de ${a.nombre_completo}`} checked={elegidosConsulta.includes(a.id)} onChange={e=>setElegidosConsulta(s=>e.target.checked?[...new Set([...s,a.id])]:s.filter(id=>id!==a.id))}/></td>}{admin&&modoPago&&<td className="p-3 align-top"><input type="checkbox" className="w-4 h-4 accent-blue-600" aria-label={`Seleccionar a ${a.nombre_completo}`} checked={Boolean(alumnosPago[a.id])} onChange={e=>marcarAlumnoPago(a.id,a.nombre_completo,e.target.checked)}/></td>}{columnas.map(c=><td key={c.id} className="p-3 text-sm align-top whitespace-normal break-words max-w-xs">{c.id==='nombre'?<div><button type="button" className="text-left text-blue-700 dark:text-blue-300 hover:underline focus-visible:outline focus-visible:outline-blue-500 rounded" onClick={()=>setDestino({alumnoId:a.id,vista:'datos_generales'})}>{c.valor(a,fecha)}</button>{puedeConsultarPagos&&<button type="button" className="block mt-2 text-xs text-blue-700 dark:text-blue-300 underline min-h-9" onClick={()=>abrirConsultaPagos([a],`Pagos de ${a.nombre_completo}`)}>Consultar pagos</button>}</div>:['pagoTitulacion','pagoCertificado','certificacion'].includes(c.id)&&!(c.id!=='pagoTitulacion'&&(seguimiento.loading||seguimiento.error))?<CeldaSeguimientoAlumno alumnoId={a.id} campo={c.id as 'pagoTitulacion'|'pagoCertificado'|'certificacion'} certificaciones={seguimiento.filas} planes={plans} onAbrir={setDestino}/>:c.valor(a,fecha)}</td>)}</tr>)}{!visibles.length&&<tr><td colSpan={columnas.length+(admin&&modoPago?1:0)+(puedeConsultarPagos&&seleccionarConsulta?1:0)} className="p-8 text-center text-gray-600 dark:text-gray-400">{pendienteFiltroCertificacion?(seguimiento.error?'No se pudo aplicar el filtro de certificación. Reintenta la consulta.':'Consultando los estados necesarios para aplicar los filtros…'):'No se encontraron alumnos con los filtros seleccionados.'}</td></tr>}</tbody></table></div>
  <nav aria-label="Páginas del listado" className="flex flex-wrap items-center justify-between gap-3 text-sm"><button disabled={!paginaActual} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 disabled:text-gray-500" onClick={()=>setPagina(paginaActual-1)}>Anterior</button><span>Página {paginaActual+1} de {Math.max(1,Math.ceil(ordenados.length/25))} · 25 por página</span><button disabled={(paginaActual+1)*25>=ordenados.length} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 disabled:text-gray-500" onClick={()=>setPagina(paginaActual+1)}>Siguiente</button></nav>
 </div></>;
}
