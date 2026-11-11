import { useEffect, useMemo, useState } from 'react';
import type { Alumno, PaymentPlan } from '../../types';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import { fechaActualListado } from '../../reportes/listadoGeneral';
import { detallePagosTitulacionCSV, detalleProgramasCSV, serializarTablaCSV, tablaAlumnosCSV, type ColumnaCSVAlumno, type ProgramaCSV } from '../../reportes/detallesListadoCSV';
import type { ResumenCertificacion } from '../../certificacion/seguimiento';
import { cargarProgramasExportacion } from '../../services/exportacionListadoService';

type Formato = 'alumnos' | 'programas' | 'pagos' | 'ambos';
interface Props {
  alumnos: readonly Alumno[]; planes: readonly PaymentPlan[];
  ciclos: readonly { id: string; nombre: string; tipo_periodo?: string | null }[];
  columnas: readonly ColumnaCSVAlumno[]; fecha: string; periodo: string; onCerrar: () => void;
  tipoReporte?: 'general' | 'egresados'; descripcionConsulta?: string;
}
const opciones: { id: Formato; titulo: string; detalle: string }[] = [
  { id: 'alumnos', titulo: 'Listado por alumno', detalle: 'Un CSV con las columnas visibles; conserva el resumen de programas en una celda.' },
  { id: 'programas', titulo: 'Detalle por programa académico', detalle: 'Un CSV con carrera, plan, pago y trámite del certificado en columnas separadas.' },
  { id: 'pagos', titulo: 'Planes de pagos de titulación', detalle: 'Un CSV con una fila por plan de pagos, su ciclo y estado, sin atribuirlo a una carrera.' },
  { id: 'ambos', titulo: 'Ambos detalles en ZIP', detalle: 'Dos CSV independientes: programas académicos y planes de pagos de titulación.' }
];
function descargar(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido), enlace = document.createElement('a');
  try { enlace.href = url; enlace.download = nombre; document.body.append(enlace); enlace.click(); }
  finally { enlace.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export default function ExportarListadoCSV(props: Props) {
  // El diálogo mantiene el alcance elegido al abrirlo; no cambia filtros ni filas de la pantalla.
  const [contexto] = useState(() => ({ ...props, alumnos: [...props.alumnos], planes: [...props.planes], columnas: [...props.columnas] }));
  const egresados = contexto.tipoReporte === 'egresados';
  const [formato, setFormato] = useState<Formato>(() => contexto.columnas.some(c => ['pagoCertificado', 'certificacion'].includes(c.id)) ? 'programas' : 'alumnos');
  const [incluirIds, setIncluirIds] = useState(false), [intento, setIntento] = useState(0), [descargando, setDescargando] = useState(false);
  const [consulta, setConsulta] = useState<{ programas: ProgramaCSV[]; certificaciones: ResumenCertificacion[] } | null>(null);
  const [cargando, setCargando] = useState(false), [error, setError] = useState('');
  const academico = formato === 'programas' || formato === 'ambos';
  useEffect(() => {
    if (!academico) return;
    const control = new AbortController(); let vigente = true, agotado = false;
    setCargando(true); setError(''); setConsulta(null);
    const plazo = setTimeout(() => { agotado = true; control.abort(); if (vigente) { setError('La consulta excedió el tiempo de espera. Reintenta; no se descargan resultados parciales.'); setCargando(false); } }, 60_000);
    void cargarProgramasExportacion(contexto.alumnos.map(a => a.id), control.signal)
      .then(datos => { if (vigente && !agotado) setConsulta(datos); })
      .catch(e => { if (vigente && !control.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo preparar el detalle. Reintenta la consulta.'); })
      .finally(() => { clearTimeout(plazo); if (vigente && !agotado) setCargando(false); });
    return () => { vigente = false; clearTimeout(plazo); control.abort(); };
  }, [academico, contexto, intento]);
  const academicoPreparado = useMemo(() => {
    if (!consulta) return null;
    try { return { tabla: detalleProgramasCSV(contexto.alumnos, consulta.programas, consulta.certificaciones, contexto.columnas, contexto.fecha, incluirIds), error: '' }; }
    catch (e) { return { tabla: null, error: e instanceof Error ? e.message : 'No se pudo preparar el detalle académico.' }; }
  }, [consulta, contexto, incluirIds]);
  const pagos = useMemo(() => detallePagosTitulacionCSV(contexto.alumnos, contexto.planes, contexto.ciclos, incluirIds), [contexto, incluirIds]);
  const fallo = error || academicoPreparado?.error || '';
  const pendiente = academico && (cargando || !academicoPreparado?.tabla || Boolean(fallo));
  const programas = academicoPreparado?.tabla?.filas.filter(f => f[0] === 'ALUMNO_PROGRAMA').length || 0;
  const sinAsociar = academicoPreparado?.tabla?.filas.filter(f => f[0] === 'FICHA_SIN_PROGRAMA').length || 0;
  async function exportar() {
    if (pendiente || formato === 'pagos' && !pagos.filas.length) return;
    setDescargando(true);
    try {
      const fecha = fechaActualListado();
      if (formato === 'ambos') {
        const JSZip = (await import('jszip')).default, zip = new JSZip();
        zip.file('programas_academicos.csv', serializarTablaCSV(academicoPreparado!.tabla!));
        zip.file('planes_pagos_titulacion.csv', serializarTablaCSV(pagos));
        descargar(await zip.generateAsync({ type: 'blob' }), `detalles_${egresados ? 'egresados' : 'alumnos'}_${fecha}.zip`);
      } else {
        const contenido = formato === 'alumnos' ? serializarTablaCSV(tablaAlumnosCSV(contexto.alumnos, contexto.columnas, contexto.fecha))
          : serializarTablaCSV(formato === 'pagos' ? pagos : academicoPreparado!.tabla!);
        const nombre = formato === 'alumnos' ? `reporte_${egresados ? 'egresados' : 'alumnos'}` : `${egresados ? 'egresados_' : ''}${formato === 'pagos' ? 'planes_pagos_titulacion' : 'programas_academicos'}`;
        descargar(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }), `${nombre}_${fecha}.csv`);
      }
      props.onCerrar();
    } finally { setDescargando(false); }
  }
  return <ModalConfirmacion isOpen wide title={egresados ? 'Exportar Egresados y Titulados' : 'Exportar Listado General'} type="info" busy={descargando} onCancel={props.onCerrar} onConfirm={exportar} confirmText={formato === 'ambos' ? 'Descargar ZIP' : 'Descargar CSV'} confirmDisabled={pendiente || formato === 'pagos' && !pagos.filas.length || !contexto.alumnos.length} cancelText="Cerrar" message={<div className="space-y-4 text-left">
    <p><strong>{contexto.alumnos.length} alumnos</strong> del reporte filtrado, incluidas todas sus páginas. {contexto.descripcionConsulta || `Ciclo de referencia del padrón: ${contexto.periodo}.`}</p>
    {egresados && <p className="text-xs leading-relaxed">El ciclo de egreso mostrado se obtiene del último ciclo del historial del alumno; no acredita el egreso de cada programa. En el detalle se identifica como referencia del alumno.</p>}
    <fieldset className="space-y-2" disabled={descargando}><legend className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Contenido de la descarga</legend>{opciones.map(o => <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${formato === o.id ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40' : 'border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-[#1c2228] dark:hover:bg-gray-800'}`}>
      <input type="radio" name="formato-listado-csv" value={o.id} checked={formato === o.id} onChange={() => setFormato(o.id)} className="mt-1 h-4 w-4 shrink-0 accent-blue-600"/><span className="min-w-0"><span className="block font-semibold text-gray-900 dark:text-gray-100">{o.titulo}</span><span className="mt-1 block text-xs leading-relaxed text-gray-600 dark:text-gray-300">{o.detalle}</span></span>
    </label>)}</fieldset>
    {formato !== 'alumnos' && <>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={descargando} checked={incluirIds} onChange={e => setIncluirIds(e.target.checked)} className="h-4 w-4 accent-blue-600"/>Incluir identificadores técnicos (IDs)</label>
      <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed dark:border-gray-600 dark:bg-gray-800/60">{academico && <p>Los filtros seleccionan alumnos. Se incluyen todos sus programas y fichas activas, con sus estados actuales. Las fichas sin programa aparecen en filas separadas.</p>}{(formato === 'pagos' || formato === 'ambos') && <p>Titulación incluye los planes de pagos de todos los ciclos de esos alumnos. Su ciclo es financiero; no se atribuye el pago a una carrera.</p>}</div>
    </>}
    <div aria-live="polite" className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-600">
      {academico ? cargando || !academicoPreparado && !fallo ? <p>Consultando programas y certificaciones…</p> : fallo ? <div role="alert"><p className="text-red-700 dark:text-red-300">{fallo}</p><button type="button" className="mt-2 font-semibold text-blue-700 underline dark:text-blue-300" onClick={() => setIntento(i => i + 1)}>Actualizar consulta</button></div> : <p>{contexto.alumnos.length} alumnos · {programas} programas · {sinAsociar} {sinAsociar === 1 ? 'ficha sin asociar' : 'fichas sin asociar'}</p> : <p>{contexto.alumnos.length} alumnos{formato === 'pagos' ? ` · ${pagos.filas.length} planes de pagos de titulación` : ' · Una fila por alumno'}</p>}
      {formato === 'ambos' && !pendiente && <p className="mt-1">{pagos.filas.length} planes de pagos en el archivo financiero.</p>}
      {formato === 'pagos' && !pagos.filas.length && <p className="mt-2">Estos alumnos no tienen planes de pagos de titulación registrados.</p>}
    </div>
  </div>}/>;
}
