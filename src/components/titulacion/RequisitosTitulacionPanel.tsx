import {useId, type ReactNode} from 'react';
import type {EstadosRequisitos, RequisitosTitulacion} from '../../titulacion/requisitos';

interface Props {
  datos: RequisitosTitulacion | null;
  estados: EstadosRequisitos;
  respaldo?: Record<string, unknown> | null;
  completada: boolean;
  error: string;
  loading: boolean;
  editing: boolean;
  exentoInglesSS: boolean;
  pago: string | null;
  ss: string | null;
  modalidad: string | null;
  onPago: (id: string) => void;
  onSS: (id: string) => void;
  onActualizar: () => void;
  onSugerir: () => void;
  children: ReactNode;
}

const etiquetas: Record<string, string> = {
  SIN_INICIAR: 'Sin iniciar', EN_CURSO: 'En curso', COMPLETADO: 'Completado',
  EN_TRAMITE: 'En trámite', TRAMITADO: 'Tramitado', APLICA: 'Sí aplica', NO_APLICA: 'No aplica',
};
const control = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-500 dark:bg-[#1c2228] dark:text-gray-100';

function Fila({nombre, estado, aviso, children}: {nombre: string; estado: string; aviso?: boolean; children: ReactNode}) {
  const aprobado = ['COMPLETADO','TRAMITADO','APLICA'].includes(estado);
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 px-4 py-4 sm:px-5 md:grid-cols-[minmax(11rem,1fr)_8rem_minmax(0,2fr)]">
    <dt className="min-w-0 pt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{nombre}</dt>
    <dd><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${aviso
      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
      : aprobado ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
      : 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'}`}>{etiquetas[estado] || estado}</span></dd>
    <dd className="col-span-2 min-w-0 space-y-2 break-words text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:col-span-1">{children}</dd>
  </div>;
}

export default function RequisitosTitulacionPanel(p: Props) {
  const id = useId();
  const r = p.completada ? p.respaldo : p.datos;
  const numero = (campo: string): number | null => typeof r?.[campo] === 'number' ? r[campo] as number : null;
  const texto = (campo: string): string | null => typeof r?.[campo] === 'string' ? r[campo] as string : null;
  const plan = p.datos?.planes_pago.find(x => x.id === p.pago);
  const social = p.datos?.servicios_sociales.find(x => x.id === (p.ss || texto('servicio_social_id')));
  const fechaGuardada = texto('verificado_en');
  const fecha = fechaGuardada && Number.isFinite(Date.parse(fechaGuardada)) ? fechaGuardada : null;
  const comprobado = p.completada || (!p.loading && !p.error && Boolean(p.datos));
  const estado = (campo: keyof EstadosRequisitos, sinFuente = false) => p.completada ? p.estados[campo] || 'SIN_INICIAR'
    : p.loading ? 'Comprobando…' : !comprobado ? 'Sin comprobar' : sinFuente ? 'Por identificar' : p.estados[campo] || 'SIN_INICIAR';
  const resumenPago = plan ? `${plan.ciclo} · ${plan.tipo_periodo} · ${plan.folio || 'Sin folio'} · ${plan.licenciatura || 'Sin carrera registrada'}` : '';
  const resumenSS = social ? `${social.empresa} · ${social.estado}${social.fecha ? ` · Inicio: ${social.fecha}` : ''}` : '';

  return <section aria-label="Requisitos de titulación" className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#181e25]">
    <header className="space-y-2 border-b border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-[#202936] sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Requisitos de titulación</h3>
        {!p.completada && <button type="button" disabled={p.loading} onClick={p.onActualizar} className="min-h-10 rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait dark:border-gray-500 dark:bg-[#1c2228] dark:text-gray-100 dark:hover:bg-gray-700">Actualizar requisitos</button>}
      </div>
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{p.completada ? 'Estados guardados al completar el trámite.' : p.editing ? 'Los cambios se guardarán al confirmar la ficha.' : 'Estados comprobados del programa seleccionado. Las fuentes se cambian al editar.'}
        {fecha && !p.loading && !p.error && <> <span className="inline-block">Comprobación: <time dateTime={fecha}>{new Date(fecha).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}</time>.</span></>}</p>
      {p.loading && !p.completada && <p role="status" className="text-sm text-gray-700 dark:text-gray-200">Comprobando antecedentes de este programa…</p>}
      {p.error && !p.completada && <div role="alert" className="space-y-2 text-sm text-red-700 dark:text-red-300"><p>{p.error} La captura se conserva; todavía no se pueden guardar ni finalizar los cambios.</p>{p.editing && <button type="button" className="rounded-lg border border-red-400 px-3 py-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-red-600" onClick={() => {p.onPago(''); p.onSS(''); p.onActualizar();}}>Quitar selección de fuentes y volver a revisar</button>}</div>}
    </header>

    <dl className="divide-y divide-gray-200 dark:divide-gray-700/70">
      <Fila nombre="Pago de titulación" estado={estado('pago_titulacion',!p.pago)} aviso={comprobado && !p.pago && !p.completada}>
        {p.editing && !p.completada && <div><label htmlFor={`${id}-pago`} className="text-xs font-medium">Plan de pagos que corresponde a este programa</label>
          <select id={`${id}-pago`} value={p.pago || ''} disabled={!comprobado} onChange={e => p.onPago(e.target.value)} className={control}>
            <option value="">Selecciona el plan financiero</option>{p.datos?.planes_pago.map(x => <option key={x.id} value={x.id}>{x.ciclo} · {x.tipo_periodo} · {x.folio || 'Sin folio'} · {x.licenciatura || 'Sin carrera registrada'}</option>)}
          </select></div>}
        {resumenPago && <p>{resumenPago}</p>}
        {r ? <p>{p.pago ? `${numero('pago_pagados') ?? '—'} de ${numero('pago_conceptos') ?? '—'} conceptos liquidados.` : 'Falta identificar el plan financiero que corresponde a esta carrera.'} {r.pago_revisar === true && 'Hay anotaciones que requieren revisión financiera.'}</p> : <p>{p.completada ? 'Sin respaldo detallado guardado.' : 'El respaldo se mostrará al completar la consulta.'}</p>}
        {p.editing && <p className="text-xs">Seleccionar el plan confirma su correspondencia con esta carrera; la liquidación se comprueba con sus pagos.</p>}
      </Fila>
      <Fila nombre="Certificado total de estudios" estado={estado('certificado_estudios')}>
        <p>{r ? texto('certificacion_id') ? 'Ficha de certificación TOTAL del mismo programa.' : 'No hay un certificado TOTAL activo de este programa.' : p.completada ? 'Estado conservado en la ficha.' : 'Pendiente de comprobación.'}</p>
      </Fila>
      {!p.exentoInglesSS && <Fila nombre="Inglés" estado={estado('ingles')}>
        <p>{r ? numero('ingles_total') ? `${numero('ingles_aprobadas')} de ${numero('ingles_total')} asignaturas aprobadas.` : numero('materias_plan') ? 'La retícula no exige asignaturas de Inglés.' : 'Sin retícula para comprobar el requisito.' : p.completada ? 'Estado conservado en la ficha.' : 'Pendiente de comprobación.'}</p>
      </Fila>}
      {!p.exentoInglesSS && <Fila nombre="Servicio social" estado={estado('servicio_social_req',!(p.ss || texto('servicio_social_id')))} aviso={comprobado && !(p.ss || texto('servicio_social_id')) && !p.completada}>
        {p.editing && !p.completada && <div><label htmlFor={`${id}-ss`} className="text-xs font-medium">Servicio social que corresponde a este programa</label>
          <select id={`${id}-ss`} value={p.ss || texto('servicio_social_id') || ''} disabled={!comprobado} onChange={e => p.onSS(e.target.value)} className={control}>
            <option value="">Selecciona el registro</option>{p.datos?.servicios_sociales.map(x => <option key={x.id} value={x.id}>{x.empresa} · {x.estado} · {x.fecha || 'Sin fecha'}</option>)}
          </select></div>}
        <p>{resumenSS || (p.ss || texto('servicio_social_id') ? 'Registro de servicio social identificado para este programa.' : p.completada ? 'Estado conservado en la ficha.' : 'Falta identificar el registro que corresponde a esta carrera.')}</p>
        {p.editing && <p className="text-xs">Con varias carreras, elige el registro correspondiente; no se hereda de otra titulación.</p>}
      </Fila>}
      <Fila nombre="Promedio de 9.50 o superior" estado={estado('promedio_alto_rendimiento')}>
        <p>{r ? <><strong className="font-semibold text-gray-800 dark:text-gray-100">{numero('promedio') === null ? 'Sin promedio disponible' : numero('promedio')!.toFixed(2)}</strong> · {numero('materias_con_nota') ?? '—'}/{numero('materias_promedio') ?? '—'} asignaturas computables con nota.</> : p.completada ? 'Estado conservado en la ficha.' : 'Pendiente de comprobación.'}</p>
        {comprobado && !p.completada && p.estados.promedio_alto_rendimiento === 'APLICA' && p.modalidad !== 'ALTO RENDIMIENTO ACADÉMICO' && <div className="space-y-2"><p>Cumple el umbral de Alto Rendimiento Académico.</p>{p.editing && <button type="button" onClick={p.onSugerir} className="min-h-10 rounded-lg border border-blue-400 px-3 py-2 text-xs font-semibold text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-500 dark:text-blue-200 dark:hover:bg-blue-950">Usar Alto Rendimiento Académico</button>}</div>}
        {comprobado && !p.completada && p.modalidad === 'ALTO RENDIMIENTO ACADÉMICO' && p.estados.promedio_alto_rendimiento !== 'APLICA' && <p className="font-medium text-amber-800 dark:text-amber-200">{p.estados.promedio_alto_rendimiento === 'NO_APLICA' ? 'El promedio no alcanza 9.50. Revisa la modalidad antes de completar.' : 'El historial está incompleto para acreditar Alto Rendimiento Académico.'}</p>}
      </Fila>
    </dl>
    <div className="border-t border-gray-200 px-4 py-3 text-xs leading-relaxed text-gray-600 dark:border-gray-700 dark:text-gray-300 sm:px-5">
      {p.exentoInglesSS && <p className="mb-2">Inglés y servicio social no se exigen para esta modalidad de Especialidad.</p>}
      <details><summary className="w-fit cursor-pointer rounded font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Cómo se comprueban los requisitos</summary><p className="mt-2 max-w-3xl">La comprobación corresponde al programa seleccionado. El promedio usa la mejor nota por materia, excluye Inglés y complementarias y exige el historial computable completo. El mínimo es 9.50. Identificar un plan financiero no registra cobros ni acredita su liquidación; la modalidad solo cambia cuando la eliges.</p></details>
    </div>
    {p.children}
  </section>;
}
