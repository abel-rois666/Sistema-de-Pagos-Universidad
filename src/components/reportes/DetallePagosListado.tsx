import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { Alumno, CicloEscolar } from '../../types';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import { cargarDetallePagosListado } from '../../services/detallePagosListadoService';
import { certificacionesAlumno, estadoPagoCertificado, estadoTramiteCertificado, etiquetaProgramaCertificado, planesTitulacionAlumno } from '../../certificacion/seguimiento';
import { montoPago, movimientosCertificado, movimientosPlan, resumenPlanPagos, separarPagosPorAlumno, tablasDetallePagos, type ContenidoPagos, type DatosPagosListado, type MovimientoPago } from '../../reportes/detallePagosListado';
import { serializarTablaCSV, type TablaCSV } from '../../reportes/detallesListadoCSV';
import { describirPlan } from '../../finanzas/consulta';

const boton = 'min-h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed dark:border-gray-600 dark:hover:bg-gray-800 dark:disabled:text-gray-400';
function RecibosDetalle({ filas }: { filas: MovimientoPago[] }) {
  return filas.length ? <><div className="mt-3 space-y-3 sm:hidden">{filas.map(m => <div key={m.clave} className="rounded-lg border border-gray-200 p-3 text-xs dark:border-gray-600"><p className="font-semibold text-gray-900 dark:text-gray-100">R-{m.recibo.folio ?? 'Sin folio'}{m.recibo.folio_fiscal && <span className="ml-2">F-{m.recibo.folio_fiscal}</span>}</p><p className="mt-1">{m.recibo.fecha_pago || 'Sin fecha'} · {m.recibo.forma_pago || 'Sin dato'}</p><p className="mt-2 font-medium">{m.concepto}</p><dl className="mt-2 space-y-2"><div><dt>Importe del concepto o vínculo</dt><dd className="font-semibold">{montoPago(m.importe)}</dd></div><div><dt>Total del recibo</dt><dd>{montoPago(Number(m.recibo.total))}</dd></div>{Number(m.recibo.uso_saldo_a_favor) > 0 && <div><dt>Monedero en el recibo</dt><dd>{montoPago(Number(m.recibo.uso_saldo_a_favor))}</dd></div>}</dl><p className="mt-2 text-gray-600 dark:text-gray-300">{m.respaldo}</p></div>)}</div><div className="mt-3 hidden overflow-x-auto rounded-lg border border-gray-200 sm:block dark:border-gray-600"><table className="w-full text-left text-xs"><caption className="sr-only">Recibos identificados y sus conceptos</caption><thead className="bg-blue-50 dark:bg-[#293b50]"><tr>{['Recibo / factura', 'Fecha / forma de pago', 'Concepto y respaldo', 'Importe del concepto o vínculo', 'Total del recibo'].map(t => <th key={t} className="p-3 align-top">{t}</th>)}</tr></thead><tbody>{filas.map(m => <tr key={m.clave} className="border-t border-gray-200 dark:border-gray-700"><td className="p-3 align-top whitespace-nowrap"><strong>R-{m.recibo.folio ?? 'Sin folio'}</strong>{m.recibo.folio_fiscal && <span className="block mt-1">F-{m.recibo.folio_fiscal}</span>}</td><td className="p-3 align-top min-w-32">{m.recibo.fecha_pago || 'Sin fecha'}<span className="block mt-1 font-medium">{m.recibo.forma_pago || 'Sin dato'}</span>{Number(m.recibo.uso_saldo_a_favor) > 0 && <span className="block mt-1">Monedero en el recibo: {montoPago(Number(m.recibo.uso_saldo_a_favor))}</span>}</td><td className="p-3 align-top min-w-56">{m.concepto}<span className="block mt-1 text-gray-600 dark:text-gray-300">{m.respaldo}</span></td><td className="p-3 align-top">{montoPago(m.importe)}</td><td className="p-3 align-top whitespace-nowrap">{montoPago(Number(m.recibo.total))}</td></tr>)}</tbody></table></div></> : <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Sin respaldo identificado en recibos activos. Esto no equivale a «No pagado».</p>;
}
interface Props { alumnos: readonly Alumno[]; ciclos: readonly CicloEscolar[]; alcance: string; onCerrar: () => void }
export default function DetallePagosListado(props: Props) {
  const [contexto] = useState(() => ({ alumnos: [...props.alumnos], ciclos: [...props.ciclos], alcance: props.alcance }));
  const [contenido, setContenido] = useState<ContenidoPagos>('ambos');
  const [datos, setDatos] = useState<DatosPagosListado | null>(null), [error, setError] = useState(''), [intento, setIntento] = useState(0), [pagina, setPagina] = useState(0), [exportando, setExportando] = useState(false);
  useEffect(() => {
    const control = new AbortController(); let vigente = true;
    setDatos(null); setError('');
    const plazo = setTimeout(() => { control.abort(); if (vigente) setError('La consulta excedió el tiempo de espera. Reintenta con menos alumnos o vuelve a consultar. No se muestran resultados parciales.'); }, 60_000);
    void cargarDetallePagosListado(contexto.alumnos.map(a => a.id), control.signal).then(d => { if (vigente && !control.signal.aborted) setDatos(d); })
      .catch(e => { if (vigente && !control.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo consultar el detalle.'); })
      .finally(() => clearTimeout(plazo));
    return () => { vigente = false; clearTimeout(plazo); control.abort(); };
  }, [contexto, intento]);
  const preparado = useMemo(() => {
    if (!datos) return null;
    try { return { tablas: tablasDetallePagos(contexto.alumnos, datos, contexto.ciclos, contenido), error: '' }; }
    catch (e) { return { tablas: null, error: e instanceof Error ? e.message : 'No se pudo preparar el respaldo.' }; }
  }, [datos, contexto, contenido]);
  const fallo = error || preparado?.error;
  const porAlumno = useMemo(() => datos ? separarPagosPorAlumno(datos) : new Map<string, DatosPagosListado>(), [datos]);
  const totalPaginas = Math.max(1, Math.ceil(contexto.alumnos.length / 10));
  async function descargar() {
    if (!preparado?.tablas) return;
    setExportando(true);
    try {
      const JSZip = (await import('jszip')).default, zip = new JSZip();
      for (const [nombre, tabla] of Object.entries(preparado.tablas as Record<string, TablaCSV>)) zip.file(nombre, serializarTablaCSV(tabla));
      zip.file('LEEME.txt', `${contexto.alcance}\nConsulta: ${contenido}. Datos al ${new Date().toISOString()}.\nLos filtros del listado seleccionan alumnos; se consultan todos sus ciclos financieros.\nEstados de certificado por programa; recibos de certificado sin atribución automática a una carrera. Los conceptos identificados por texto requieren revisión.\nPagado según el plan e importes vinculados son fuentes distintas, no se suman entre sí. Las referencias históricas no prueban el importe aplicado.\nUn recibo puede repetirse por concepto o plan: no sumar el total del recibo por fila ni sumar categorías entre sí. Solo se cuentan recibos activos y vínculos no anulados. Una factura y su recibo representan el mismo pago.\nLos importes incluyen aplicaciones de monedero cuando existan; no equivalen necesariamente a ingreso nuevo. No se modifica saldo ni se acredita excedente.\nSin respaldo identificado no equivale a No pagado.\n`);
      const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' })), a = document.createElement('a');
      try { a.href = url; a.download = `detalle_pagos_${new Date().toISOString().slice(0, 10)}.zip`; document.body.append(a); a.click(); }
      finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { toast.error('No se pudo generar la descarga. La consulta se conserva.'); }
    finally { setExportando(false); }
  }
  return <ModalConfirmacion isOpen wide type="info" title="Pagos de certificados y titulación" onCancel={props.onCerrar} cancelText="Volver al listado" onConfirm={descargar} confirmText="Exportar detalle (ZIP)" busy={exportando} confirmDisabled={!preparado?.tablas || Boolean(fallo)} message={<div className="space-y-4 text-left">
    <p className="font-semibold text-gray-900 dark:text-gray-100">{contexto.alcance}</p>
    <p className="text-xs">Los filtros definen los alumnos. Se consultan sus recibos y planes de todos los ciclos, sin cambiar tu listado.</p>
    <label className="block max-w-xs font-semibold">Contenido de la consulta<select className="mt-1 block min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-[#202832] dark:text-gray-100" value={contenido} onChange={e => setContenido(e.target.value as ContenidoPagos)}><option value="ambos">Certificados y titulación</option><option value="certificados">Solo certificados</option><option value="titulacion">Solo titulación</option></select></label>
    {fallo ? <div role="alert" className="rounded-lg border border-red-300 p-3 text-red-700 dark:border-red-800 dark:text-red-300"><p>{fallo}</p><button type="button" className={boton + ' mt-3'} onClick={() => setIntento(n => n + 1)}>Reintentar consulta</button></div> : !datos ? <p role="status">Consultando estados, planes y todos sus recibos… Puedes cerrar para cancelar.</p> : <>
      <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed dark:bg-blue-950/40">El importe aplicado a un concepto y el total del recibo pueden ser distintos. No sumes el total del recibo por cada fila. Las facturas se muestran junto al recibo y no se cuentan como otro pago.</p>
      {contexto.alumnos.slice(pagina * 10, pagina * 10 + 10).map(a => { const propios = porAlumno.get(a.id) || { planes: [], recibos: [], detalles: [], vinculos: [], certificaciones: [] }; return <article key={a.id} className="rounded-xl border border-gray-200 p-3 sm:p-4 dark:border-gray-600">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{a.nombre_completo}</h4><p className="mt-1 text-xs">Matrícula: {a.matricula || 'Sin registrar'}</p>
        {contenido !== 'titulacion' && <section className="mt-4 space-y-2"><h5 className="font-semibold text-gray-900 dark:text-gray-100">Certificados</h5>
          {certificacionesAlumno(datos.certificaciones, a.id).length ? certificacionesAlumno(datos.certificaciones, a.id).map(f => <div key={`${f.alumno_programa_id}/${f.id}`} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60"><p className="font-medium">{etiquetaProgramaCertificado(f)}</p><p className="mt-1">Pago: <strong>{estadoPagoCertificado(f)}</strong> · Trámite: <strong>{estadoTramiteCertificado(f)}</strong></p></div>) : <p>Sin registro de certificación.</p>}
          <p className="text-xs">Recibos del alumno con conceptos de certificado. La ficha no tiene un vínculo directo al recibo: estos importes no se atribuyen automáticamente a los programas anteriores.</p><RecibosDetalle filas={movimientosCertificado(a.id, propios)}/>
        </section>}
        {contenido !== 'certificados' && <section className="mt-5 space-y-3"><h5 className="font-semibold text-gray-900 dark:text-gray-100">Planes de pagos de titulación</h5>
          {planesTitulacionAlumno(datos.planes, a.id).length ? planesTitulacionAlumno(datos.planes, a.id).map(p => {
            const resumen = resumenPlanPagos(p), mov = movimientosPlan(p, propios);
            return <div key={p.id} className="border-t border-gray-200 pt-3 dark:border-gray-700"><p className="font-semibold">{describirPlan(p, contexto.ciclos)}</p><p className="mt-1">{resumen.estado}</p><dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">{[['Importe del plan', resumen.total], ['Pagado según estatus del plan', resumen.pagadoSegunPlan], ['Importe identificado en vínculos', mov.movimientos.some(m => m.importe !== null) ? mov.vinculado : null]].map(([titulo, n]) => <div key={String(titulo)}><dt>{String(titulo)}</dt><dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{montoPago(n as number | null)}</dd></div>)}</dl><p className="mt-2 text-xs">Los importes según estatus y vínculos no se suman entre sí. Este plan financiero no se atribuye a una carrera.</p><RecibosDetalle filas={mov.movimientos}/>{mov.referenciasPendientes.length > 0 && <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Referencias sin recibo activo único localizado: {mov.referenciasPendientes.join(', ')}.</p>}</div>;
          }) : <p>No tiene planes de pagos de titulación registrados.</p>}
        </section>}
      </article>;})}
      <nav aria-label="Páginas del detalle de pagos" className="flex flex-wrap items-center justify-between gap-2"><button type="button" className={boton} disabled={!pagina} onClick={() => setPagina(p => p - 1)}>Anterior</button><span className="text-xs">Página {pagina + 1} de {totalPaginas} · 10 alumnos por página</span><button type="button" className={boton} disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button></nav><p className="text-xs">El ZIP incluye todos los alumnos de esta consulta, no solo esta página: estados por programa, planes financieros y recibos en archivos separados.</p>
    </>}
  </div>}/>;
}
