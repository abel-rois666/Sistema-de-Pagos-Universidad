import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, FileText, Filter } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useCicloModulo } from '../../hooks/useCicloModulo';
import { filtrarPadron, filtrosPadronVacios, type FiltrosPadron } from '../../utils/consultaAlumnos';
import { compararGrados, gradoCanonico } from '../../utils/promocionAlumnos';
import { formatCicloEscolar, formatGrado } from '../../utils/formatUtils';
import SelectorCicloModulo from '../ui/SelectorCicloModulo';
import { MultiSelectFilter } from '../MultiSelectFilter';
import ModalReporteAlumnos from '../modals/ModalReporteAlumnos';
import CabeceraConsultaFinanciera from './CabeceraConsultaFinanciera';
import './pagosAdeudosAlumnos.css';

function leerFiltros(valor:unknown):FiltrosPadron {
  const base=filtrosPadronVacios();if(!valor||typeof valor!=='object')return base;
  const v=valor as Record<string,unknown>;
  for(const k of ['licenciaturas','grados','turnos','estatus'] as const) if(Array.isArray(v[k]))base[k]=v[k].filter((x):x is string=>typeof x==='string');
  if(typeof v.busqueda==='string')base.busqueda=v.busqueda;
  return base;
}
/** Consulta local con ciclo exacto y la misma población en pantalla, CSV y PDF. */
export default function PagosAdeudosAlumnos() {
  const {alumnos,plans,ciclos,currentUser,activeCicloId:globalId}=useAppStore();
  const location=useLocation(),navigate=useNavigate();
  const origen=location.state as {desdeAlumnos?:boolean;filtrosPadron?:unknown;cicloId?:string}|null;
  const clave=`reporte-pagos-alumnos:${currentUser.id}`;
  const [filtros,setFiltros]=useState(()=>{if(origen?.filtrosPadron)return leerFiltros(origen.filtrosPadron);try{return leerFiltros(JSON.parse(sessionStorage.getItem(clave)||'null'));}catch{return filtrosPadronVacios();}});
  const [cicloId,setCicloId]=useCicloModulo('reporte-pagos-alumnos',ciclos,globalId,currentUser.id,{inicialId:origen?.cicloId});
  useEffect(()=>{try{sessionStorage.setItem(clave,JSON.stringify(filtros));}catch{/* La consulta funciona sin almacenamiento. */}},[clave,filtros]);
  const planes=useMemo(()=>plans.filter(p=>p.ciclo_id===cicloId),[plans,cicloId]);
  const poblacion=useMemo(()=>filtrarPadron(alumnos,filtros),[alumnos,filtros]);
  const opciones=(campo:'licenciatura'|'turno'|'estatus')=>Array.from(new Set(alumnos.map(a=>a[campo]||'').filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  const volver=()=>navigate(origen?.desdeAlumnos?'/alumnos':'/');
  const controlesPadron=<div className="reporte-consulta">
      <SelectorCicloModulo ciclos={ciclos} cicloId={cicloId} onChange={setCicloId} label="Ciclo del reporte" ayuda="Los importes se consultan por el ID exacto. Semestral y Cuatrimestral pueden compartir nombre, pero son ciclos distintos." className="max-w-sm"/>
      <label className="reporte-busqueda"><span>Buscar alumno</span><input value={filtros.busqueda} onChange={e=>setFiltros(f=>({...f,busqueda:e.target.value}))} placeholder="Nombre, matrícula o programa…"/></label>
      <details className="cf-filtros-padron"><summary><Filter size={15}/>Filtros de alumnos{[filtros.licenciaturas,filtros.grados,filtros.turnos,filtros.estatus].some(v=>v.length>0)&&<span className="cf-contador">{[filtros.licenciaturas,filtros.grados,filtros.turnos,filtros.estatus].filter(v=>v.length>0).length}</span>}</summary><div className="reporte-filtros">
        <MultiSelectFilter label="Programa" options={opciones('licenciatura')} selected={filtros.licenciaturas} onChange={v=>setFiltros(f=>({...f,licenciaturas:v}))}/>
        <MultiSelectFilter label="Grado" options={Array.from(new Set(alumnos.map(a=>gradoCanonico(a.grado_actual)))).sort(compararGrados)} selected={filtros.grados} formatLabel={formatGrado} onChange={v=>setFiltros(f=>({...f,grados:v}))}/>
        <MultiSelectFilter label="Turno" options={opciones('turno')} selected={filtros.turnos} onChange={v=>setFiltros(f=>({...f,turnos:v}))}/>
        <MultiSelectFilter label="Estatus" options={opciones('estatus')} selected={filtros.estatus} onChange={v=>setFiltros(f=>({...f,estatus:v}))}/>
        <button type="button" onClick={()=>setFiltros(filtrosPadronVacios())}><RotateCcw size={14}/>Limpiar filtros</button>
      </div></details>
      {origen?.desdeAlumnos&&<p>Se recibieron los filtros de Gestión de Alumnos. Puedes ajustarlos aquí sin cambiar el padrón de origen.</p>}
    </div>;
  return <section className="pagos-adeudos-alumnos consulta-financiera paleta-dashboard">
    <button type="button" className="reporte-volver" onClick={volver}><ArrowLeft size={17}/>{origen?.desdeAlumnos?'Volver a Gestión de Alumnos':'Volver a Consultas y Reportes'}</button>

    {ciclos.some(c=>c.id===cicloId)?<ModalReporteAlumnos key={cicloId} integrado controlesPadron={controlesPadron} alumnos={poblacion} padronCompleto={alumnos} activeCyclePlans={planes} cicloNombre={formatCicloEscolar(ciclos.find(c=>c.id===cicloId)!)} onClose={volver}/>:<section className="cf-panel"><CabeceraConsultaFinanciera titulo="Pagos y adeudos por alumno" descripcion="Elige un ciclo para consultar los saldos." icono={<FileText size={23}/>}>{controlesPadron}<p role="status" className="cf-nota">Selecciona el ciclo del reporte.</p></CabeceraConsultaFinanciera></section>}
  </section>;
}
