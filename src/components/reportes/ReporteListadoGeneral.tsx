import { useMemo,useState,type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft,ArrowUpDown,Download,FileText,Printer,SlidersHorizontal } from 'lucide-react';
import { MultiSelectFilter } from '../MultiSelectFilter';
import AyudaContextual, { CampoConAyuda } from '../ui/AyudaContextual';
import '../ui/temaModulosEscolares.css';
import { useAppStore } from '../../store/useAppStore';
import { useCicloModulo } from '../../hooks/useCicloModulo';
import { COLUMNAS_LISTADO,columnasListado,csvListado,etiquetaColumnaListado,fechaActualListado,fechaCivilValida,gradoListado,ordenarListado,type ColumnaListadoId } from '../../reportes/listadoGeneral';
import { pdfListadoGeneral } from '../../reportes/exportarListadoGeneral';

interface Props {onBack:()=>void}
const control='w-full h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1c2228] px-3 text-sm text-gray-900 dark:text-gray-100';
export function ReporteListadoGeneral({onBack}:Props){
 const {alumnos,ciclos,catalogos,plans,activeCicloId,currentUser}=useAppStore();
 const [selectedCiclo,setSelectedCiclo]=useCicloModulo('listado-general',ciclos,activeCicloId,currentUser?.id,{todos:true});
 const [selectedLicenciaturas,setSelectedLicenciaturas]=useState<string[]>([]),[selectedTurno,setSelectedTurno]=useState('TODOS'),[selectedEstatus,setSelectedEstatus]=useState('TODOS'),[selectedTipoPlan,setSelectedTipoPlan]=useState('TODOS');
 const [seleccion,setSeleccion]=useState<ColumnaListadoId[]>(['email']),[fecha,setFecha]=useState(fechaActualListado),[orden,setOrden]=useState<ColumnaListadoId>('nombre'),[descendente,setDescendente]=useState(false),[pagina,setPagina]=useState(0);
 const [selectedGrados,setSelectedGrados]=useState<string[]>([]);
 const gradoVisible=seleccion.includes('grado');
  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => {
      // Filtrar por ciclo usando el plan de pagos o el campo directo
      if (selectedCiclo !== 'TODOS') {
        const hasPlanInCiclo = plans.some(p => p.alumno_id === a.id && p.ciclo_id === selectedCiclo);
        if (!hasPlanInCiclo && a.ciclo_ultima_asignacion_grado !== selectedCiclo) return false;
      }
      
      // Filtrar por licenciatura (MultiSelect)
      if (selectedLicenciaturas.length > 0 && !selectedLicenciaturas.includes(a.licenciatura)) return false;
      
      // Filtrar por turno
      if (selectedTurno !== 'TODOS' && a.turno !== selectedTurno) return false;
      
      // Filtrar por estatus
      if (selectedEstatus !== 'TODOS' && a.estatus !== selectedEstatus) return false;
      
      // Filtrar por tipo de plan
      if (selectedTipoPlan !== 'TODOS') {
        const studentPlans = plans.filter(p => p.alumno_id === a.id);
        if (studentPlans.length > 0) {
          const matches = studentPlans.some(p => p.tipo_plan && p.tipo_plan === selectedTipoPlan);
          if (!matches) return false;
        } else {
          return false; // Si no tiene planes y se está filtrando estrictamente por un tipo de plan
        }
      }
      
      return true;
    });
  }, [alumnos, selectedCiclo, selectedLicenciaturas, selectedTurno, selectedEstatus, selectedTipoPlan, plans]);


 const columnas=useMemo(()=>columnasListado(seleccion),[seleccion]);
 const alumnosPorGrado=useMemo(()=>gradoVisible&&selectedGrados.length
  ?filteredAlumnos.filter(a=>selectedGrados.includes(gradoListado(a.grado_actual)))
  :filteredAlumnos,[filteredAlumnos,gradoVisible,selectedGrados]);
 const ordenados=useMemo(()=>ordenarListado(alumnosPorGrado,orden,descendente,fecha),[alumnosPorGrado,orden,descendente,fecha]);
 const gradoList=useMemo(()=>[...new Set(alumnos.map(a=>gradoListado(a.grado_actual)))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true})),[alumnos]);
 const paginaActual=Math.min(pagina,Math.max(0,Math.ceil(ordenados.length/25)-1)),visibles=ordenados.slice(paginaActual*25,paginaActual*25+25);
 const ciclo=ciclos.find(c=>c.id===selectedCiclo),nombreCiclo=ciclo?`${ciclo.nombre} · ${ciclo.tipo_periodo||''}`:'Todos los ciclos';
 const edadVisible=seleccion.includes('edad'),fechaValida=fechaCivilValida(fecha)&&fecha<=fechaActualListado();
 const estatusList=[...new Set(alumnos.map(a=>a.estatus).filter(Boolean))].sort((a,b)=>a!.localeCompare(b!,'es'));
 const tipoPlanList=[...new Set(plans.map(p=>p.tipo_plan).filter(Boolean))].sort((a,b)=>a!.localeCompare(b!,'es'));
 function cambiarColumna(id:ColumnaListadoId){setSeleccion(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);if(id==='grado')setSelectedGrados([]);if(orden===id){setOrden('nombre');setDescendente(false);}setPagina(0);}
 function exportarPDF(imprimir=false){
  if(edadVisible&&!fechaValida)return;
  try{const doc=pdfListadoGeneral(ordenados,columnas,fecha,[`Ciclo de referencia: ${nombreCiclo}`,`Licenciatura: ${selectedLicenciaturas.length?selectedLicenciaturas.join(', '):'Todas'}`,`Turno: ${selectedTurno==='TODOS'?'Todos':selectedTurno} · Estatus: ${selectedEstatus==='TODOS'?'Todos':selectedEstatus}`,`Tipo de plan: ${selectedTipoPlan==='TODOS'?'Todos':selectedTipoPlan}`,...(gradoVisible?[`Grado de avance actual: ${selectedGrados.length?selectedGrados.join(', '):'Todos'}`]:[])]);
   if(imprimir)window.open(doc.output('bloburl'),'_blank','noopener');else doc.save(`reporte_alumnos_${fechaActualListado()}.pdf`);
  }catch{toast.error('No se pudo generar el PDF del listado.');}
 }
 function exportarCSV(){
  if(edadVisible&&!fechaValida)return;
  const url=URL.createObjectURL(new Blob([csvListado(ordenados,columnas,fecha)],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`reporte_alumnos_${fechaActualListado()}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="w-full min-w-0 flex flex-col gap-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2228] p-4 sm:p-6 text-gray-900 dark:text-gray-100">
  <header className="flex items-start gap-3"><button aria-label="Volver a reportes" onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft size={22}/></button><FileText size={28} className="shrink-0 text-blue-600 dark:text-blue-400 mt-1"/><div><h2 className="text-xl sm:text-2xl font-semibold font-display">Listado General de Alumnos</h2><p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Elige los filtros y las columnas que necesitas consultar o exportar.</p></div></header>
  <section aria-label="Filtros del listado" className="flex flex-wrap gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252d36] p-4">
   <label className="w-full sm:w-56 min-w-0"><span className="block text-sm font-semibold mb-1">Ciclo escolar</span><select className={control} value={selectedCiclo} onChange={e=>{setSelectedCiclo(e.target.value);setPagina(0);}}><option value="TODOS">Todos los ciclos</option>{[...ciclos].sort((a,b)=>b.nombre.localeCompare(a.nombre,'es',{numeric:true})||(a.tipo_periodo||'').localeCompare(b.tipo_periodo||'','es')).map(c=><option key={c.id} value={c.id}>{c.nombre} · {c.tipo_periodo}</option>)}</select></label>
   <div className="w-full sm:w-64 min-w-0 [&>div>button]:min-h-[42px]"><span className="block text-sm font-semibold mb-1">Licenciatura</span><MultiSelectFilter fullWidth label="Licenciaturas" options={[...catalogos.licenciaturas].sort((a,b)=>a.localeCompare(b,'es'))} selected={selectedLicenciaturas} onChange={v=>{setSelectedLicenciaturas(v);setPagina(0);}}/></div>
   <label className="w-full sm:w-52"><span className="block text-sm font-semibold mb-1">Tipo de plan</span><select className={control} value={selectedTipoPlan} onChange={e=>{setSelectedTipoPlan(e.target.value);setPagina(0);}}><option value="TODOS">Todos los planes</option>{tipoPlanList.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
   <label className="w-full sm:w-44"><span className="block text-sm font-semibold mb-1">Turno</span><select className={control} value={selectedTurno} onChange={e=>{setSelectedTurno(e.target.value);setPagina(0);}}><option value="TODOS">Todos los turnos</option>{[...catalogos.turnos].sort((a,b)=>a.localeCompare(b,'es')).map(t=><option key={t} value={t}>{t}</option>)}</select></label>
   <label className="w-full sm:w-48"><span className="block text-sm font-semibold mb-1">Estatus</span><select className={control} value={selectedEstatus} onChange={e=>{setSelectedEstatus(e.target.value);setPagina(0);}}><option value="TODOS">Todos los estatus</option>{estatusList.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
   {gradoVisible&&<div className="w-full sm:w-64 min-w-0 [&>div>button]:min-h-[42px]">
    <span className="block text-sm font-semibold mb-1">Grado de avance actual</span>
    <MultiSelectFilter fullWidth label="Grados" options={gradoList} selected={selectedGrados} onChange={v=>{setSelectedGrados(v);setPagina(0);}}/>
   </div>}
  </section>
  <details className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"><summary className="cursor-pointer font-semibold text-sm"><SlidersHorizontal size={16} className="inline mr-2"/>Columnas del listado ({columnas.length})</summary><p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Las columnas elegidas se usan también en CSV, PDF e impresión. Las cinco columnas básicas permanecen visibles.</p><fieldset className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4"><legend className="sr-only">Columnas opcionales</legend>{COLUMNAS_LISTADO.filter(c=>c.opcional).map(c=><div key={c.id} className="flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm min-h-10"><input type="checkbox" checked={seleccion.includes(c.id)} onChange={()=>cambiarColumna(c.id)} className="accent-blue-600 w-4 h-4 shrink-0"/><span>{c.nombre}</span></label>{c.ayuda&&<AyudaContextual etiqueta={c.nombre} texto={c.ayuda}/>}</div>)}</fieldset></details>
  {edadVisible&&<div className="max-w-sm"><CampoConAyuda etiqueta="Calcular edad al" ayuda="Fecha de referencia para contar años cumplidos. No cambia la fecha de nacimiento ni el ciclo del alumno. Se incluye en el encabezado de la columna exportada."><input className={control} type="date" value={fecha} max={fechaActualListado()} onChange={e=>{setFecha(e.target.value);setPagina(0);}} aria-invalid={!fechaValida}/></CampoConAyuda>{!fechaValida&&<p role="alert" className="text-sm text-red-700 dark:text-red-300 mt-2">Indica una fecha válida, no posterior a hoy, para calcular la edad y exportar.</p>}</div>}
  <p className="text-xs text-gray-600 dark:text-gray-400">Los datos generales y el grado son actuales: elegir un ciclo anterior no reconstruye su situación histórica. El filtro de ciclo conserva su consulta por plan de pagos o última asignación de grado y no equivale a matrícula confirmada.</p>
  <div className="flex flex-wrap justify-between items-center gap-3"><p className="text-sm font-semibold">{ordenados.length} alumnos encontrados</p><div className="flex flex-wrap gap-2">{[['Imprimir',()=>exportarPDF(true),<Printer size={16}/>],['PDF',()=>exportarPDF(),<Download size={16}/>],['CSV',exportarCSV,<Download size={16}/>]].map(([nombre,accion,icono])=><button key={String(nombre)} disabled={!ordenados.length||(edadVisible&&!fechaValida)} onClick={accion as ()=>void} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed">{icono as ReactNode}{String(nombre)}</button>)}</div></div>
  <p className="text-xs text-gray-600 dark:text-gray-400">Pulsa una cabecera para ordenar. Las exportaciones incluyen todos los resultados filtrados, no solo la página visible.</p>
  <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700"><table className="w-full text-left border-collapse"><thead className="bg-gray-50 dark:bg-[#2a3441]"><tr>{columnas.map(c=><th key={c.id} aria-sort={orden===c.id?(descendente?'descending':'ascending'):'none'} className="p-3 text-xs font-semibold align-top border-b border-gray-200 dark:border-gray-700" style={{minWidth:c.id==='nombre'?210:130}}><button className="flex gap-2 items-start text-left" onClick={()=>{setOrden(c.id);setDescendente(orden===c.id?!descendente:false);setPagina(0);}}>{etiquetaColumnaListado(c,fecha)}<ArrowUpDown size={13} aria-hidden="true" className="shrink-0 mt-0.5"/></button></th>)}</tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{visibles.map(a=><tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">{columnas.map(c=><td key={c.id} className="p-3 text-sm align-top whitespace-normal break-words max-w-xs">{c.valor(a,fecha)}</td>)}</tr>)}{!visibles.length&&<tr><td colSpan={columnas.length} className="p-8 text-center text-gray-600 dark:text-gray-400">No se encontraron alumnos con los filtros seleccionados.</td></tr>}</tbody></table></div>
  <nav aria-label="Páginas del listado" className="flex flex-wrap items-center justify-between gap-3 text-sm"><button disabled={!paginaActual} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 disabled:text-gray-500" onClick={()=>setPagina(paginaActual-1)}>Anterior</button><span>Página {paginaActual+1} de {Math.max(1,Math.ceil(ordenados.length/25))} · 25 por página</span><button disabled={(paginaActual+1)*25>=ordenados.length} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 disabled:text-gray-500" onClick={()=>setPagina(paginaActual+1)}>Siguiente</button></nav>
 </div>;
}
