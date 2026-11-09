import type { ReactNode } from 'react';
import type { Alumno } from '../../types';
import { toTitleCase } from '../../utils';
import { formatGrado } from '../../utils/formatUtils';
import SeleccionVisible from '../ui/SeleccionVisible';

export default function TarjetasAlumnos({alumnos,seleccion,onSeleccion,onSeleccionPagina,acciones,orden,sentido,onOrden,onSentido}:{alumnos:Alumno[];seleccion:Set<string>;onSeleccion:(id:string)=>void;onSeleccionPagina:(marcar:boolean)=>void;acciones:(a:Alumno)=>ReactNode;orden:string;sentido:string;onOrden:(campo:'nombre_completo'|'licenciatura'|'grado_actual'|'turno'|'estatus')=>void;onSentido:()=>void}) {
  return <div className="alumnos-tarjetas"><div className="alumnos-orden-movil"><label>Ordenar por<select value={orden} onChange={e=>onOrden(e.target.value as Parameters<typeof onOrden>[0])}><option value="nombre_completo">Nombre</option><option value="licenciatura">Programa</option><option value="grado_actual">Grado</option><option value="turno">Turno</option><option value="estatus">Estatus</option></select></label><button type="button" onClick={onSentido}>{sentido==='asc'?'Ascendente':'Descendente'}</button></div><label className="alumnos-seleccion-pagina"><SeleccionVisible seleccion={[...seleccion]} visibles={alumnos.map(a=>a.id)} etiqueta="Seleccionar esta página" onChange={e=>onSeleccionPagina(e.target.checked)}/>Seleccionar esta página</label>
    {alumnos.map(a=><article className={`alumno-tarjeta ${seleccion.has(a.id)?'seleccionada':''}`} key={a.id}>
      <div className="alumno-tarjeta-identidad"><input type="checkbox" aria-label={`Seleccionar a ${a.nombre_completo}`} checked={seleccion.has(a.id)} onChange={()=>onSeleccion(a.id)}/><div><h2>{toTitleCase(a.nombre_completo)}</h2><p>{a.matricula||'Sin matrícula registrada'}</p></div><span className={`alumno-estatus ${a.estatus==='BAJA'?'baja':''}`}>{a.estatus||'Sin estatus'}</span></div>
      <p className="alumno-programa">{toTitleCase(a.licenciatura||'Sin programa')} · {formatGrado(a.grado_actual)||'Sin grado'} · {a.turno||'Sin turno'}</p>
      {(a.beca_porcentaje&&a.beca_porcentaje!=='0%'||Number(a.saldo_a_favor)>0)&&<p className="alumno-datos-extra">{[a.beca_porcentaje&&a.beca_porcentaje!=='0%'?`Beca: ${a.beca_porcentaje} · ${a.beca_tipo||''}`:'',Number(a.saldo_a_favor)>0?`Monedero: $${Number(a.saldo_a_favor).toLocaleString('es-MX',{minimumFractionDigits:2})}`:''].filter(Boolean).join(' · ')}</p>}
      <div className="alumno-tarjeta-acciones">{acciones(a)}</div>
    </article>)}
  </div>;
}
