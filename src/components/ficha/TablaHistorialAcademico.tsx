import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatearCreditos, situacionHistorial } from '../../utils/presentacionHistorial';
import { valorEvaluacionHistorial, type ColumnaHistorial, type ColumnaHistorialId } from '../../utils/columnasHistorial';
import AyudaContextual from '../ui/AyudaContextual';
import DetalleMateriaHistorial, { notaHistorial } from './DetalleMateriaHistorial';
import './historialAcademico.css';

const calificacionALetras = (num?: number | null): string => {
  if (num === null || num === undefined || isNaN(num)) return '';
  if (num === -555) return 'NO PRESENTÓ';

  const enteros = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ'];
  const [enteroStr, decimalStr] = num.toString().split('.');

  const entero = parseInt(enteroStr);
  if (entero < 0 || entero > 10) return num.toString();

  let texto = enteros[entero] || '';
  if (decimalStr && parseInt(decimalStr) > 0) {
    texto += ` PUNTO ${enteros[parseInt(decimalStr.charAt(0))] || decimalStr.charAt(0)}`;
  }
  return texto;
};



export default function TablaHistorialAcademico({datosAgrupados,cantidad,esEspecialidad,minimo,columnas}: {
  datosAgrupados:any[];cantidad:number;esEspecialidad:boolean;minimo:number;columnas:ColumnaHistorial[];
}) {
  const [abiertas,setAbiertas]=useState<Set<string>>(new Set()),uid=useId();
  const ancho=260+columnas.reduce((sum,c)=>sum+c.ancho,0),anchoMovil=144+columnas.reduce((sum,c)=>sum+c.anchoMovil,0);
  const totalColumnas=1+columnas.length;
  const valor=(item:any,id:ColumnaHistorialId)=>{
    if(id==='ciclo')return item.ordinario?.ciclo?.nombre||item.ordinario?.ciclo_legado||item.ciclo_legado||'—';
    if(id==='final')return notaHistorial(item.mejor_calificacion);
    if(id==='letra')return calificacionALetras(item.mejor_calificacion)||'—';
    if(id==='situacion')return situacionHistorial(item,minimo);
    if(id==='creditos')return formatearCreditos(item.asignatura?.creditos);
    const v=valorEvaluacionHistorial(item,id,esEspecialidad);
    if(id==='promedio'&&v!==null&&v!==undefined&&Number(v)!==-555)return Number(v).toFixed(2);
    return notaHistorial(v);
  };
  return <div className="historial-tabla" style={{'--historial-ancho':`${ancho}px`,'--historial-ancho-movil':`${anchoMovil}px`} as React.CSSProperties}>
    <div className="historial-tabla-scroll" role="region" aria-label="Calificaciones: tabla con desplazamiento horizontal" tabIndex={0}>
      <table aria-label="Historial académico con parciales" aria-describedby={`${uid}-pie`}>
        <colgroup><col className="historial-col-asignatura"/>{columnas.map(c=><col key={c.id} className={`historial-col-${c.id}`} style={{'--col-ancho':`${c.ancho}px`,'--col-movil':`${c.anchoMovil}px`} as React.CSSProperties}/>)}</colgroup>
        <thead><tr><th scope="col">Asignatura</th>{columnas.map(c=><th scope="col" key={c.id} className={`historial-col-${c.id}`} aria-label={c.nombre}><span className="historial-col-titulo">{c.etiqueta}{c.ayuda&&<AyudaContextual etiqueta={c.nombre} texto={c.ayuda}/>}</span></th>)}</tr></thead>
        <tbody>{!datosAgrupados.length&&<tr><td colSpan={totalColumnas} className="historial-sin-resultados">No hay registros académicos con los filtros actuales.</td></tr>}
          {datosAgrupados.map(plan=><React.Fragment key={plan.planClave}>
            <tr className="historial-plan"><th colSpan={totalColumnas} scope="colgroup">{plan.planNombre}<small>{plan.planClave}</small></th></tr>
            {plan.grupos.map((grupo:any,gi:number)=><React.Fragment key={grupo.titulo}>
              <tr className="historial-bloque"><th colSpan={totalColumnas} scope="colgroup">{grupo.titulo}{grupo.modelo==='FLEXIBLE'&&<small>Orden cronológico</small>}</th></tr>
              {grupo.items.map((item:any,i:number)=>{
                const key=`${plan.planClave}-${gi}-${i}`,abierta=abiertas.has(key),id=`${uid}-${encodeURIComponent(key)}`,estado=situacionHistorial(item,minimo);
                return <React.Fragment key={key}><tr>
                  <th scope="row" className="historial-asignatura"><strong>{item.asignatura?.nombre||'Asignatura sin nombre'}</strong>
                    <span className="historial-ciclo-movil">Ciclo: {valor(item,'ciclo')}</span>
                    <div className="historial-materia-meta"><small>{item.asignatura?.clave_legado||'Sin clave'}</small>
                      <button type="button" aria-label={`${abierta?'Ocultar':'Ver'} intentos de ${item.asignatura?.nombre||'la materia'} (${item.asignatura?.clave_legado||key})`} aria-expanded={abierta} aria-controls={abierta?id:undefined}
                        onClick={()=>setAbiertas(prev=>{const n=new Set(prev);n.has(key)?n.delete(key):n.add(key);return n;})}>Intentos<ChevronDown size={12} aria-hidden="true"/></button>
                    </div>
                  </th>
                  {columnas.map(c=><td key={c.id} className={`historial-col-${c.id}`} data-estado={c.id==='final'?estado:undefined}
                    aria-label={c.id==='final'?`${notaHistorial(item.mejor_calificacion)} · ${estado}`:undefined}>{valor(item,c.id)}</td>)}
                </tr>{abierta&&<tr className="historial-detalle"><td colSpan={totalColumnas}><div id={id}><DetalleMateriaHistorial item={item} minimo={minimo} especialidad={esEspecialidad}/></div></td></tr>}</React.Fragment>;
              })}
            </React.Fragment>)}
          </React.Fragment>)}
        </tbody>
      </table>
    </div>
    <p id={`${uid}-pie`} className="historial-pie">{cantidad} {cantidad===1?'asignatura':'asignaturas'} · Ciclo de la fila: registro ordinario. En «Intentos» puedes consultar las evaluaciones y sus ciclos.</p>
  </div>;
}
