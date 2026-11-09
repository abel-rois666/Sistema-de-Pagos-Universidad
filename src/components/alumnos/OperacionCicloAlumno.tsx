import { useState } from 'react';
import type { Alumno, CicloEscolar, PaymentPlan } from '../../types';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorCicloModulo from '../ui/SelectorCicloModulo';
import { formatCicloEscolar } from '../../utils/formatUtils';

export default function OperacionCicloAlumno({alumno,operacion,ciclos,cicloInicial,planes,ocupado,onCerrar,onContinuar}:{
  alumno:Alumno;operacion:'plan'|'promocion';ciclos:CicloEscolar[];cicloInicial:string;planes:PaymentPlan[];ocupado:boolean;onCerrar:()=>void;onContinuar:(cicloId:string)=>void|Promise<void>;
}) {
  const [cicloId,setCicloId]=useState(cicloInicial);
  const ciclo=ciclos.find(c=>c.id===cicloId);
  const existentes=planes.filter(p=>p.alumno_id===alumno.id&&p.ciclo_id===cicloId);
  return <ModalConfirmacion isOpen title={operacion==='plan'?'Crear plan de pagos':'Preparar promoción'} type="info" busy={ocupado} onCancel={onCerrar}
    confirmText={operacion==='plan'?'Crear plan vacío':'Revisar promoción'} confirmDisabled={!ciclos.some(c=>c.id===cicloId)||operacion==='plan'&&!!existentes.length}
    onConfirm={()=>onContinuar(cicloId)} message={<div className="space-y-4 text-left text-sm"><p className="font-semibold">{alumno.nombre_completo}</p><SelectorCicloModulo ciclos={ciclos} cicloId={cicloId} onChange={setCicloId} label={operacion==='plan'?'Ciclo del plan de pagos':'Ciclo de destino'} ayuda="Elige el ID exacto, distinguiendo Semestral y Cuatrimestral. Esta selección solo se usa en la operación y no filtra el padrón."/>
      {existentes.length>0&&<p className="rounded-lg bg-blue-50 p-3 text-blue-800 dark:bg-blue-950 dark:text-blue-200">Con plan de pagos en {ciclo?formatCicloEscolar(ciclo):'un ciclo no disponible'}: {existentes.map(p=>p.no_plan_pagos||'Sin folio').join(', ')}. {operacion==='plan'?'Consulta el plan existente; no se creará otro.':'Si procede el avance, se conservará su plan sin copiarlo ni modificarlo.'}</p>}
      <p>{operacion==='plan'?'Se creará únicamente el plan financiero vacío. Esta acción no confirma una inscripción académica.':'Se revisará el programa vigente, el grado y los planes existentes antes de solicitar la confirmación. El egreso conserva el último grado y no crea un plan ordinario.'}</p></div>}/>;
}
