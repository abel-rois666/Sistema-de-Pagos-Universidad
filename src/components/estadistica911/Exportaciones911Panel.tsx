import { useState } from 'react';
import AyudaContextual from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import toast from 'react-hot-toast';
import type { Expediente911, Fuente911, Respaldo911 } from '../../estadistica911/types';
import { exportarCuestionarios911, pdfRespaldo911, xlsxRespaldo911, descargar911 } from '../../estadistica911/exportar';
import { huella911 } from '../../estadistica911/fuentes';
import { estadistica911Service as service } from '../../services/estadistica911Service';
import { cortePendiente911 } from '../../estadistica911/corte';
import { instanciaAplica911,nombreOferta911,erroresOferta911 } from '../../estadistica911/guia';
export default function Exportaciones911Panel({
  exp,
  fuentes,
  respaldos,
  sinGuardar,
  puedeVerAlumnos
}: {
  exp: Expediente911;
  fuentes: Record<string, Fuente911>;
  respaldos: Respaldo911[];
  sinGuardar: boolean;
  puedeVerAlumnos: boolean;
}) {
  const [seleccion, setSeleccion] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [excluidos, setExcluidos] = useState(false);
  const bloqueado = sinGuardar || cortePendiente911(exp) || erroresOferta911(exp).length>0;
  const instancias = exp.instancias.filter(i => seleccion.includes(i.id)),
    back = respaldos.filter(r => seleccion.includes(r.instancia));
  async function exportar(tipo: 'PDF' | 'TXT' | 'RESPALDO_PDF' | 'XLSX') {
    if (bloqueado) return toast.error('Recalcula el corte si está pendiente y guarda el expediente antes de exportar');
    if (!instancias.length) return toast.error('Selecciona al menos un formulario');
    setBusy(true);
    try {
      if (tipo === 'PDF' || tipo === 'TXT') {
        const catalogo = await service.catalogo(exp.catalogoHash);
        const a = await exportarCuestionarios911(exp, instancias, catalogo.fuentes, tipo);
        await service.registrarExportacion(exp, a.nombre.endsWith('.zip') ? 'ZIP' : tipo, a.nombre, await huella911(a.bytes));
        descargar911(a.nombre, a.bytes);
      } else {
        if (!puedeVerAlumnos) throw new Error('Se requiere permiso para listados individuales');
        const bytes = tipo === 'XLSX' ? await xlsxRespaldo911(exp, instancias, back, excluidos) : await pdfRespaldo911(exp, instancias, back, excluidos);
        const nombre = `911-respaldo-${exp.config.edicion}-r${exp.revision}.${tipo === 'XLSX' ? 'xlsx' : 'pdf'}`;
        await service.registrarExportacion(exp, tipo === 'XLSX' ? 'XLSX' : 'PDF', nombre, await huella911(bytes));
        descargar911(nombre, bytes);
      }
      toast.success('Archivo preparado con los datos de esta revisión');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <section className="s911-card"><h2>Descargar documentos de esta revisión</h2><p>1. Selecciona los formularios. 2. Elige cuestionarios contestados o listados de respaldo. Los archivos usan las respuestas y alumnos guardados en esta revisión.</p><div className="s911-toolbar"><button onClick={() => setSeleccion(exp.instancias.filter(instanciaAplica911).map(i => i.id))}>Seleccionar todos</button><button onClick={() => setSeleccion([])}>Quitar selección</button><span>{seleccion.length} formularios seleccionados</span></div><div className="s911-export-options">{exp.instancias.filter(instanciaAplica911).map(i => <label className="s911-check" key={i.id}><input type="checkbox" checked={seleccion.includes(i.id)} onChange={e => setSeleccion(e.target.checked ? [...seleccion, i.id] : seleccion.filter(id => id !== i.id))} /><span><strong>{i.cuestionario.toUpperCase()}</strong><small>{nombreOferta911(i)}{i.identidad.CV_PLAN_ESTUDIOS?` · Plan oficial ${i.identidad.CV_PLAN_ESTUDIOS}`:""}{i.identidad.CV_MODALIDAD?` · Modalidad oficial ${i.identidad.CV_MODALIDAD}`:""}</small></span></label>)}</div>
 <div className="s911-notice">{exp.estado === 'CERRADO' ? 'Versión revisada y cerrada.' : 'Borrador: las respuestas pendientes se dejan vacías y se enumeran en la continuación.'} Los PDF incluyen portada de control; varios formularios se entregan juntos en un ZIP.</div>
 <div className="s911-toolbar"><button disabled={busy || bloqueado || !instancias.length} className="s911-primary" onClick={() => exportar('PDF')}>Generar cuestionarios PDF contestados</button><button disabled={busy || bloqueado || !instancias.length || instancias.some(i => !fuentes[i.cuestionario].layout)} onClick={() => exportar('TXT')}>Descargar TXT para el portal</button><AyudaContextual etiqueta="TXT para el portal" texto={ayuda.txt}/></div>
 <p className="s911-note">Tecnología e Infraestructura disponen de PDF; sus TXT permanecen bloqueados hasta homologar los encabezados completos. Las respuestas se agregan a espacios seguros sin cubrir claves. La continuación contiene todas las cifras y faltantes.</p>
 {puedeVerAlumnos && <><h3>Respaldo de alumnos <AyudaContextual etiqueta="Respaldo de alumnos" texto={ayuda.respaldo}/></h3><p>Incluye resumen, contribuciones individuales y diferencias justificadas. No incluye CURP ni características sensibles.</p><label className="s911-check"><input type="checkbox" checked={excluidos} onChange={e => setExcluidos(e.target.checked)} />Añadir relación separada de excluidos y sus motivos</label><div className="s911-toolbar"><button disabled={busy || bloqueado || !instancias.length} onClick={() => exportar('XLSX')}>Descargar respaldo XLSX</button><button disabled={busy || bloqueado || !instancias.length} onClick={() => exportar('RESPALDO_PDF')}>Descargar respaldo PDF</button></div></>}
 {!instancias.length&&<p className="s911-note">Selecciona al menos un formulario para habilitar sus descargas.</p>}
 {sinGuardar&&<p className="s911-warning">Primero pulsa «Guardar expediente» para que todos los documentos correspondan a los mismos datos.</p>}
 {cortePendiente911(exp) && <p className="s911-warning">Exportación bloqueada: recalcula y aplica las cifras del nuevo corte, y guarda el expediente.</p>}
 {erroresOferta911(exp).length>0&&<p className="s911-warning">Completa la confirmación de oferta educativa antes de exportar.</p>}
 {busy && <p role="status">Preparando archivos…</p>}</section>;
}
