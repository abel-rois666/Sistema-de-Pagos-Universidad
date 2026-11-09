import { Edit2, ShieldCheck, Wallet } from 'lucide-react';
import type { Alumno, PaymentPlan } from '../../types';
import { formatGrado } from '../../utils/formatUtils';
import { toTitleCase } from '../../utils';

export default function CabeceraFichaAlumno({alumno,plan,totals,verFinanzas,isAdmin,onMonedero}:{
  alumno:Alumno;plan?:PaymentPlan|null;totals:{paid:number;owed:number}|null;verFinanzas:boolean;isAdmin:boolean;onMonedero:()=>void;
}) {
  return <header className="ficha-cabecera"><div className="ficha-identidad"><div className="ficha-avatar" aria-hidden="true">{alumno.nombre_completo.split(' ').slice(0,2).map(n=>n[0]).join('')}</div>
    <div><h2>{toTitleCase(alumno.nombre_completo)}</h2><div className="ficha-identidad-meta"><span>Matrícula: <strong>{alumno.matricula||'Sin registrar'}</strong></span><span>{toTitleCase(alumno.licenciatura)}</span>
      <span className="ficha-estado" data-estado={alumno.estatus} title="Estatus institucional calculado a partir de los programas de estudio del alumno."><ShieldCheck size={12}/> {alumno.estatus||'ACTIVO'} · Institucional</span></div>
      <div className="ficha-identidad-meta"><span>Grado registrado: {formatGrado(alumno.grado_actual)}</span><span>{alumno.turno||'Sin turno'}</span>
      {alumno.beca_porcentaje&&alumno.beca_porcentaje!=='0%'&&<span>Beca {alumno.beca_porcentaje}</span>}
      {((alumno.saldo_a_favor??0)>0||isAdmin)&&<span className="ficha-monedero"><Wallet size={12}/>Monedero: ${(alumno.saldo_a_favor??0).toLocaleString('es-MX',{minimumFractionDigits:2})}
        {isAdmin&&<button type="button" onClick={onMonedero} aria-label="Ajustar monedero del alumno"><Edit2 size={13}/></button>}</span>}</div>
    </div></div>
    {verFinanzas&&<aside className="ficha-finanzas" aria-label="Resumen financiero del ciclo consultado">
      {plan&&totals?<><p>{plan.ciclo_escolar} · Plan {plan.no_plan_pagos}</p><dl><div><dt>Pagado</dt><dd>${totals.paid.toLocaleString('es-MX')}</dd></div><div><dt>Adeudo</dt><dd>${totals.owed.toLocaleString('es-MX')}</dd></div></dl></>:<p>Sin plan de pagos en el ciclo consultado.</p>}
    </aside>}
  </header>;
}
