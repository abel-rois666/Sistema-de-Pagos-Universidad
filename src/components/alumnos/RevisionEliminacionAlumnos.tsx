import { AlertCircle, ArrowUpRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { useEliminacionAlumnos } from '../../hooks/useEliminacionAlumnos';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import './revisionEliminacionAlumnos.css';

export default function RevisionEliminacionAlumnos({ flujo, administrador }: {
  flujo: ReturnType<typeof useEliminacionAlumnos>; administrador: boolean;
}) {
  const navigate = useNavigate();
  const { confirmacion, bloqueo } = flujo;
  return <>
    {bloqueo && <section role="alert" aria-labelledby="resultado-eliminacion-alumnos"
      className="alumnos-eliminacion-aviso mb-4 rounded-xl border p-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 id="resultado-eliminacion-alumnos" className="font-semibold">{bloqueo.mensaje}</h2>
          {bloqueo.recibos !== undefined && <>
            <p className="mt-2">Cancelar un recibo conserva su vínculo con el alumno. Si todos son de prueba, revísalos y utiliza «Borrar Físico (Prueba)» en cada recibo; después vuelve a eliminar al alumno.</p>
            <p className="mt-2">{administrador ? 'El borrado físico está disponible para Administración y requiere su propia confirmación.' : 'Solicita a Administración que revise los recibos. El borrado físico no está disponible para tu perfil.'} Conserva los recibos que correspondan a cobros reales.</p>
            {bloqueo.errorConsulta ? <p className="mt-2 font-medium">No se pudieron consultar los folios. Revisa la conexión y tus permisos; no se eliminaron los alumnos.</p>
              : !bloqueo.recibos.length ? <p className="mt-2">La base confirmó el vínculo, pero no devolvió folios visibles para esta selección. Solicita una revisión administrativa.</p>
              : <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Recibos vinculados">
                {bloqueo.recibos.map(recibo => <li key={recibo.id}>
                  <button type="button" onClick={() => navigate('/control-ingresos/consultar', { state: { view: 'consultar', searchTerm: String(recibo.folio) } })}
                    className="alumnos-eliminacion-recibo flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left">
                    <span className="min-w-0"><span className="font-semibold">R-{recibo.folio}</span> · {recibo.estatus === 'CANCELADO' ? 'Cancelado' : 'Activo'}
                      {bloqueo.alumnos.length > 1 && <span className="alumnos-eliminacion-nombre block break-words text-xs">{bloqueo.alumnos.find(a => a.id === recibo.alumno_id)?.nombre_completo}</span>}
                    </span><ArrowUpRight size={16} className="shrink-0" />
                  </button>
                </li>)}
              </ul>}
            {bloqueo.masRecibos && <p className="mt-2">Se muestran los primeros 50 recibos. Revisa también los restantes en Consulta de recibos.</p>}
          </>}
        </div>
        <button type="button" onClick={flujo.cerrarAviso} aria-label="Cerrar resultado de eliminación" className="alumnos-eliminacion-cerrar rounded p-1"><X size={18} /></button>
      </div>
    </section>}
    <ModalConfirmacion isOpen={confirmacion.length > 0} title={confirmacion.length === 1 ? 'Eliminar alumno' : 'Eliminar alumnos seleccionados'}
      message={<div className="space-y-3"><p>{confirmacion.length === 1 ? `Se eliminará permanentemente a ${confirmacion[0].nombre_completo}.` : `Se eliminarán permanentemente ${confirmacion.length} alumnos seleccionados.`}</p>
        <p>Esta acción no se puede deshacer y puede eliminar sus planes de pago y otros registros dependientes. Si existen dependencias que impiden el borrado, se conservarán los alumnos y se mostrará el motivo.</p>
        <p>No se borrarán recibos automáticamente.</p></div>}
      type="danger" confirmText="Eliminar permanentemente" busy={flujo.ocupado} onConfirm={flujo.confirmar} onCancel={flujo.cancelar} />
  </>;
}
