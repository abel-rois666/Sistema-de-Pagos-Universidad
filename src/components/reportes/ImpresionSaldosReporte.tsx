import type { PaymentPlan } from '../../types';
import type { SaldoPorVencimiento } from '../../finanzas/vencimientos';
import type { RegistroReporteFinanciero } from '../../utils/consultaAlumnos';
import { toTitleCase } from '../../utils';
import { formatGrado } from '../../utils/formatUtils';

const moneda = (n: number) => n.toLocaleString('es-MX', {style:'currency',currency:'MXN'});
const importes = ['pagado','vencido','enPlazo','revisarFecha','adeuda'] as const;
const titulos = ['Pagado según los planes','Vencido por pagar','Por pagar, aún en plazo','Pendiente de revisar fecha','Total por pagar'];
/** El mismo conjunto filtrado/ordenado de la pantalla, sin recortarlo a la página visible. */
export default function ImpresionSaldosReporte({ registros, pendientes, total, ciclo, tipo, mes, fecha }: {
  registros: readonly RegistroReporteFinanciero[]; pendientes: readonly PaymentPlan[]; total: SaldoPorVencimiento;
  ciclo: string; tipo: string; mes: string; fecha: string;
}) {
  return <div style={{fontFamily:'sans-serif',fontSize:'10px',color:'#111827'}}>
    <header style={{textAlign:'center',marginBottom:16}}><h1 style={{fontSize:20,fontWeight:'bold',marginBottom:4}}>Pagos y adeudos por alumno</h1><p>Ciclo: {ciclo} · Tipo: {tipo} · Mes: {mes} · Consulta al {fecha.split('-').reverse().join('/')} (Ciudad de México)</p><p style={{marginTop:5}}>Lo que vence hoy sigue en plazo. El total por pagar incluye los importes cuya fecha necesita revisión.</p></header>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginBottom:14,borderBottom:'2px solid #1f2937',paddingBottom:10}}><div><strong>Alumnos: {registros.length}</strong></div>{importes.map((id,i)=><div key={id}><span>{titulos[i]}: </span><strong>{moneda(total[id])}</strong></div>)}</div>
    {pendientes.length>0&&<div style={{border:'1px solid #92400e',padding:8,marginBottom:14}}><strong>Planes pendientes de identificación: {pendientes.length}. No incluidos en los totales.</strong><ul>{pendientes.map(p=><li key={p.id}>{p.no_plan_pagos||'Sin folio'} · {p.nombre_alumno||'Sin nombre registrado'} · {p.tipo_plan}</li>)}</ul></div>}
    {registros.length?<table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed',fontSize:'9px'}}><colgroup>{[24,14,5,7,4,9,9,9,9,10].map((w,i)=><col key={i} style={{width:`${w}%`}}/>)}</colgroup><thead><tr>{['Alumno','Licenciatura','Grado','Estatus','Plan',...titulos].map((t,i)=><th key={t} style={{padding:'6px 4px',textAlign:i<5?'left':'right',verticalAlign:'top',borderBottom:'2px solid #1f2937',background:'#e8eef7',overflowWrap:'anywhere'}}>{t}</th>)}</tr></thead><tbody>{registros.map(r=><tr key={r.id} style={{borderBottom:'1px solid #d1d5db',breakInside:'avoid'}}><td style={{padding:5,verticalAlign:'top',overflowWrap:'anywhere'}}>{toTitleCase(r.nombre)}</td><td style={{padding:5,verticalAlign:'top',overflowWrap:'anywhere'}}>{toTitleCase(r.licenciatura)}</td><td style={{padding:5,verticalAlign:'top'}}>{formatGrado(r.grado)}</td><td style={{padding:5,verticalAlign:'top',overflowWrap:'anywhere'}}>{r.estatus}</td><td style={{padding:5,verticalAlign:'top'}}>{r.tienePlan?'SÍ':'NO'}</td>{importes.map(id=><td key={id} style={{padding:5,textAlign:'right',verticalAlign:'top',fontWeight:id==='adeuda'?'bold':'normal',overflowWrap:'anywhere'}}>{moneda(r[id])}</td>)}</tr>)}</tbody></table>:<p style={{padding:20,textAlign:'center'}}>No hay datos para generar el reporte.</p>}
    <p style={{marginTop:12,fontSize:9}}>Importes derivados de los estatus de los planes y sus abonos. Este reporte no sustituye la consulta de ingresos contables.</p>
  </div>;
}
